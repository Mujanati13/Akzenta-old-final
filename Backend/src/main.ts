import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import {
  json,
  urlencoded,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { AppModule } from './app.module';
import validationOptions from './utils/validation-options';
import { AllConfigType } from './config/config.type';
import { isTrustedFrontendOrigin } from './config/cors.util';
import { ResolvePromisesInterceptor } from './utils/serializer.interceptor';
import {
  getAuthCookieNames,
} from './auth/auth-cookie.util';

// Default body-parser limit is 100kb; increase to allow larger JSON payloads (e.g. report drafts)
const BODY_PARSER_LIMIT = '2mb';
const REQUEST_TIMEOUT_MS = 15000;
const FILE_UPLOAD_REQUEST_TIMEOUT_MS = 300_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CORS_ALLOWED_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS =
  'Content-Type, Authorization, Accept-Language, Content-Language, lang, x-custom-lang, X-Akzente-Auth-Scope';
const PUBLIC_AUTH_ROUTE_SUFFIXES = [
  '/auth/email/login',
  '/auth/akzente/login',
  '/auth/client/login',
  '/auth/merchandiser/login',
  '/auth/forgot/password',
  '/auth/reset/password',
  '/auth/reset/password/validate',
  '/auth/email/confirm',
  '/auth/email/confirm/new',
  '/auth/email/register',
  '/auth/email/resend-confirmation',
] as const;

function isPublicAuthRoute(path: string): boolean {
  const pathWithoutQuery = path.split('?')[0];
  return PUBLIC_AUTH_ROUTE_SUFFIXES.some((suffix) =>
    pathWithoutQuery.endsWith(suffix),
  );
}

function hasAuthCookieHeader(request: Request): boolean {
  const cookieHeader = request.headers.cookie ?? '';
  const accessCookiePresent = getAuthCookieNames('access').some((cookieName) =>
    cookieHeader.includes(`${cookieName}=`),
  );
  const refreshCookiePresent = getAuthCookieNames('refresh').some(
    (cookieName) => cookieHeader.includes(`${cookieName}=`),
  );

  return accessCookiePresent || refreshCookiePresent;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
    bodyParser: false,
  });

  // The production API is reachable only through the private Docker network.
  // Trust exactly its single reverse proxy, not arbitrary client forwarding headers.
  if (process.env.TRUST_PROXY === '1') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.getHttpAdapter().get('/health', async (_req: Request, res: Response) => {
    try {
      await app.get(DataSource).query('SELECT 1');
      res.status(200).json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // Prevent browser and intermediary caches from storing API responses with sensitive data.
  app.use((_, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  app.use(json({ limit: BODY_PARSER_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_PARSER_LIMIT }));

  // Basic in-memory rate limiting to reduce backend overload during client-side request storms.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = requestBuckets.get(key);

    if (!current || now > current.resetAt) {
      requestBuckets.set(key, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return next();
    }

    if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please retry later.',
      });
    }

    current.count += 1;
    return next();
  });

  // Fail slow/hung requests explicitly instead of letting them consume resources indefinitely.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isMultipartReportSave =
      req.method === 'PATCH' &&
      /report\/\d+$/i.test(req.path) &&
      typeof req.headers['content-type'] === 'string' &&
      req.headers['content-type'].includes('multipart/form-data');
    const isFileUploadRoute =
      /\/upload(?:\/|$)/i.test(req.path) || isMultipartReportSave;
    const timeoutMs = isFileUploadRoute
      ? FILE_UPLOAD_REQUEST_TIMEOUT_MS
      : REQUEST_TIMEOUT_MS;

    const timeoutId = setTimeout(() => {
      if (res.headersSent) {
        return;
      }
      (req as any).timedOut = true;
      res.status(408).json({
        statusCode: 408,
        message: 'Request timeout',
        path: req.originalUrl,
      });
    }, timeoutMs);

    res.on('close', () => clearTimeout(timeoutId));
    next();
  });

  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin) {
      return next();
    }

    if (!isTrustedFrontendOrigin(origin, configService)) {
      if (req.method.toUpperCase() === 'OPTIONS') {
        return res.status(403).json({
          statusCode: 403,
          message: 'Origin not allowed by CORS.',
          path: req.originalUrl,
        });
      }

      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);

    const requestHeaders = req.headers['access-control-request-headers'];
    if (typeof requestHeaders === 'string' && requestHeaders.length > 0) {
      res.setHeader('Access-Control-Allow-Headers', requestHeaders);
    } else {
      res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    }

    if (req.method.toUpperCase() === 'OPTIONS') {
      return res.status(204).send();
    }

    return next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!UNSAFE_HTTP_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    if (!hasAuthCookieHeader(req)) {
      return next();
    }

    if (isPublicAuthRoute(req.originalUrl)) {
      return next();
    }

    const requestSource = req.headers.origin || req.headers.referer;
    if (
      typeof requestSource === 'string' &&
      isTrustedFrontendOrigin(requestSource, configService)
    ) {
      return next();
    }

    return res.status(403).json({
      statusCode: 403,
      message: 'Invalid origin for credentialed request.',
      path: req.originalUrl,
    });
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalInterceptors(
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  if (configService.get('app.nodeEnv', { infer: true }) !== 'production') {
    const options = new DocumentBuilder()
      .setTitle('Akzente API')
      .setDescription('API docs')
      .setVersion('1.0')
      .addBearerAuth()
      .addGlobalParameters({
        in: 'header',
        required: false,
        name: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
        schema: {
          example: 'en',
        },
      })
      .build();
  
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('docs', app, document);

  }

  const port = configService.getOrThrow('app.port', { infer: true });
  const apiPrefix = configService.getOrThrow('app.apiPrefix', { infer: true });
  await app.listen(port);

  console.log(`\n🚀 Akzente API running on http://localhost:${port}/${apiPrefix}/v1`);
  if (configService.get('app.nodeEnv', { infer: true }) !== 'production') {
    console.log(`📚 Swagger docs on http://localhost:${port}/docs\n`);
  }
}
void bootstrap();
