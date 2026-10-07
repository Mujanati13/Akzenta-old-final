import { Component, OnInit, ViewEncapsulation, AfterViewInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ReportService } from '@app/@core/services/report.service';
import { ClientService } from '@app/@core/services/client.service';
import { NotificationsService } from '@app/core/services/notifications.service';
import { HotToastService } from '@ngneat/hot-toast';
import { catchError, of } from 'rxjs';
import { ReportStatusEnum } from '@app/@core/enums/status.enum';
import { isPendingMerchandiserAcceptance } from '@app/@core/utils/report-merchandiser-status.util';
import { sortUploadedAdvancedPhotos } from '../../../shared/constants/report-photo-upload.constants';

interface GalleryItem {
  itemImageSrc: string;
  thumbnailImageSrc: string;
  title: string;
  alt: string;
  beforeAfterType?: string;
  date?: Date | string;
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
  public responsiveOptions: any[] = [
    {
      breakpoint: '1024px',
      numVisible: 4,
    },
    {
      breakpoint: '768px',
      numVisible: 3,
    },
    {
      breakpoint: '560px',
      numVisible: 2,
    },
  ];

  public questionAnswers: { [questionId: number]: any } = {};
  public questionOptions: { [questionId: number]: string[] } = {};
  public filteredQuestionOptions: { [questionId: number]: string[] } = {};

  // Field visibility settings
  public showIsSpecCompliant: boolean = false;
  public showFeedback: boolean = false;

  public clientMessageContent: string = '';
  public merchandiserMessageContent: string = '';
  public sendingClientMessage = false;
  public sendingMerchandiserMessage = false;

  // Scroll containers
  @ViewChild('clientScrollContainer', { static: false }) clientScrollContainer!: ElementRef;
  @ViewChild('merchandiserScrollContainer', { static: false }) merchandiserScrollContainer!: ElementRef;
  private shouldScrollClient = false;
  private shouldScrollMerchandiser = false;

  // Dialog state for export feedback
  csvDialogVisible: boolean = false;
  csvDialogIsError: boolean = false;
  dialogMessage: string = '';
  public downloadingExcel = false;

  // Accordion active value - set all panels open by default
  public activeAccordionValue: string[] = ['0', '1', '2'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private reportService: ReportService,
    private notificationsService: NotificationsService,
    private toastService: HotToastService,
    private clientService: ClientService,
  ) {}

  goBack(): void {
    this.location.back();
  }

  public ngOnInit(): void {
    // Extract route parameters - using clientId instead of clientSlug for ID-based routing
    this.clientId = this.route.snapshot.paramMap.get('clientId');
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    // Extract reportId and clean it (remove any query parameters that might be accidentally included)
    const rawReportId = this.route.snapshot.paramMap.get('reportID');
    this.reportId = rawReportId ? rawReportId.split('?')[0].split('/')[0] : null;

    // Initialize arrays to prevent template errors
    this.galleryImages = [];
    this.report = null;

    // Ensure field visibility settings are unselected by default
    this.showIsSpecCompliant = false;
    this.showFeedback = false;

    // Check if coming from notification - open Dialog accordion
    const openDialog = this.route.snapshot.queryParamMap.get('openDialog');
    if (openDialog === 'true') {
      // Ensure Dialog panel (value='2') is in activeAccordionValue for Merchandiser
      if (!this.activeAccordionValue.includes('2')) {
        this.activeAccordionValue = [...this.activeAccordionValue, '2'];
      }
    }

    // Check if coming from notification and mark as seen
    const referrer = this.route.snapshot.queryParamMap.get('referrer') || this.route.snapshot.queryParamMap.get('reference');
    if (referrer === 'notifications') {
      const notificationId = this.route.snapshot.queryParamMap.get('notificationId');
      if (notificationId) {
        this.notificationsService.markSeen(parseInt(notificationId, 10)).subscribe({
          error: (err) => console.error('Error marking notification as seen:', err),
        });
      }
    }

    this.syncNavigationContextFromRoute();
    this.loadReportDetails();

    if (openDialog === 'true') {
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
    setTimeout(() => this.scrollToBottom(), 300);
  }

  ngAfterViewChecked() {
    if (this.shouldScrollClient || this.shouldScrollMerchandiser) {
      this.scrollToBottom();
      this.shouldScrollClient = false;
      this.shouldScrollMerchandiser = false;
    }
  }

  private scrollToBottom() {
    // Try scrolling multiple times with increasing delays to ensure DOM is fully rendered
    const tryScroll = (delay: number, container: ElementRef | null) => {
      setTimeout(() => {
        if (container?.nativeElement) {
          const element = container.nativeElement;
          // Force scroll to bottom
          element.scrollTop = element.scrollHeight;
        }
      }, delay);
    };

    // Try multiple times with increasing delays to catch DOM updates
    if (this.shouldScrollClient) {
      tryScroll(0, this.clientScrollContainer);
      tryScroll(100, this.clientScrollContainer);
      tryScroll(200, this.clientScrollContainer);
      tryScroll(300, this.clientScrollContainer);
    }
    if (this.shouldScrollMerchandiser) {
      tryScroll(0, this.merchandiserScrollContainer);
      tryScroll(100, this.merchandiserScrollContainer);
      tryScroll(200, this.merchandiserScrollContainer);
      tryScroll(300, this.merchandiserScrollContainer);
    }
  }

  private triggerScrollToBottom(container: 'client' | 'merchandiser' = 'client') {
    if (container === 'client') {
      this.shouldScrollClient = true;
    } else {
      this.shouldScrollMerchandiser = true;
    }
  }

  onAccordionPanelOpen(event: any): void {
    // Handle accordion panel open event if needed
    // This can be used to scroll to bottom when dialog panel opens
    if (event && event.value && event.value.includes('2')) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
    }
  }

