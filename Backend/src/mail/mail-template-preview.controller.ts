import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SessionCheckGuard } from '../roles/session-check.guard';
import {
  MailTemplatePreviewMeta,
  MailTemplatePreviewResult,
  MailTemplatePreviewService,
} from './mail-template-preview.service';

@ApiTags('Dev')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.user)
@UseGuards(RolesGuard, SessionCheckGuard)
@Controller({
  path: 'dev/mail-templates',
  version: '1',
})
export class MailTemplatePreviewController {
  constructor(
    private readonly mailTemplatePreviewService: MailTemplatePreviewService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List all mail templates available for preview' })
  listTemplates(): MailTemplatePreviewMeta[] {
    return this.mailTemplatePreviewService.listTemplates();
  }

  @Get(':id/preview')
  @ApiOkResponse({ description: 'Render a mail template with mock data' })
  previewTemplate(@Param('id') id: string): Promise<MailTemplatePreviewResult> {
    return this.mailTemplatePreviewService.renderTemplate(id);
  }

  @Get(':id/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async previewTemplateHtml(@Param('id') id: string): Promise<string> {
    const result = await this.mailTemplatePreviewService.renderTemplate(id);
    return result.html;
  }
}
