import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface MailTemplatePreviewMeta {
  id: string;
  filename: string;
  name: string;
  description: string;
  subject: string;
  sourcePath: string;
}

export interface MailTemplatePreviewResult extends MailTemplatePreviewMeta {
  html: string;
  context: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class MailTemplatePreviewService {
  constructor(private readonly api: ApiService) {}

  listTemplates(): Observable<MailTemplatePreviewMeta[]> {
    return this.api.get<MailTemplatePreviewMeta[]>('dev/mail-templates');
  }

  previewTemplate(id: string): Observable<MailTemplatePreviewResult> {
    return this.api.get<MailTemplatePreviewResult>(`dev/mail-templates/${id}/preview`);
  }
}