  /** Same rules as API: one row per (advancedPhoto, before/after, label); oldest id wins. */
  private dedupeUploadedAdvancedPhotosForSlots(photos: any[]): any[] {
    const sorted = [...(photos || [])].sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
    const seenRowIds = new Set<number>();
    const seenSlots = new Set<string>();
    const result: any[] = [];

    for (const photo of sorted) {
      const rowId = Number(photo?.id);
      if (Number.isFinite(rowId)) {
        if (seenRowIds.has(rowId)) {
          continue;
        }
        seenRowIds.add(rowId);
      }

      const advancedPhotoId = photo?.advancedPhoto?.id ?? '';
      const beforeAfterType = photo?.beforeAfterType ?? '';
      const labelPart = String(photo?.label ?? '').trim();
      const slotKey = labelPart ? `${advancedPhotoId}|${beforeAfterType}|${labelPart}` : `${advancedPhotoId}|${beforeAfterType}|__empty__|${photo?.order ?? 0}`;

      if (seenSlots.has(slotKey)) {
        continue;
      }
      seenSlots.add(slotKey);
      result.push(photo);
    }

    return result;
  }

  private buildGalleryImagesFromUploads(uploadedAdvancedPhotos: any[]): GalleryItem[] {
    return sortUploadedAdvancedPhotos(uploadedAdvancedPhotos)
      .filter((photo) => String(photo?.file?.path || '').trim())
      .map((photo: any) => ({
        itemImageSrc: photo.file?.path || '',
        thumbnailImageSrc: photo.file?.path || '',
        title: photo.label || '',
        beforeAfterType: photo.beforeAfterType || 'before',
        alt: photo.label || '',
        date: photo.createdAt || new Date(),
      }));
  }

