import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { AllConfigType } from '../config/config.type';

export interface MailTemplatePreviewMeta {
  id: string;
  filename: string;
  name: string;
  description: string;
  subject: string;
  sourcePath: string;
}

export interface MailTemplatePreviewResult {
  id: string;
  filename: string;
  name: string;
  subject: string;
  sourcePath: string;
  html: string;
  context: Record<string, unknown>;
}

interface MailTemplateDefinition extends MailTemplatePreviewMeta {
  buildContext: (config: ConfigService<AllConfigType>) => Record<string, unknown>;
}

@Injectable()
export class MailTemplatePreviewService {
  private readonly templates: MailTemplateDefinition[] = [
    {
      id: 'activation',
      filename: 'activation.hbs',
      name: 'E-Mail-Bestätigung (Registrierung)',
      description: 'Sent after user sign-up to confirm the email address.',
      subject: 'E-Mail bestätigen',
      sourcePath: 'Backend/src/mail/mail-templates/activation.hbs',
      buildContext: (config) => ({
        title: 'E-Mail bestätigen',
        url: `${config.get('app.frontendDomain', { infer: true })}/confirm-email?hash=preview-hash-abc123`,
        actionTitle: 'E-Mail bestätigen',
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
        text1: 'Hallo!',
        text2: 'Sie sind fast bereit, loszulegen mit',
        text3:
          'Klicken Sie einfach auf den Button unten, um Ihre E-Mail-Adresse zu bestätigen und Ihr Konto zu aktivieren.',
      }),
    },
    {
      id: 'reset-password',
      filename: 'reset-password.hbs',
      name: 'Passwort zurücksetzen',
      description: 'Sent when a user requests a password reset link.',
      subject: 'Passwort zurücksetzen',
      sourcePath: 'Backend/src/mail/mail-templates/reset-password.hbs',
      buildContext: (config) => ({
        title: 'Passwort zurücksetzen',
        url: `${config.get('app.frontendDomain', { infer: true })}/password-change?hash=preview-hash-abc123&expires=4102444800`,
        actionTitle: 'Passwort zurücksetzen',
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
        text1: 'Probleme beim Anmelden?',
        text2: 'Das Zurücksetzen Ihres Passworts ist einfach.',
        text3:
          'Klicken Sie einfach auf die Schaltfläche unten und folgen Sie den Anweisungen. Sie sind im Handumdrehen wieder startklar.',
        text4:
          'Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie bitte diese E-Mail.',
      }),
    },
    {
      id: 'confirm-new-email',
      filename: 'confirm-new-email.hbs',
      name: 'Neue E-Mail bestätigen',
      description: 'Sent when a user changes their email address.',
      subject: 'E-Mail bestätigen',
      sourcePath: 'Backend/src/mail/mail-templates/confirm-new-email.hbs',
      buildContext: (config) => ({
        title: 'E-Mail bestätigen',
        url: `${config.get('app.frontendDomain', { infer: true })}/confirm-new-email?hash=preview-hash-abc123`,
        actionTitle: 'E-Mail bestätigen',
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
        text1: 'Hey!',
        text2: 'Bestätige deine neue E-Mail-Adresse.',
        text3:
          'Klicke einfach auf den großen grünen Button unten, um deine E-Mail-Adresse zu verifizieren.',
      }),
    },
    {
      id: 'welcome',
      filename: 'welcome.hbs',
      name: 'Willkommen / Zugangsdaten',
      description: 'Sent to new Akzente users with login credentials.',
      subject: 'Ihr Zugangsdaten für Akzente',
      sourcePath: 'Backend/src/mail/mail-templates/welcome.hbs',
      buildContext: (config) => ({
        firstName: 'Max',
        password: 'PreviewPass123!',
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
        to: 'max.mustermann@example.com',
        loginUrl: `${config.get('app.frontendDomain', { infer: true })}/login`,
      }),
    },
    {
      id: 'password-reset-admin',
      filename: 'password-reset-admin.hbs',
      name: 'Passwort zurückgesetzt (Admin)',
      description: 'Sent when an administrator resets a user password.',
      subject: 'Ihr Passwort wurde zurückgesetzt',
      sourcePath: 'Backend/src/mail/mail-templates/password-reset-admin.hbs',
      buildContext: (config) => ({
        firstName: 'Max',
        password: 'NewAdminReset123!',
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
        loginUrl: `${config.get('app.frontendDomain', { infer: true })}/login`,
      }),
    },
    {
      id: 'password-changed',
      filename: 'password-changed.hbs',
      name: 'Passwort geändert',
      description: 'Sent after a user successfully changes their password.',
      subject: 'Ihr Passwort wurde geändert',
      sourcePath: 'Backend/src/mail/mail-templates/password-changed.hbs',
      buildContext: (config) => ({
        firstName: 'Max',
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
        loginUrl: `${config.get('app.frontendDomain', { infer: true })}/login`,
      }),
    },
    {
      id: 'merchandiser-activation',
      filename: 'merchandiser-activation.hbs',
      name: 'Merchandiser-Registrierung',
      description: 'Sent to merchandisers to confirm their registration.',
      subject: 'Registrierung bestätigen – Akzente',
      sourcePath: 'Backend/src/mail/mail-templates/merchandiser-activation.hbs',
      buildContext: (config) => ({
        firstName: 'Anna',
        url: `${config.get('app.merchandiserFrontendDomain', { infer: true })}/confirm-email?hash=preview-hash-abc123`,
        app_name: config.get('app.name', { infer: true }) || 'Akzente',
      }),
    },
  ];

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  assertDevelopmentOnly(): void {
    if (this.configService.get('app.nodeEnv', { infer: true }) === 'production') {
      throw new NotFoundException();
    }
  }

  listTemplates(): MailTemplatePreviewMeta[] {
    this.assertDevelopmentOnly();

    return this.templates.map(({ buildContext: _buildContext, ...meta }) => meta);
  }

  async renderTemplate(id: string): Promise<MailTemplatePreviewResult> {
    this.assertDevelopmentOnly();

    const template = this.templates.find((entry) => entry.id === id);
    if (!template) {
      throw new NotFoundException(`Unknown mail template: ${id}`);
    }

    const context = template.buildContext(this.configService);
    const templatePath = await this.resolveTemplatePath(template.filename);
    const source = await fs.readFile(templatePath, 'utf-8');
    const html = Handlebars.compile(source, { strict: true })(context);

    return {
      id: template.id,
      filename: template.filename,
      name: template.name,
      subject: template.subject,
      sourcePath: template.sourcePath,
      html,
      context,
    };
  }

  private async resolveTemplatePath(filename: string): Promise<string> {
    const workingDirectory = this.configService.getOrThrow('app.workingDirectory', {
      infer: true,
    });

    const candidates = [
      path.join(workingDirectory, 'src', 'mail', 'mail-templates', filename),
      path.join(workingDirectory, 'Backend', 'src', 'mail', 'mail-templates', filename),
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // try next candidate
      }
    }

    throw new NotFoundException(`Template file not found: ${filename}`);
  }
}
