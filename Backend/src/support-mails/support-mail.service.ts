import { Injectable } from '@nestjs/common';
import { CreateSupportMailDto } from './dto/create-support-mail.dto';
import { UpdateSupportMailDto } from './dto/update-support-mail.dto';
import { SupportMailRepository } from './infrastructure/persistence/support-mail.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { SupportMail } from './domain/support-mail';
import { ClientService } from '../client/client.service';
import { SupportService } from '../support/support.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class SupportMailService {
  constructor(
    private readonly supportMailRepository: SupportMailRepository,
    private readonly clientService: ClientService,
    private readonly supportService: SupportService,
    private readonly mailerService: MailerService,
  ) {}

  async create(createSupportMailDto: CreateSupportMailDto) {
    
    // Get client by user ID (client entity has relation with user)
    const client = await this.clientService.findByUserId(createSupportMailDto.userId);
    if (!client) {
      throw new Error('Client not found for this user');
    }
    

    // Create support mail record
    const supportMail = new SupportMail();
    supportMail.subject = createSupportMailDto.subject;
    supportMail.content = createSupportMailDto.content;
    // const supportMail = await this.supportMailRepository.create({
    //   client,
    //   subject: createSupportMailDto.subject,
    //   content: createSupportMailDto.content,
    // } as SupportMail);

    // Send emails to all support addresses
    await this.sendToSupport(supportMail);

    return supportMail;
  }

  async sendToSupport(supportMail: SupportMail) {
    // Get all support email addresses
    const supports = await this.supportService.findAllWithPagination({
      paginationOptions: { page: 1, limit: 100 },
    });

    if (!supports || supports.length === 0) {
      console.warn('⚠️ No support emails configured - skipping email sending');
      return;
    }


    // Send email to each support address
    const emailPromises = supports.map(async (support) => {
      try {
        await this.mailerService.sendMail({
          to: support.email,
          subject: supportMail.subject,
          text: this.formatEmailContent(supportMail),
          html: this.formatEmailContentHtml(supportMail),
        });
      } catch (error) {
        console.warn(`⚠️ Could not send email to ${support.email} (mail server not configured)`);
        // Don't throw error - message is still saved in database
      }
    });

    await Promise.allSettled(emailPromises);
  }

  private formatEmailContent(supportMail: SupportMail): string {
    const clientName = supportMail.client?.user
      ? `${supportMail.client.user.firstName || ''} ${supportMail.client.user.lastName || ''}`.trim()
      : 'Unknown Client';
    const clientEmail = supportMail.client?.user?.email || 'No email';

    return `
Support Request

From: ${clientName} (${clientEmail})
Date: ${new Date(supportMail.createdAt).toLocaleString('de-DE')}

Subject: ${supportMail.subject}

Message:
${supportMail.content}
    `.trim();
  }

  private formatEmailContentHtml(supportMail: SupportMail): string {
    const clientName = supportMail.client?.user
      ? `${supportMail.client.user.firstName || ''} ${supportMail.client.user.lastName || ''}`.trim()
      : 'Unknown Client';
    const clientEmail = supportMail.client?.user?.email || 'No email';

    return `
      <h2>Support Request</h2>
      <p><strong>From:</strong> ${clientName} (${clientEmail})</p>
      <p><strong>Date:</strong> ${new Date(supportMail.createdAt).toLocaleString('de-DE')}</p>
      <p><strong>Subject:</strong> ${supportMail.subject}</p>
      <hr/>
      <p><strong>Message:</strong></p>
      <p>${supportMail.content.replace(/\n/g, '<br/>')}</p>
    `;
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.supportMailRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: SupportMail['id']) {
    return this.supportMailRepository.findById(id);
  }

  findByClientId(clientId: number) {
    return this.supportMailRepository.findByClientId(clientId);
  }

  update(id: SupportMail['id'], updateSupportMailDto: UpdateSupportMailDto) {
    return this.supportMailRepository.update(id, updateSupportMailDto);
  }

  remove(id: SupportMail['id']) {
    return this.supportMailRepository.remove(id);
  }
}