  public loadReportDetails(): void {
    this.loading = true;
    this.error = false;
    this.reportService.getReportById(this.reportId).subscribe({
      next: (data) => {
        this.report = data;

        // Ensure proper data structure initialization
        if (!this.report) {
          this.report = {};
        }
        if (!this.report.project) this.report.project = {};
        if (!this.report.project.questions) this.report.project.questions = [];
        if (!this.report.photos && this.report.project.photos) this.report.photos = this.report.project.photos;
        if (!this.report.conversation) this.report.conversation = { messages: [] };
        if (!this.report.merchandiserMessages) this.report.merchandiserMessages = [];
        if (!this.report.clientMessages) this.report.clientMessages = [];

        this.report.uploadedAdvancedPhotos = this.dedupeUploadedAdvancedPhotosForSlots(this.report.uploadedAdvancedPhotos || []);
        this.galleryImages = this.buildGalleryImagesFromUploads(this.report.uploadedAdvancedPhotos);

        this.syncRouteIdsFromReport();
        this.syncNavigationContext();

        this.processConversationMessages();
        this.initializeQuestionData();
        this.loading = false;

        // Scroll to bottom after messages are loaded and DOM is updated
        setTimeout(() => {
          this.scrollToBottom();

          const openDialog = this.route.snapshot.queryParamMap.get('openDialog');
          if (openDialog === 'true') {
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
          }
        }, 400);
      },
      error: (error) => {
        console.error('Error loading report details:', error);
        this.error = true;
        this.loading = false;

        // Check if it's a 403 Forbidden error (permission denied)
        if (error.status === 403) {
          this.toastService.error('Sie haben keine Berechtigung, diesen Bericht anzuzeigen.', {
            position: 'bottom-right',
            duration: 3000,
          });
          this.router.navigate(['/dashboard']);
        } else {
          this.toastService.error('Fehler beim Laden des Berichts.', {
            position: 'bottom-right',
            duration: 3000,
          });
        }

        // Initialize empty report structure for graceful degradation
        this.report = {
          project: { questions: [] },
          merchandiserMessages: [],
          conversation: { messages: [] },
        };
        this.galleryImages = [];
      },
    });
  }

  private syncRouteIdsFromReport(): void {
    const companyId = this.report?.clientCompany?.id;
    const projectId = this.report?.project?.id;

    if (companyId) {
      this.clientId = String(companyId);
    }
    if (projectId) {
      this.projectId = String(projectId);
    }
  }

  private syncNavigationContextFromRoute(): void {
    if (!this.clientId || !this.projectId) {
      return;
    }

    this.clientService.getClientById(this.clientId);
    this.clientService.syncReportSidebarContext(this.clientId, this.projectId);
  }

  private syncNavigationContext(): void {
    const companyId = this.report?.clientCompany?.id?.toString() || this.clientId;
    const projectId = this.report?.project?.id?.toString() || this.projectId;

    if (!companyId || !projectId) {
      return;
    }

    this.clientService.getClientById(companyId);
    this.clientService.syncReportSidebarContext(companyId, projectId, {
      clientName: this.report?.clientCompany?.name,
      projectName: this.report?.project?.name,
    });
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
      this.report.merchandiserMessages = [];
      this.report.clientMessages = [];
      return;
    }
    const messages = this.report.conversation.messages;
    console.log('🔄 Processing conversation messages:', messages);

    // Process client messages (between akzente and client)
    this.report.clientMessages = messages
      .filter((msg: any) => {
        const sender = msg.senderType?.name;
        const receiverStr = msg.receiverTypeString;
        const isValidMessage =
          (sender === 'akzente' && (msg.receiverType?.name === 'client' || receiverStr === 'client')) || (sender === 'client' && (msg.receiverType?.name === 'akzente' || receiverStr === 'akzente'));
        return isValidMessage;
      })
      .map((msg: any) => {
        const sender = msg.senderType?.name;
        return {
          text: msg.content || '',
          sender: sender === 'client' ? 'client' : 'akzente',
          senderName: msg.sender?.firstName && msg.sender?.lastName ? `${msg.sender.firstName} ${msg.sender.lastName}` : msg.sender?.email || 'Unknown',
          avatar: msg.sender?.avatar?.path || '/images/placeholder.png',
          date: msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('de-DE') : '',
          dateLabel: msg.createdAt ? this.formatDateLabel(new Date(msg.createdAt)) : '',
          timeLabel: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
        };
      });

