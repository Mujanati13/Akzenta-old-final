import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  Post,
  Res,
  UseGuards,
  Patch,
  Delete,
  SerializeOptions,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiBody,
} from '@nestjs/swagger';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthForgotPasswordDto } from './dto/auth-forgot-password.dto';
import { AuthConfirmEmailDto } from './dto/auth-confirm-email.dto';
import { AuthResetPasswordDto } from './dto/auth-reset-password.dto';
import { AuthValidateResetPasswordDto } from './dto/auth-validate-reset-password.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { AuthGuard } from '@nestjs/passport';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  BrowserLoginResponseDto,
  BrowserRefreshResponseDto,
} from './dto/browser-auth-response.dto';
import { NullableType } from '../utils/types/nullable.type';
import { User } from '../users/domain/user';
import { AuthRegisterClientDto } from './dto/auth-register-client.dto';
import { AuthResendConfirmationDto } from './dto/auth-resend-confirmation.dto';
import { AuthRegisterAkzenteDto } from './dto/auth-register-akzente.dto';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { JwtService } from '@nestjs/jwt';
import type { Request as ExpressRequest, Response } from 'express';
import {
  AuthCookieScope,
  buildAuthCookieOptions,
  buildClearAuthCookieOptions,
  extractTokenFromCookie,
  getAuthCookieName,
  resolveAuthCookieScopeForRequest,
} from './auth-cookie.util';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly jwtService: JwtService,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('email/login')
  @ApiOkResponse({
    type: BrowserLoginResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginDto: AuthEmailLoginDto,
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserLoginResponseDto> {
    const result = await this.authService.validateLogin(loginDto);
    this.setAuthCookies(response, result, 'default', request.headers.origin);
    return this.toBrowserLoginResponse(result);
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('akzente/login')
  @ApiOkResponse({
    type: BrowserLoginResponseDto,
    description: 'Login endpoint for Akzente users only',
  })
  @HttpCode(HttpStatus.OK)
  public async loginAkzente(
    @Body() loginDto: AuthEmailLoginDto,
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserLoginResponseDto> {
    const result = await this.authService.validateAkzenteLogin(loginDto);
    this.setAuthCookies(response, result, 'akzente', request.headers.origin);
    return this.toBrowserLoginResponse(result);
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('client/login')
  @ApiOkResponse({
    type: BrowserLoginResponseDto,
    description: 'Login endpoint for Client users only',
  })
  @HttpCode(HttpStatus.OK)
  public async loginClient(
    @Body() loginDto: AuthEmailLoginDto,
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserLoginResponseDto> {
    const result = await this.authService.validateClientLogin(loginDto);
    this.setAuthCookies(response, result, 'client', request.headers.origin);
    return this.toBrowserLoginResponse(result);
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('merchandiser/login')
  @ApiOkResponse({
    type: BrowserLoginResponseDto,
    description: 'Login endpoint for Merchandiser users only',
  })
  @HttpCode(HttpStatus.OK)
  public async loginMerchandiser(
    @Body() loginDto: AuthEmailLoginDto,
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserLoginResponseDto> {
    const result = await this.authService.validateMerchandiserLogin(loginDto);
    this.setAuthCookies(response, result, 'merchandiser', request.headers.origin);
    return this.toBrowserLoginResponse(result);
  }

  @Post('email/register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() createUserDto: AuthRegisterLoginDto,
  ): Promise<{ message: string; confirmationEmailSent: boolean }> {
    const { confirmationEmailSent } =
      await this.authService.register(createUserDto);
    return {
      message:
        'Registration successful. Please check your email to confirm your account.',
      confirmationEmailSent,
    };
  }

  @Post('email/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.authService.confirmEmail(confirmEmailDto.hash);
  }

  @Post('email/confirm/new')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmNewEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.authService.confirmNewEmail(confirmEmailDto.hash);
  }

  @Post('forgot/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body() forgotPasswordDto: AuthForgotPasswordDto,
    @Request() request: ExpressRequest,
  ): Promise<void> {
    return this.authService.forgotPassword(
      forgotPasswordDto.email,
      forgotPasswordDto.userType,
      request,
    );
  }

  @Post('reset/password/validate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async validateResetPassword(
    @Body() validateDto: AuthValidateResetPasswordDto,
  ): Promise<void> {
    await this.authService.validateResetPasswordHash(
      validateDto.hash,
      validateDto.userType,
    );
  }

  @Post('reset/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() resetPasswordDto: AuthResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(
      resetPasswordDto.hash,
      resetPasswordDto.password,
      resetPasswordDto.userType,
    );
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['me'],
  })
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  public me(@Request() request): Promise<NullableType<User>> {
    return this.authService.me(request.user);
  }

  @ApiBearerAuth()
  @Post('session/touch')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async touchSession(@Request() request): Promise<void> {
    await this.authService.touchSession(request.user.sessionId);
  }

  @ApiBearerAuth()
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Request() request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserRefreshResponseDto> {
    const result = await this.authService.refreshToken({
      sessionId: request.user.sessionId,
      hash: request.user.hash,
    });
    const cookieScope = resolveAuthCookieScopeForRequest(
      this.configService,
      request,
    );
    this.setAuthCookies(response, result, cookieScope, request.headers.origin);
    return {
      tokenExpires: result.tokenExpires,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const sessionId = await this.extractSessionIdForLogout(request);
    if (sessionId) {
      try {
        await this.authService.logout({
          sessionId,
        });
      } catch {
        // Always clear cookies client-side even if the server session is already gone.
      }
    }
    const cookieScope = resolveAuthCookieScopeForRequest(
      this.configService,
      request,
    );
    this.clearAuthCookies(response, cookieScope, request.headers.origin);
  }

  @Post('register-client')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Register a new client user',
    description:
      'Creates a new client user. Only Akzente users can access this endpoint.',
  })
  @ApiBody({
    type: AuthRegisterClientDto,
    description: 'Client user registration data',
  })
  async registerClient(
    @Body() createUserDto: AuthRegisterClientDto,
    @Request() request,
  ): Promise<void> {
    // Verify the requesting user is an Akzente user
    const user = request.user;
    return this.authService.registerClient(createUserDto, user.id);
  }

  @Post('register-akzente')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Register a new Akzente user with favorite client companies',
    description:
      'Creates a new Akzente user and assigns favorite client companies. Only admin users can access this endpoint.',
  })
  @ApiBody({
    type: AuthRegisterAkzenteDto,
    description:
      'Akzente user registration data including favorite client companies',
  })
  async registerAkzente(
    @Body() createUserDto: AuthRegisterAkzenteDto,
    @Request() request,
  ): Promise<void> {
    // Verify the requesting user is an admin
    const user = request.user;

    return this.authService.registerAkzente(createUserDto, user.id);
  }

  @Post('users/:id/send-generated-password')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Generate and email a new password for a user',
    description:
      'Generates a new password server-side and emails it to the user. Only Akzente staff can access this endpoint.',
  })
  async sendGeneratedPassword(
    @Param('id') id: User['id'],
    @Request() request,
  ): Promise<void> {
    return this.authService.sendGeneratedPasswordToUser(id, request.user.id);
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['me'],
  })
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  public update(
    @Request() request,
    @Body() userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    return this.authService.update(request.user, userDto);
  }

  @ApiBearerAuth()
  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(@Request() request): Promise<void> {
    return this.authService.softDelete(request.user);
  }

  @Post('email/resend-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendConfirmationEmail(
    @Body() resendDto: AuthResendConfirmationDto,
  ): Promise<void> {
    return this.authService.resendConfirmationEmail(resendDto.email);
  }

  private setAuthCookies(
    response: Response,
    tokens: Pick<LoginResponseDto, 'token' | 'refreshToken'>,
    scope: AuthCookieScope,
    requestOrigin?: string,
  ): void {
    response.cookie(
      getAuthCookieName('access', scope),
      tokens.token,
      buildAuthCookieOptions(
        this.configService,
        tokens.token,
        'access',
        requestOrigin,
      ),
    );
    response.cookie(
      getAuthCookieName('refresh', scope),
      tokens.refreshToken,
      buildAuthCookieOptions(
        this.configService,
        tokens.refreshToken,
        'refresh',
        requestOrigin,
      ),
    );
  }

  private clearAuthCookies(
    response: Response,
    scope: AuthCookieScope,
    requestOrigin?: string,
  ): void {
    response.clearCookie(
      getAuthCookieName('access', scope),
      buildClearAuthCookieOptions(
        this.configService,
        'access',
        requestOrigin,
      ),
    );
    response.clearCookie(
      getAuthCookieName('refresh', scope),
      buildClearAuthCookieOptions(
        this.configService,
        'refresh',
        requestOrigin,
      ),
    );
  }

  private toBrowserLoginResponse(
    result: LoginResponseDto,
  ): BrowserLoginResponseDto {
    return {
      user: result.user,
      tokenExpires: result.tokenExpires,
    };
  }

  private async extractSessionIdForLogout(
    request: ExpressRequest,
  ): Promise<number | string | null> {
    const cookieScope = resolveAuthCookieScopeForRequest(
      this.configService,
      request,
    );
    const scopedAccessToken =
      extractTokenFromCookie(
        request,
        getAuthCookieName('access', cookieScope),
      ) ?? null;
    const scopedRefreshToken =
      extractTokenFromCookie(
        request,
        getAuthCookieName('refresh', cookieScope),
      ) ?? null;

    const tokenCandidates = [
      this.extractBearerToken(request),
      scopedAccessToken,
      scopedRefreshToken,
    ].filter((token): token is string => !!token);

    for (const token of tokenCandidates) {
      const sessionId = await this.verifyTokenForSessionId(token);
      if (sessionId) {
        return sessionId;
      }
    }

    return null;
  }

  private extractBearerToken(request: ExpressRequest): string | null {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    return authorization.slice('Bearer '.length);
  }

  private async verifyTokenForSessionId(
    token: string,
  ): Promise<number | string | null> {
    const secrets = [
      this.configService.getOrThrow('auth.secret', { infer: true }),
      this.configService.getOrThrow('auth.refreshSecret', { infer: true }),
    ];

    for (const secret of secrets) {
      try {
        const payload = await this.jwtService.verifyAsync<{
          sessionId?: number | string;
        }>(token, {
          secret,
        });

        if (payload.sessionId) {
          return payload.sessionId;
        }
      } catch {
        // Try the next token type/secret.
      }
    }

    return null;
  }
}
