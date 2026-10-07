import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '@app/shared/app-icon.component';
import { MailTemplatePreviewMeta, MailTemplatePreviewResult, MailTemplatePreviewService } from '@app/core/services/mail-template-preview.service';
import { environment } from '@env/environment';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-email-templates',
  imports: [CommonModule, ImportsModule, AppIconComponent],
  templateUrl: './email-templates.component.html',
  styleUrl: './email-templates.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class EmailTemplatesComponent implements OnInit, OnDestroy {
  templates: MailTemplatePreviewMeta[] = [];
  selectedTemplateId: string | null = null;
  preview: MailTemplatePreviewResult | null = null;
  previewFrameUrl: SafeResourceUrl | null = null;
  loadingList = true;
  loadingPreview = false;
  error: string | null = null;
  showMockData = true;

  private previewObjectUrl: string | null = null;

  constructor(
    private readonly mailTemplatePreviewService: MailTemplatePreviewService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.clearPreviewFrame();
  }

  loadTemplates(selectFirst = true): void {
    this.loadingList = true;
    this.error = null;

    this.mailTemplatePreviewService
      .listTemplates()
      .pipe(
        catchError(() => {
          this.error = 'Could not load mail templates. Make sure the backend is running in development mode.';
          return of([]);
        }),
      )
      .subscribe((templates) => {
        this.templates = templates;
        this.loadingList = false;

        if (selectFirst && templates.length > 0) {
          this.selectTemplate(templates[0].id);
        }
      });
  }

  selectTemplate(id: string): void {
    if (this.selectedTemplateId === id && this.preview) {
      return;
    }

    this.selectedTemplateId = id;
    this.loadPreview(id);
  }

  refreshPreview(): void {
    if (this.selectedTemplateId) {
      this.loadPreview(this.selectedTemplateId);
    }
  }

  openInNewTab(): void {
    if (!this.selectedTemplateId) {
      return;
    }

    const url = `${environment.apiUrl}/dev/mail-templates/${this.selectedTemplateId}/html`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  get selectedTemplate(): MailTemplatePreviewMeta | undefined {
    return this.templates.find((template) => template.id === this.selectedTemplateId);
  }

  get mockContextJson(): string {
    if (!this.preview?.context) {
      return '{}';
    }

    return JSON.stringify(this.preview.context, null, 2);
  }

  private loadPreview(id: string): void {
    this.loadingPreview = true;
    this.error = null;

    this.mailTemplatePreviewService
      .previewTemplate(id)
      .pipe(
        catchError(() => {
          this.error = 'Could not render the selected template.';
          return of(null);
        }),
      )
      .subscribe((preview) => {
        this.preview = preview;
        this.updatePreviewFrame(preview);
        this.loadingPreview = false;
      });
  }

  private updatePreviewFrame(preview: MailTemplatePreviewResult | null): void {
    this.clearPreviewFrame();

    if (!preview?.html) {
      return;
    }

    const blob = new Blob([preview.html], { type: 'text/html' });
    this.previewObjectUrl = URL.createObjectURL(blob);
    this.previewFrameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl);
  }

  private clearPreviewFrame(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }

    this.previewFrameUrl = null;
  }
}
