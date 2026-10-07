import { Component, OnInit, ViewEncapsulation, AfterViewInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ReportService } from '@app/@core/services/report.service';
import { NotificationsService } from '@app/core/services/notifications.service';
import { ProjectsStateService } from '../projects-state.service';
import { HotToastService } from '@ngneat/hot-toast';
import { catchError, of } from 'rxjs';
import { canClientApproveReport, isClientReportClosed } from '@app/@core/utils/report-client-status.util';

interface GalleryItem {
  itemImageSrc: string;
  thumbnailImageSrc: string;
  title: string;
  alt: string;
  beforeAfterType?: string;
  date?: string;
  labelNumber?: number;
  order?: number;
  id?: number;
  advancedPhotoId?: number;
}

@Component({
  selector: 'app-report-detail',
  standalone: false,
  templateUrl: './report-detail.component.html',
  styleUrls: ['./report-detail.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReportDetailComponent implements OnInit, AfterViewInit, AfterViewChecked {
  public reportId: string;
  public clientId: string;
  public projectId: string;
  public report: any = null;
  public loading: boolean = true;
  public error: boolean = false;
  public selectedPhotoIndex: number = 0;
  public galleryImages: GalleryItem[] = [];

  // Galleria configuration
  public position: string = 'bottom';
  // public responsiveOptions: any[] = [
  //   {
  //     breakpoint: '1024px',
  //     numVisible: 4,
  //   },
  //   {
  //     breakpoint: '768px',
  //     numVisible: 3,
  //   },
  //   {
  //     breakpoint: '560px',
  //     numVisible: 2,
  //   },
  // ];

  public questionAnswers: { [questionId: number]: any } = {};
  public questionOptions: { [questionId: number]: string[] } = {};
  public filteredQuestionOptions: { [questionId: number]: string[] } = {};

  public clientMessageContent: string = '';
  public sendingClientMessage = false;

  // Scroll container
  @ViewChild('clientScrollContainer', { static: false }) clientScrollContainer!: ElementRef;
  private shouldScroll = false;
  private isFromNotification = false; // Track if coming from notification page

  // Dialog state for export feedback
  csvDialogVisible: boolean = false;
  csvDialogIsError: boolean = false;
  dialogMessage: string = '';

  // Status Change Confirmation Dialog
  confirmationDialogVisible: boolean = false;
  pendingStatus: string = '';

  // Accordion active value - set all panels open by default
  public activeAccordionValue: string[] = ['0', '1', '3'];

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  // Track referrer for navigation
  private referrer: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private reportService: ReportService,
    private notificationsService: NotificationsService,
    private projectsStateService: ProjectsStateService,
    private toastService: HotToastService,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  goBack(): void {
    if (this.canGoBack) {
      this.location.back();
    }
  }

  public ngOnInit(): void {
    // For projects module routes, we don't have clientSlug, only projectId
    this.clientId = this.route.snapshot.paramMap.get('clientSlug'); // Will be null for projects routes
    this.projectId = this.route.snapshot.paramMap.get('projectSlug') || this.route.snapshot.paramMap.get('projectId');
    // Extract reportId and clean it (remove any query parameters that might be accidentally included)
    const rawReportId = this.route.snapshot.paramMap.get('reportID');
    this.reportId = rawReportId ? rawReportId.split('?')[0].split('/')[0] : null;

    // Get referrer from query params
    this.referrer = this.route.snapshot.queryParamMap.get('referrer') || '';

    // Check if coming from notification - open Dialog accordion
    const openDialog = this.route.snapshot.queryParamMap.get('openDialog');
    this.isFromNotification = openDialog === 'true';

    if (this.isFromNotification) {
      // Ensure Dialog panel (value='3') is in activeAccordionValue
      if (!this.activeAccordionValue.includes('3')) {
        this.activeAccordionValue = [...this.activeAccordionValue, '3'];
      }
    }

    // Check if coming from notification and mark as seen
    if (this.referrer === 'notifications') {
      const notificationId = this.route.snapshot.queryParamMap.get('notificationId');
      if (notificationId) {
        this.notificationsService.markSeen(parseInt(notificationId, 10)).subscribe({
          error: (err) => console.error('Error marking notification as seen:', err),
        });
      }
    }

    this.loadReportDetails();

    if (this.isFromNotification) {
      // Execute immediately without initial delay
      const performInitScroll = () => {
        const scrollContainer = document.querySelector('main > div.overflow-y-auto');
        if (scrollContainer) {
          const scrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        } else {
          const anyScrollContainer = document.querySelector('.overflow-y-auto');
          if (anyScrollContainer) {
            const scrollHeight = anyScrollContainer.scrollHeight;
            anyScrollContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
          } else {
            const scrollHeight = document.body.scrollHeight;
            window.scrollTo({ top: scrollHeight, behavior: 'smooth' });
          }
        }
      };

      performInitScroll();
      setTimeout(performInitScroll, 100);
      setTimeout(performInitScroll, 500);
    }
  }

  ngAfterViewInit() {
    // Scroll after initial render - wait for accordion and DOM to be ready
    // Only scroll if coming from notification page
    if (this.isFromNotification) {
      setTimeout(() => this.scrollToBottom(), 300);
    }
  }

  onAccordionPanelOpen(event: any) {
    // When accordion panel opens, scroll to bottom after a delay to ensure DOM is ready
    // Only scroll if coming from notification page and Dialog panel (value='3') is being opened
    if (this.isFromNotification && event && Array.isArray(event) && event.includes('3')) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 200);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom() {
    // Try scrolling multiple times with increasing delays to ensure DOM is fully rendered
    const tryScroll = (delay: number) => {
      setTimeout(() => {
        if (this.clientScrollContainer?.nativeElement) {
          const element = this.clientScrollContainer.nativeElement;
          // Force scroll to bottom
          element.scrollTop = element.scrollHeight;
        }
      }, delay);
    };

    // Try multiple times with increasing delays to catch DOM updates
    tryScroll(0);
    tryScroll(100);
    tryScroll(200);
    tryScroll(300);
  }

  private triggerScrollToBottom() {
    this.shouldScroll = true;
  }

  private dedupeUploadedAdvancedPhotosForSlots(photos: any[]): any[] {
    const seenRowIds = new Set<number>();
    const seenSlots = new Set<string>();
    const result: any[] = [];

    for (const photo of (photos || [])) {
      const rowId = Number(photo?.id);
      if (Number.isFinite(rowId)) {
        if (seenRowIds.has(rowId)) continue;
        seenRowIds.add(rowId);
      }

      const advancedPhotoId = photo?.advancedPhoto?.id ?? '';
      const beforeAfterType = photo?.beforeAfterType ?? '';
      const labelPart = String(photo?.label ?? '').trim();
      const slotKey = labelPart ? `${advancedPhotoId}|${beforeAfterType}|${labelPart}` : `${advancedPhotoId}|${beforeAfterType}|__empty__|${photo?.order ?? 0}`;

      if (seenSlots.has(slotKey)) continue;
      seenSlots.add(slotKey);
      result.push(photo);
    }

    return result;
  }

  public loadReportDetails(): void {
    console.log('📄 [ReportDetail] loadReportDetails - Starting, loading set to true');
    this.loading = true;
    this.error = false;

    // Try to load from state first
    const cachedState = this.projectsStateService.getStateSnapshot();
    if (cachedState && cachedState.projects) {
      let cachedReport = null;

      // Try to find in the specific project if we have projectId
      if (this.projectId) {
        const project = cachedState.projects.find((p) => p.id === this.projectId || p.slug === this.projectId);
        if (project && project.reports) {
          cachedReport = project.reports.find((r: any) => r.id === this.reportId);
        }
      }

      // If not found in specific project, search all projects
      if (!cachedReport) {
        for (const project of cachedState.projects) {
          if (project.reports) {
            const found = project.reports.find((r: any) => r.id === this.reportId);
            if (found) {
              cachedReport = found;
              break;
            }
          }
        }
      }

      if (cachedReport) {
        console.log('✅ [ReportDetail] Report loaded from cache:', cachedReport.id);
        this.processReportData(cachedReport);
        this.loading = false;
        console.log('📄 [ReportDetail] loading set to false (cache)');
        // Optionally fetch fresh data in background if needed, but for now we trust the cache
        // If we want to refresh, we can call the API silently here
        return;
      }
    }

    console.log('📄 [ReportDetail] Cache miss, calling API...');
    this.reportService.getReportById(this.reportId).subscribe({
      next: (data) => {
        console.log('📄 [ReportDetail] API response received');
        try {
          this.processReportData(data);
          console.log('📄 [ReportDetail] Data processed successfully');
        } catch (error) {
          console.error('❌ [ReportDetail] Error processing data:', error);
          this.error = true;
        } finally {
          this.loading = false;
          console.log('📄 [ReportDetail] loading set to false (API success)');
        }
      },
      error: (err) => {
        console.error('❌ [ReportDetail] Error loading report details:', err);
        this.error = true;
        this.loading = false;
        console.log('📄 [ReportDetail] loading set to false (API error)');

        // Check if it's a 403 Forbidden error (permission denied)
        if (err.status === 403) {
          this.toastService.error('Sie haben keine Berechtigung, diesen Bericht anzuzeigen.', {
            position: 'bottom-right',
            duration: 3000,
          });
          this.router.navigate(this.referrer === 'notifications' ? ['/notifications'] : ['/projects']);
        } else {
          this.toastService.error('Fehler beim Laden des Berichts.', {
            position: 'bottom-right',
            duration: 3000,
          });
        }
      },
    });
  }

  private processReportData(data: any): void {
    this.report = data;
    if (!this.report.project) this.report.project = {};
    if (!this.report.project.questions) this.report.project.questions = [];
    if (!this.report.photos && this.report.project.photos) this.report.photos = this.report.project.photos;
    if (!this.report.conversation) this.report.conversation = { messages: [] };

    // Extract label number from label string (e.g., "Bezeichnung 1" -> 1)
    const extractLabelNumber = (label: string): number => {
      const match = label?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999;
    };

    // Map photos to gallery items
    const normalizedUploadedPhotos = this.dedupeUploadedAdvancedPhotosForSlots(this.report.uploadedAdvancedPhotos || []);
    this.report.uploadedAdvancedPhotos = normalizedUploadedPhotos;
    const allGalleryItems = normalizedUploadedPhotos.map((photo: any) => ({
      itemImageSrc: photo.file.path,
      thumbnailImageSrc: photo.file.path,
      title: photo.label,
      beforeAfterType: photo.beforeAfterType,
      alt: photo.label,
      date: photo.createdAt,
      labelNumber: extractLabelNumber(photo.label),
      order: photo.order || 0,
      id: photo.id,
      advancedPhotoId: photo.advancedPhoto?.id,
    }));

    // Sort order matches HeadOffice: advancedPhoto section → before/after → order → id
    this.galleryImages = allGalleryItems.sort((a, b) => {
      const sectionA = Number(a.advancedPhotoId) || 0;
      const sectionB = Number(b.advancedPhotoId) || 0;
      if (sectionA !== sectionB) return sectionA - sectionB;

      const sideA = a.beforeAfterType === 'before' ? 0 : 1;
      const sideB = b.beforeAfterType === 'before' ? 0 : 1;
      if (sideA !== sideB) return sideA - sideB;

      return (a.order || 0) - (b.order || 0) || (a.id || 0) - (b.id || 0);
    });

    this.processConversationMessages();
    this.initializeQuestionData();

    // Scroll to bottom after messages are loaded and DOM is updated
    // Only scroll if coming from notification page
    if (this.isFromNotification) {
      setTimeout(() => {
        this.scrollToBottom();

        // Try a sequence of scrolls to handle progressive loading/rendering
        const performScroll = () => {
          setTimeout(() => {
            // Try to find the specific scrollable container
            // The main content area in the shell component has overflow-y-auto
            const scrollContainer = document.querySelector('main > div.overflow-y-auto');

            if (scrollContainer) {
              const scrollHeight = scrollContainer.scrollHeight;
              scrollContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
            } else {
              // Fallback to searching for any overflow-y-auto container
              const anyScrollContainer = document.querySelector('.overflow-y-auto');
              if (anyScrollContainer) {
                const scrollHeight = anyScrollContainer.scrollHeight;
                anyScrollContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
              } else {
                // Last resort: window/body scroll
                const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight);
                window.scrollTo({ top: scrollHeight, behavior: 'smooth' });
              }
            }
          }, 0);
        };

        // Execute immediately
        performScroll();
        // Follow up checks for dynamic content
        setTimeout(performScroll, 100);
        setTimeout(performScroll, 300);
        setTimeout(performScroll, 800);
      }, 400);
    }
  }

  initializeQuestionData(): void {
    if (!this.report?.project?.questions) return;
    this.report.project.questions.forEach((question: any) => {
      const questionId = question.id;
      this.questionOptions[questionId] = question.options?.map((option: any) => option.optionText) || [];
      this.filteredQuestionOptions[questionId] = [...this.questionOptions[questionId]];
      this.questionAnswers[questionId] = '';
    });
  }

  processConversationMessages(): void {
    if (!this.report?.conversation?.messages) {
      this.report.clientMessages = [];
      return;
    }
    const messages = this.report.conversation.messages;
    this.report.clientMessages = messages
      .filter((msg: any) => {
        const sender = msg.senderType?.name;
        const receiverStr = msg.receiverTypeString;
        return (
          (sender === 'akzente' && (msg.receiverType?.name === 'client' || receiverStr === 'client')) || (sender === 'client' && (msg.receiverType?.name === 'akzente' || receiverStr === 'akzente'))
        );
      })
      .map((msg: any) => {
        const isClientOrigin = msg.senderType?.name === 'client' || msg.receiverTypeString === 'akzente';
        // Reverse placement: client-origin messages will be marked as 'agent', akzente-origin as 'client'
        const mappedSender = isClientOrigin ? 'agent' : 'client';
        const senderName = msg.senderType?.name === 'akzente' ? 'Akzente' : `${msg.senderFirstName} ${msg.senderLastName}`;
        return {
          date: new Date(msg.createdAt).toLocaleDateString('de-DE'),
          sender: mappedSender,
          senderName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderFirstName + ' ' + msg.senderLastName)}`,
          time: new Date(msg.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          text: msg.content,
        };
      })
      .sort((a: any, b: any) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime());

    // Trigger scroll after messages are processed - only if coming from notification
    if (this.isFromNotification) {
      this.triggerScrollToBottom();
    }
  }

  public selectPhoto(index: number): void {
    this.selectedPhotoIndex = index;
  }

  public nextPhoto(): void {
    this.selectedPhotoIndex = (this.selectedPhotoIndex + 1) % this.report.photos.length;
  }

  public prevPhoto(): void {
    this.selectedPhotoIndex = (this.selectedPhotoIndex - 1 + this.report.photos.length) % this.report.photos.length;
  }

  public updateStatus(status: string): void {
    // Prevent any status changes if report is already closed
    if (this.isReportClosed()) {
      this.toastService.warning('Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    // If status is UngeprüfT and it's before Prüfen, show warning
    if (status === 'UngeprüfT' && !this.canUserApprove()) {
      console.log('UngeprüfT');
      console.log(status === 'UngeprüfT');
      console.log(this.canUserApprove());
      this.toastService.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Check if user can approve (sequential approval logic)
    if (status === 'Freigegeben' && !this.canUserApprove()) {
      console.log('Freigegeben');
      console.log(status === 'Freigegeben');
      console.log(this.canUserApprove());
      this.toastService.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Only allow "Freigegeben" status changes, "UngeprüfT" is just for display
    if (status === 'Freigegeben') {
      this.pendingStatus = status;
      this.confirmationDialogVisible = true;
    }
  }

  public confirmStatusUpdate(): void {
    if (this.pendingStatus === 'Freigegeben') {
      this.closeReport();
    }
    this.confirmationDialogVisible = false;
    this.pendingStatus = '';
  }

  private closeReport(): void {
    if (!this.report || !this.reportId) return;

    this.reportService
      .closeReport(this.reportId)
      .pipe(
        catchError((error) => {
          console.error('❌ Error updating report status:', error);

          // Handle specific error cases
          if (error.error?.message?.includes('already closed')) {
            this.toastService.warning('Dieser Bericht ist bereits geschlossen', {
              position: 'bottom-right',
              duration: 3000,
            });
          } else {
            this.toastService.error('Fehler beim Aktualisieren des Status', {
              position: 'bottom-right',
              duration: 4000,
            });
          }
          return of(null);
        }),
      )
      .subscribe({
        next: (response) => {
          if (response) {
            console.log('✅ Report closed successfully:', response);
            // Update the entire report object with the response
            this.report = response;
            this.toastService.success('Bericht erfolgreich geschlossen', {
              position: 'bottom-right',
              duration: 2000,
            });
          }
        },
      });
  }

  isStatusOpen(): boolean {
    return !isClientReportClosed(this.report?.status);
  }

  isReportClosed(): boolean {
    return isClientReportClosed(this.report?.status);
  }

  canUserApprove(): boolean {
    return canClientApproveReport(this.report?.status);
  }

  public onFavoriteChanged(newStatus: boolean, report: any): void {
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;
    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (result) => {
        if (result) {
          report.isFavorite = result.isFavorite;
          if (report.isFavorite) {
            this.toastService.success('Zu Favoriten hinzugefügt', {
              position: 'bottom-right',
              duration: 3000,
            });
          } else {
            this.toastService.success('Aus Favoriten entfernt', {
              position: 'bottom-right',
              duration: 3000,
            });
          }
        }
      },
      error: () => {
        report.isFavorite = previousStatus;
        this.toastService.error('Fehler beim Aktualisieren des Favoritenstatus', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
    });
  }

  public sendClientMessage() {
    const content = this.clientMessageContent.trim();
    if (!content) return;
    this.sendingClientMessage = true;
    this.reportService.sendMessage(this.reportId, { content, receiverType: 'akzente' }).subscribe({
      next: (response) => {
        this.clientMessageContent = '';
        if (response && response.conversation) {
          this.report.conversation = response.conversation;
          this.processConversationMessages();
          // Scroll to bottom after new message is added and DOM is updated
          setTimeout(() => this.scrollToBottom(), 300);
        }
        this.sendingClientMessage = false;
      },
      error: () => {
        this.sendingClientMessage = false;
      },
    });
  }

  public getAnswerForQuestion(questionId: number) {
    if (!this.report || !this.report.answers) return null;
    return this.report.answers.find((a: any) => a.question && a.question.id === questionId) || null;
  }

  public getMultiAnswersForQuestion(questionId: number): string {
    if (!this.report || !this.report.answers) return '';
    const answers = this.report.answers.filter((a: any) => a.question && a.question.id === questionId && a.selectedOption);
    return answers.map((a: any) => a.selectedOption.optionText).join(', ');
  }

  downloadSingleReportExcel(): void {
    this.reportService.exportSingleReportAsExcel(this.reportId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Report_${this.reportId}_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        this.dialogMessage = 'Excel-Export erfolgreich heruntergeladen';
        this.csvDialogIsError = false;
        this.csvDialogVisible = true;
      },
      error: (error) => {
        console.error('Error downloading Excel:', error);
        this.dialogMessage = 'Excel-Export fehlgeschlagen!';
        this.csvDialogIsError = true;
        this.csvDialogVisible = true;
      },
    });
  }

  /**
   * Generate formatted address string for a report
   * Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
   */
  getFormattedAddress(report: any): string {
    if (!report) return '';

    // Street + House Number (already combined in report.street)
    const street = report.street || '';

    // ZIP Code
    const zip = report.zipCode || '';

    // City
    let city = '';
    if (report.branch) {
      if (report.branch.city && report.branch.city.name) {
        city = report.branch.city.name;
      } else {
        city = report.branch.name || '';
      }
    }

    // Country
    let country = '';
    if (report.branch && report.branch.city && report.branch.city.country) {
      const countryObj = report.branch.city.country;
      country = countryObj.name?.de || countryObj.name || '';
    }

    // Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
    const parts = [street, zip, city, country].filter(Boolean);
    return parts.join(', ');
  }
}