    // Process merchandiser messages (between akzente and merchandiser)
    this.report.merchandiserMessages = messages
      .filter((msg: any) => {
        const sender = msg.senderType?.name;
        const receiverStr = msg.receiverTypeString;
        const isValidMessage =
          (sender === 'akzente' && (msg.receiverType?.name === 'merchandiser' || receiverStr === 'merchandiser')) ||
          (sender === 'merchandiser' && (msg.receiverType?.name === 'akzente' || receiverStr === 'akzente'));
        console.log('📝 Message filter:', { sender, receiverStr, isValidMessage, msg });
        return isValidMessage;
      })
      .map((msg: any) => {
        const isMerchandiserOrigin = msg.senderType?.name === 'merchandiser' || msg.receiverTypeString === 'akzente';
        // Reverse placement: merchandiser-origin messages will be marked as 'merchandiser', akzente-origin as 'client'
        const mappedSender = isMerchandiserOrigin ? 'merchandiser' : 'client';
        const senderName = msg.senderType?.name === 'akzente' ? 'Akzente' : `${msg.senderFirstName} ${msg.senderLastName}`;
        const processedMessage = {
          date: new Date(msg.createdAt).toLocaleDateString('de-DE'),
          sender: mappedSender,
          senderName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderFirstName + ' ' + msg.senderLastName)}`,
          time: new Date(msg.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          text: msg.content,
        };
        console.log('✅ Processed message:', processedMessage);
        return processedMessage;
      })
      .sort((a: any, b: any) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime());

    console.log('📤 Final merchandiser messages:', this.report.merchandiserMessages);
    console.log('📤 Final client messages:', this.report.clientMessages);

    // Trigger scroll after messages are processed
    this.triggerScrollToBottom('client');
    this.triggerScrollToBottom('merchandiser');
  }

  private formatDateLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) {
      return 'Heute';
    } else if (this.isSameDay(date, yesterday)) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
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

  public onFavoriteChanged(newStatus: boolean, report: any): void {
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;
    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (result) => {
        if (result) {
          report.isFavorite = result.isFavorite;
        }
      },
      error: () => {
        report.isFavorite = previousStatus;
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
          this.triggerScrollToBottom('client');
          setTimeout(() => this.scrollToBottom(), 300);
        }
        this.sendingClientMessage = false;
      },
      error: () => {
        this.sendingClientMessage = false;
      },
    });
  }

  public sendMerchandiserMessage() {
    const content = this.merchandiserMessageContent.trim();
    if (!content) return;
    this.sendingMerchandiserMessage = true;
    this.reportService.sendMessage(this.reportId, { content, receiverType: 'merchandiser' }).subscribe({
      next: (response) => {
        this.merchandiserMessageContent = '';
        if (response && response.conversation) {
          this.report.conversation = response.conversation;
          this.processConversationMessages();
          // Scroll to bottom after new message is added and DOM is updated
          this.triggerScrollToBottom('merchandiser');
          setTimeout(() => this.scrollToBottom(), 300);
        }
        this.sendingMerchandiserMessage = false;
      },
      error: () => {
        this.sendingMerchandiserMessage = false;
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
    if (this.downloadingExcel) return;
    this.downloadingExcel = true;
    this.reportService.exportSingleReportAsExcel(this.reportId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Report_${this.reportId}_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        this.downloadingExcel = false;
        this.dialogMessage = 'Excel-Export erfolgreich heruntergeladen';
        this.csvDialogIsError = false;
        this.csvDialogVisible = true;
      },
      error: (error) => {
        console.error('Error downloading Excel:', error);
        this.downloadingExcel = false;
        this.dialogMessage = 'Excel-Export fehlgeschlagen!';
        this.csvDialogIsError = true;
        this.csvDialogVisible = true;
      },
    });
  }

  // Helper method to determine if status should show as "UngeprüfT"
  isStatusOpen(): boolean {
    if (!this.report?.status?.name) return true;
    const statusName = this.report.status.name;
    return !['Im Prüfen', 'Ok'].includes(statusName);
  }

  // Helper method to determine if report is closed (cannot be changed)
  isReportClosed(): boolean {
    if (!this.report?.status?.name) return false;
    const statusName = this.report.status.name;
    return ['Im Prüfen', 'Ok'].includes(statusName);
  }

  updateStatus(status: string): void {
    // Prevent any status changes if report is already closed
    if (this.isReportClosed()) {
      this.toastService.warning('Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    // Prevent status changes while report is still assigned/anfrage
    if (this.isAwaitingAssignmentAcceptance()) {
      this.toastService.warning('Status kann erst nach Annahme der Anfrage geändert werden', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    // Only allow "Freigegeben" status changes, "UngeprüfT" is just for display
    if (status === 'Freigegeben') {
      this.closeReport();
    }
  }

  isAwaitingAssignmentAcceptance(): boolean {
    return isPendingMerchandiserAcceptance(this.report);
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
          } else if (error.error?.message?.includes('can only close reports')) {
            this.toastService.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
              position: 'bottom-right',
              duration: 4000,
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
