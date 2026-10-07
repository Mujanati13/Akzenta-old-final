import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';

import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import fs from 'node:fs/promises';
import path from 'path';
import { AllConfigType } from '../config/config.type';
import { resolvePasswordResetFrontendDomain } from '../auth/auth-cookie.util';
import { UserTypeEnum } from '../user-type/user-types.enum';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async userSignUp(mailData: MailData<{ hash: string; userType?: number }>): Promise<void> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-email.text1'),
        i18n.t('confirm-email.text2'),
        i18n.t('confirm-email.text3'),
      ]);
    }

    const url = this.buildConfirmEmailUrl(
      mailData.data.hash,
      mailData.data.userType,
    );

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'activation.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url,
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async forgotPassword(
    mailData: MailData<{
      hash: string;
      tokenExpires: number;
      userType?: number;
      frontendBaseUrl?: string;
    }>,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let resetPasswordTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;
    let text4: MaybeType<string>;

    if (i18n) {
      [resetPasswordTitle, text1, text2, text3, text4] = await Promise.all([
        i18n.t('common.resetPassword'),
        i18n.t('reset-password.text1'),
        i18n.t('reset-password.text2'),
        i18n.t('reset-password.text3'),
        i18n.t('reset-password.text4'),
      ]);
    }

    const frontendBase =
      mailData.data.frontendBaseUrl ??
      this.getPasswordResetFrontendUrl(mailData.data.userType);
    const url = new URL(`${frontendBase.replace(/\/$/, '')}/password-change`);
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: resetPasswordTitle,
      text: `${url.toString()} ${resetPasswordTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'reset-password.hbs',
      ),
      context: {
        title: resetPasswordTitle,
        url: url.toString(),
        actionTitle: resetPasswordTitle,
        app_name: this.configService.get('app.name', {
          infer: true,
        }),
        text1,
        text2,
        text3,
        text4,
      },
    });
  }

  async confirmNewEmail(mailData: MailData<{ hash: string; userType?: number }>): Promise<void> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-new-email.text1'),
        i18n.t('confirm-new-email.text2'),
        i18n.t('confirm-new-email.text3'),
      ]);
    }

    const url = this.buildConfirmEmailUrl(
      mailData.data.hash,
      mailData.data.userType,
      '/confirm-new-email',
    );

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'confirm-new-email.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url,
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async akzenteWelcome(
    mailData: MailData<{ firstName: string; password?: string; userType?: number }>,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: mailData.to,
      subject: 'Ihr Zugangsdaten für Akzente',
      templatePath: await this.resolveTemplatePath('welcome.hbs'),
      context: {
        firstName: mailData.data.firstName,
        password: mailData.data.password,
        app_name: this.configService.get('app.name', { infer: true }),
        to: mailData.to,
        loginUrl: `${this.getLoginFrontendUrl(mailData.data.userType)}/login`,
      },
    });
  }

  async akzentePasswordReset(
    mailData: MailData<{ firstName: string; password: string; userType?: number }>,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: mailData.to,
      subject: 'Ihr Passwort wurde zurückgesetzt',
      text: 'Ihr Passwort wurde von einem Administrator zurückgesetzt. Die neuen Zugangsdaten finden Sie in dieser E-Mail.',
      templatePath: await this.resolveTemplatePath('password-reset-admin.hbs'),
      context: {
        firstName: mailData.data.firstName,
        password: mailData.data.password,
        app_name: this.configService.get('app.name', { infer: true }),
        loginUrl: `${this.getLoginFrontendUrl(mailData.data.userType)}/login`,
      },
    });
  }

  async akzentePasswordChanged(
    mailData: MailData<{ firstName: string; userType?: number }>,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: mailData.to,
      subject: 'Ihr Passwort wurde geändert',
      text: 'Ihr Passwort wurde erfolgreich geändert.',
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', { infer: true }),
        'src',
        'mail',
        'mail-templates',
        'password-changed.hbs',
      ),
      context: {
        firstName: mailData.data.firstName,
        app_name: this.configService.get('app.name', { infer: true }),
        loginUrl: `${this.getLoginFrontendUrl(mailData.data.userType)}/login`,
      },
    });
  }

  private getLoginFrontendUrl(userType?: number): string {
    return this.getPasswordResetFrontendUrl(userType).replace(/\/$/, '');
  }

  private getPasswordResetFrontendUrl(userType?: number): string {
    return resolvePasswordResetFrontendDomain(this.configService, {
      userTypeId: userType,
    });
  }

  async merchandiserSignUp(mailData: MailData<{ hash: string; firstName: string }>): Promise<void> {
    const url = this.buildConfirmEmailUrl(
      mailData.data.hash,
      UserTypeEnum.merchandiser,
    );

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: 'Registrierung bestätigen – Akzente',
      text: `${url} Registrierung bestätigen`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'merchandiser-activation.hbs',
      ),
      context: {
        firstName: mailData.data.firstName,
        url,
        app_name: this.configService.get('app.name', { infer: true }),
      },
    });
  }

  private buildConfirmEmailUrl(
    hash: string,
    userType?: number,
    path = '/confirm-email',
  ): string {
    const frontendBase = this.getConfirmEmailFrontendUrl(userType);
    const url = new URL(`${frontendBase}${path}`);
    url.searchParams.set('hash', hash);
    return url.toString();
  }

  private getConfirmEmailFrontendUrl(userType?: number): string {
    return resolvePasswordResetFrontendDomain(this.configService, {
      userTypeId: userType,
    }).replace(/\/$/, '');
  }

  private async resolveTemplatePath(filename: string): Promise<string> {
    const workingDirectory = this.configService.getOrThrow('app.workingDirectory', {
      infer: true,
    });

    const candidates = [
      path.join(workingDirectory, 'src', 'mail', 'mail-templates', filename),
      path.join(workingDirectory, 'dist', 'src', 'mail', 'mail-templates', filename),
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

    throw new Error(`Mail template not found: ${filename}`);
  }
}
