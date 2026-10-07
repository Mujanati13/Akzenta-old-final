import { Component, OnInit, ViewEncapsulation, AfterViewInit, AfterViewChecked, ViewChild, ElementRef, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { ReportService } from '@app/core/services/report.service';
import { NotificationsService } from '@app/core/services/notifications.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of, Subscription } from 'rxjs';
import { ClientService } from '@app/@core/services/client.service';
import { ReportCacheService } from '@app/core/services/report-cache.service';
import { getVisibleProjectQuestions, getVisibleQuestionOptionTexts } from '@app/@core/utils/project-question.util';
import { canAkzenteAccessReport, canAkzenteApproveReport, isAkzenteReportClosed } from '@app/@core/utils/report-akzente-status.util';
import { sortUploadedAdvancedPhotos } from '@app/shared/constants/report-photo-upload.constants';

interface GalleryItem {
  itemImageSrc: string;
  thumbnailImageSrc: string;
  title: string;
  alt: string;
  beforeAfterType?: string;
  date?: string;
  labelNumber?: number;
  order?: number;
  advancedPhotoId?: number;
}

@Component({
  selector: 'app-report-detail',
  standalone: false,
  templateUrl: './report-detail.component.html',
  styleUrls: ['./report-detail.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReportDetailComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  reportId: string;
  clientId: string;
  projectId: string;
  report: any = null;
  loading: boolean = true;
  error: boolean = false;
  selectedPhotoIndex: number = 0;
  galleryImages: GalleryItem[] = [];
  showConfirmStatusDialog: boolean = false;
  pendingStatusChange: string | null = null;

  // Galleria configuration
  position: string = 'bottom';
  // Gallery display mode retained for compatibility; gallery always follows report order.
  galleryDisplayMode: 'project' | 'before-first' | 'alternate' = 'project';
  responsiveOptions: any[] = [
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

  downloadingExcel: boolean = false;

  questionAnswers: { [questionId: number]: any } = {};
  questionOptions: { [questionId: number]: string[] } = {};
  filteredQuestionOptions: { [questionId: number]: string[] } = {};

  // Dialog state for export feedback
  csvDialogVisible: boolean = false;
  csvDialogIsError: boolean = false;
  dialogMessage: string = '';

  private returnToProjectQueryParams: Record<string, any> = {};
  private referrer: string = '';
  private routeParamsSubscription?: Subscription;
  private readonly reportCacheService = inject(ReportCacheService);

  private invalidateProjectReportCache(): void {
    const projectId = this.report?.project?.id || this.projectId;
    if (projectId) {
      this.reportCacheService.invalidate(projectId);
    }
  }

  private extractQueryParams(paramMap: ParamMap): Record<string, any> {
    const params: Record<string, any> = {};

    paramMap.keys.forEach((key) => {
      const values = paramMap
        .getAll(key)
        .map((value) => value?.trim())
        .filter((value): value is string => !!value && value !== 'null');

      if (values.length > 1) {
        params[key] = values;
      } else if (values.length === 1) {
        params[key] = values[0];
      }
    });

    return params;
  }

  private cleanNavigationQueryParams(params: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        const filtered = value.map((entry) => (typeof entry === 'string' ? entry.trim() : entry)).filter((entry) => entry !== undefined && entry !== null && entry !== '' && entry !== 'null');

        if (filtered.length > 0) {
          cleaned[key] = filtered;
        }
        return;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed !== '' && trimmed !== 'null') {
          cleaned[key] = trimmed;
        }
        return;
      }

      cleaned[key] = value;
    });

    return cleaned;
  }

  navigateBackToProject(): void {
    // Navigate back based on referrer
    switch (this.referrer) {
      case 'favorites':
        this.router.navigate(['/favorites']);
        break;
      case 'notifications':
        this.router.navigate(['/notifications']);
        break;
      case 'dashboard':
        this.router.navigate(['/dashboard']);
        break;
      case 'client-detail':
        // Navigate to client detail
        if (!this.clientId) {
          return;
        }
        const clientParams = this.cleanNavigationQueryParams({
          ...this.returnToProjectQueryParams,
        });
        // Remove referrer from params when navigating back
        delete clientParams['referrer'];
        const clientExtras: any = {};
        if (Object.keys(clientParams).length > 0) {
          clientExtras.queryParams = clientParams;
        }
        // If status filter exists, navigate to client without project slug so all matching projects are shown
        // Otherwise navigate to specific project
        if (clientParams['status']) {
          this.router.navigate(['/clients', this.clientId], clientExtras);
        } else if (this.projectId) {
          this.router.navigate(['/clients', this.clientId, 'projects', this.projectId], clientExtras);
        } else {
          this.router.navigate(['/clients', this.clientId], clientExtras);
        }
        break;
      case 'filiale-suchen':
        this.router.navigate(['/filiale-suchen']);
        break;
      default:
      case 'project':
        // Default: Navigate to project overview
        if (!this.clientId || !this.projectId) {
          return;
        }
        const params = this.cleanNavigationQueryParams({
          ...this.returnToProjectQueryParams,
        });
        const extras: any = {};
        if (Object.keys(params).length > 0) {
          extras.queryParams = params;
        }
        this.router.navigate(['/clients', this.clientId, 'projects', this.projectId], extras);
        break;
    }
  }

  buildEditQueryParams(): Record<string, any> {
    // Preserve the original referrer if it exists (e.g., 'favorites'), otherwise use 'report-detail'
    const originalReferrer = this.returnToProjectQueryParams['referrer'] || 'report-detail';
    return this.cleanNavigationQueryParams({
      ...this.returnToProjectQueryParams,
      referrer: originalReferrer,
    });
  }

  openEditInNewTab(): void {
    if (!this.clientId || !this.projectId || !this.reportId) {
      return;
    }
    const urlTree = this.router.createUrlTree(['/clients', this.clientId, 'projects', this.projectId, 'edit-report', this.reportId], { queryParams: this.buildEditQueryParams() });
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
  }

  onEditContextMenu(event: MouseEvent): boolean {
    event.preventDefault();
    this.openEditInNewTab();
    return false;
  }

  clientMessageContent: string = '';
  merchandiserMessageContent: string = '';
  sendingClientMessage = false;
  sendingMerchandiserMessage = false;

  // Scroll containers
  @ViewChild('clientScrollContainer', { static: false }) clientScrollContainer!: ElementRef;
  @ViewChild('merchandiserScrollContainer', { static: false }) merchandiserScrollContainer!: ElementRef;
  @ViewChild('dialogPanel', { read: ElementRef }) dialogPanel!: ElementRef;
  private shouldScrollClient = false;
  private shouldScrollMerchandiser = false;
  private enterScrollResetTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Accordion active value - set all panels open by default
  activeAccordionValue: string[] = ['0', '1', '3'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private notificationsService: NotificationsService,
    private toastService: HotToastService,
    private clientService: ClientService,
  ) {}

  ngOnInit(): void {
    this.resetPageScrollOnEnter();

    this.routeParamsSubscription = this.route.paramMap.subscribe((params) => {
      this.readRouteParams(params);
      this.readQueryParams();
      if (!this.reportId) {
        this.error = true;
        this.loading = false;
        return;
      }
      this.loadReportDetails();
    });

    const openDialog = this.route.snapshot.queryParamMap.get('openDialog');
    if (openDialog === 'true' && !this.loading) {
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

  private resetPageScrollOnEnter(): void {
    const applyScrollTop = () => {
      const shellScrollContainer = document.querySelector('main > div.overflow-y-auto') as HTMLElement | null;
      if (shellScrollContainer) {
        shellScrollContainer.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    };

    applyScrollTop();
    this.enterScrollResetTimeouts.push(setTimeout(applyScrollTop, 50));
    this.enterScrollResetTimeouts.push(setTimeout(applyScrollTop, 200));
  }

  private readRouteParams(params: ParamMap): void {
    this.clientId = params.get('clientId') || params.get('clientSlug');
    this.projectId = params.get('projectId') || params.get('projectSlug');
    const rawReportId = params.get('reportID');
    this.reportId = rawReportId ? rawReportId.split('?')[0].split('/')[0].trim() : null;
    this.syncNavigationContextFromRoute();
  }

  private readQueryParams(): void {
    this.referrer = this.route.snapshot.queryParamMap.get('referrer') || '';

    if (!this.referrer && window.history.length > 1) {
      this.referrer = 'project';
    }

    this.returnToProjectQueryParams = this.cleanNavigationQueryParams(this.extractQueryParams(this.route.snapshot.queryParamMap));

    const openDialog = this.route.snapshot.queryParamMap.get('openDialog');
    if (openDialog === 'true') {
      if (!this.activeAccordionValue.includes('3')) {
        this.activeAccordionValue = [...this.activeAccordionValue, '3'];
      }
    }

    if (this.referrer === 'notifications') {
      const notificationId = this.route.snapshot.queryParamMap.get('notificationId');
      if (notificationId) {
        this.notificationsService.markSeen(parseInt(notificationId, 10)).subscribe({
          error: (err) => console.error('Error marking notification as seen:', err),
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.routeParamsSubscription?.unsubscribe();
    this.enterScrollResetTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.enterScrollResetTimeouts = [];
  }

  ngAfterViewInit() {
    // Scroll after initial render - wait for accordion and DOM to be ready
    // Use longer delays to ensure accordion panels are fully rendered
    setTimeout(() => {
      this.scrollToBottom('client');
      this.scrollToBottom('merchandiser');
    }, 500);

    // Also try scrolling again after a longer delay in case accordion takes time to render
    setTimeout(() => {
      this.scrollToBottom('client');
      this.scrollToBottom('merchandiser');
    }, 1000);
  }

  onAccordionPanelOpen(event: any) {
    // When accordion panel opens, scroll to bottom after a delay to ensure DOM is ready
    // Check if the Dialog panel (value='3') is being opened
    if (event && Array.isArray(event) && event.includes('3')) {
      setTimeout(() => {
        this.scrollToBottom('client');
        this.scrollToBottom('merchandiser');
      }, 200);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollClient) {
      this.scrollToBottom('client');
      this.shouldScrollClient = false;
    }
    if (this.shouldScrollMerchandiser) {
      this.scrollToBottom('merchandiser');
      this.shouldScrollMerchandiser = false;
    }
  }

  private scrollToBottom(container: 'client' | 'merchandiser') {
    // Only scroll if the Dialog panel (value='3') is open
    if (!this.activeAccordionValue.includes('3')) {
      return;
    }

    const elementRef = container === 'client' ? this.clientScrollContainer : this.merchandiserScrollContainer;

    if (!elementRef || !elementRef.nativeElement) {
      // ViewChild not available yet, try again later
      setTimeout(() => this.scrollToBottom(container), 100);
      return;
    }

    // Try scrolling multiple times with increasing delays to ensure DOM is fully rendered
    // This handles cases where the element is conditionally rendered with *ngIf
    const tryScroll = (delay: number) => {
      setTimeout(() => {
        if (elementRef?.nativeElement) {
          const element = elementRef.nativeElement;
          // Force scroll to bottom
          const scrollHeight = element.scrollHeight;
          const clientHeight = element.clientHeight;

          if (scrollHeight > clientHeight) {
            element.scrollTop = scrollHeight;
          }
        }
      }, delay);
    };

    // Try multiple times with increasing delays to catch DOM updates
    tryScroll(0);
    tryScroll(100);
    tryScroll(200);
    tryScroll(300);
    tryScroll(500);
    tryScroll(700);
  }

  private triggerScrollToBottom(container: 'client' | 'merchandiser') {
    if (container === 'client') {
      this.shouldScrollClient = true;
    } else {
      this.shouldScrollMerchandiser = true;
    }
  }

  private dedupeUploadedAdvancedPhotosForSlots(photos: any[]): any[] {
    const sorted = [...(photos || [])].sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
    const seenRowIds = new Set<number>();
    const seenSlots = new Set<string>();
    const result: any[] = [];

    for (const photo of sorted) {
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

  loadReportDetails(): void {
    if (!this.reportId) {
      this.error = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = false;
    this.reportService.getReportById(this.reportId).subscribe({
      next: (data) => {
        try {
          this.report = data;
          this.applyReportDefaults();

          if (!canAkzenteAccessReport(this.report?.status)) {
            this.error = true;
            this.loading = false;
            return;
          }

          this.syncRouteIdsFromReport();
          this.syncNavigationContext();

          this.sortProjectRelations();

          const extractLabelNumber = (label: string): number => {
            const match = label?.match(/\d+/);
            return match ? parseInt(match[0], 10) : 999;
          };

          const rawPhotos = this.dedupeUploadedAdvancedPhotosForSlots(this.report.uploadedAdvancedPhotos || []);
          this.report.uploadedAdvancedPhotos = sortUploadedAdvancedPhotos(rawPhotos);
          this.galleryImages = this.buildGalleryItems(this.report.uploadedAdvancedPhotos, extractLabelNumber);

          this.processConversationMessages();
          this.initializeQuestionData();
          this.loading = false;

          setTimeout(() => {
            this.scrollToBottom('client');
            this.scrollToBottom('merchandiser');

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
        } catch (processingError) {
          console.error('Error processing report data:', processingError);
          this.error = true;
          this.loading = false;
        }
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  private applyReportDefaults(): void {
    if (!this.report) {
      return;
    }

    if (!this.report.project) {
      this.report.project = {};
    }
    if (!this.report.project.questions) {
      this.report.project.questions = [];
    }
    if (!this.report.photos && this.report.project.photos) {
      this.report.photos = this.report.project.photos;
    }
    if (!this.report.conversation) {
      this.report.conversation = { messages: [] };
    }
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
    this.visibleQuestions.forEach((question) => {
      const questionId = question.id;
      this.questionOptions[questionId] = getVisibleQuestionOptionTexts(question.options);
      this.filteredQuestionOptions[questionId] = [...this.questionOptions[questionId]];
      this.questionAnswers[questionId] = '';
    });
  }

  filterQuestionOptions(event: any, questionId: number): void {
    const query = event.query?.toLowerCase() || '';
    this.filteredQuestionOptions[questionId] = this.questionOptions[questionId].filter((option) => option.toLowerCase().includes(query));
  }

  onQuestionAnswerChanged(questionId: number): void {
    const answer = this.questionAnswers[questionId];
    const question = this.report?.project?.questions?.find((q) => q.id === questionId);
    // Add logic if needed
  }

  processConversationMessages(): void {
    if (!this.report?.conversation?.messages) {
      this.report.clientMessages = [];
      this.report.merchandiserMessages = [];
      return;
    }
    const messages = this.report.conversation.messages;
    const getTypeName = (typeObjOrName: any): string => {
      if (!typeObjOrName) return '';
      if (typeof typeObjOrName === 'string') return typeObjOrName;
      return typeObjOrName.name || '';
    };
    this.report.clientMessages = messages
      .filter(
        (msg) =>
          // Akzente -> Client
          (getTypeName(msg.senderType) === 'akzente' && (getTypeName(msg.receiverType) === 'client' || msg.receiverTypeString === 'client')) ||
          // Client -> Akzente (cover inconsistent payloads where receiverType may still be 'client' but string says 'akzente')
          (getTypeName(msg.senderType) === 'client' && (getTypeName(msg.receiverType) === 'akzente' || msg.receiverTypeString === 'akzente')),
      )
      .map((msg) => {
        const createdAt = new Date(msg.createdAt);
        const senderFirstName = msg.senderFirstName || '';
        const senderLastName = msg.senderLastName || '';
        const fullName = `${senderFirstName} ${senderLastName}`.trim();
        const isAkzente = msg.senderType?.name === 'akzente';
        const senderPhotoUrl = (msg as any).senderPhoto?.path || `https://ui-avatars.com/api/?name=${encodeURIComponent(isAkzente ? 'Akzente' : fullName || 'User')}`;
        return {
          createdAtMs: createdAt.getTime(),
          dateLabel: createdAt.toLocaleDateString('de-DE'),
          timeLabel: createdAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          sender: isAkzente ? 'agent' : 'client',
          senderName: isAkzente ? 'Akzente' : fullName || 'Unbekannt',
          avatar: senderPhotoUrl,
          text: msg.content,
        };
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
    this.report.merchandiserMessages = messages
      .filter(
        (msg) =>
          // Akzente -> Merchandiser
          (getTypeName(msg.senderType) === 'akzente' && (getTypeName(msg.receiverType) === 'merchandiser' || msg.receiverTypeString === 'merchandiser')) ||
          // Merchandiser -> Akzente
          (getTypeName(msg.senderType) === 'merchandiser' && (getTypeName(msg.receiverType) === 'akzente' || msg.receiverTypeString === 'akzente')),
      )
      .map((msg) => {
        const createdAt = new Date(msg.createdAt);
        const senderFirstName = msg.senderFirstName || '';
        const senderLastName = msg.senderLastName || '';
        const fullName = `${senderFirstName} ${senderLastName}`.trim();
        const isAkzente = msg.senderType?.name === 'akzente';
        const merchPortraitUrl = this.getMerchandiserPortraitUrl();
        const senderPhotoUrl =
          (!isAkzente && merchPortraitUrl) || (msg as any).senderPhoto?.path || `https://ui-avatars.com/api/?name=${encodeURIComponent(isAkzente ? 'Akzente' : fullName || 'User')}`;
        return {
          createdAtMs: createdAt.getTime(),
          dateLabel: createdAt.toLocaleDateString('de-DE'),
          timeLabel: createdAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          sender: isAkzente ? 'agent' : 'merchandiser',
          senderName: isAkzente ? 'Akzente' : fullName || 'Unbekannt',
          avatar: senderPhotoUrl,
          text: msg.content,
        };
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    // Trigger scroll after messages are processed
    this.triggerScrollToBottom('client');
    this.triggerScrollToBottom('merchandiser');
  }

  private getMerchandiserPortraitUrl(): string | null {
    const merch = this.report?.merchandiser as any;
    if (!merch || !Array.isArray(merch.files)) {
      return null;
    }
    const portrait = merch.files.find((f: any) => f?.type === 'portrait' && f.file?.path);
    return portrait ? portrait.file.path : null;
  }

  private sortProjectRelations(): void {
    if (this.report?.project?.advancedPhotos?.length) {
      this.report.project.advancedPhotos.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    if (this.report?.project?.questions?.length) {
      this.report.project.questions.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
  }

  // Build gallery items according to selected mode
  onGalleryModeChange(mode: 'project' | 'before-first' | 'alternate') {
    this.galleryDisplayMode = mode;
    const rawPhotos = sortUploadedAdvancedPhotos(this.dedupeUploadedAdvancedPhotosForSlots(this.report?.uploadedAdvancedPhotos || []));
    this.report.uploadedAdvancedPhotos = rawPhotos;
    const extractLabelNumber = (label: string): number => {
      const match = label?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999;
    };
    this.galleryImages = this.buildGalleryItems(rawPhotos, extractLabelNumber);
    this.selectedPhotoIndex = 0;
  }

  private buildGalleryItems(rawPhotos: any[], extractLabelNumber: (label: string) => number): GalleryItem[] {
    const toGalleryItem = (photo: any, idx: number): GalleryItem => ({
      itemImageSrc: photo.file.path,
      thumbnailImageSrc: photo.file.path,
      title: photo.label,
      beforeAfterType: photo.beforeAfterType,
      alt: photo.label,
      date: photo.createdAt,
      labelNumber: extractLabelNumber(photo.label),
      order: photo.order != null ? photo.order : idx,
      advancedPhotoId: photo.advancedPhoto?.id,
    });

    const sections = [...(this.report?.project?.advancedPhotos || [])].sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    if (!sections.length) {
      return sortUploadedAdvancedPhotos(rawPhotos).map((photo, idx) => toGalleryItem(photo, idx));
    }

    const result: GalleryItem[] = [];
    for (const section of sections) {
      const sectionPhotos = rawPhotos.filter((photo) => photo.advancedPhoto?.id === section.id);
      const beforePhotos = sortUploadedAdvancedPhotos(sectionPhotos.filter((photo) => photo.beforeAfterType === 'before'));
      const afterPhotos = sortUploadedAdvancedPhotos(sectionPhotos.filter((photo) => photo.beforeAfterType === 'after'));

      if (section.isBeforeAfter) {
        beforePhotos.forEach((photo, idx) => result.push(toGalleryItem(photo, idx)));
      }
      afterPhotos.forEach((photo, idx) => result.push(toGalleryItem(photo, idx)));
    }

    const usedPaths = new Set(result.map((item) => item.itemImageSrc));
    sortUploadedAdvancedPhotos(rawPhotos).forEach((photo, idx) => {
      if (!usedPaths.has(photo.file?.path)) {
        result.push(toGalleryItem(photo, idx));
      }
    });

    return result;
  }

  selectPhoto(index: number): void {
    this.selectedPhotoIndex = index;
  }

  nextPhoto(): void {
    this.selectedPhotoIndex = (this.selectedPhotoIndex + 1) % this.report.photos.length;
  }

  prevPhoto(): void {
    this.selectedPhotoIndex = (this.selectedPhotoIndex - 1 + this.report.photos.length) % this.report.photos.length;
  }

  private sanitizeExcelFileNamePart(value: string): string {
    return value
      .trim()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_');
  }

  // Download Excel for this single report
  downloadSingleReportExcel(): void {
    const id = this.reportId;
    if (!id) return;

    this.reportService.exportSingleReportAsExcel(id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const branchName = this.report?.branch?.name || 'report';
        link.download = `${this.sanitizeExcelFileNamePart(branchName)}_${id}_export.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success dialog
        this.dialogMessage = 'Excel-Export erfolgreich heruntergeladen';
        this.csvDialogIsError = false;
        this.csvDialogVisible = true;
      },
      error: (error) => {
        if (error?.status === 404 && error?.error?.error === 'REPORT_NOT_FOUND') {
          this.dialogMessage = 'Bericht nicht gefunden.';
        } else {
          this.dialogMessage = 'Excel-Export fehlgeschlagen!';
        }
        this.csvDialogIsError = true;
        this.csvDialogVisible = true;
      },
    });
  }

  showStatusConfirmation(status: string): void {
    // Prevent any status changes if report is already closed
    if (this.isReportClosed()) {
      this.toastService.warning('Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    // Check if user can approve (sequential approval logic)
    if (status === 'Freigegeben' && !this.canUserApprove()) {
      this.toastService.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Show confirmation dialog
    this.pendingStatusChange = status;
    this.showConfirmStatusDialog = true;
  }

  confirmStatusChange(): void {
    if (!this.pendingStatusChange) {
      this.showConfirmStatusDialog = false;
      return;
    }

    this.showConfirmStatusDialog = false;
    const status = this.pendingStatusChange;
    this.pendingStatusChange = null;

    // Only allow "Freigegeben" status changes, "UngeprüfT" is just for display
    if (status === 'Freigegeben') {
      this.closeReport();
    }
  }

  cancelStatusChange(): void {
    this.showConfirmStatusDialog = false;
    this.pendingStatusChange = null;
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

    // Check if user can approve (sequential approval logic)
    if (status === 'UngeprüfT' && !this.canUserApprove()) {
      this.toastService.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Only allow "Freigegeben" status changes, "UngeprüfT" is just for display
    if (status === 'Freigegeben') {
      this.closeReport();
    }
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
            this.report = response;
            this.invalidateProjectReportCache();
            this.toastService.success('Bericht erfolgreich geschlossen', {
              position: 'bottom-right',
              duration: 2000,
            });
          }
        },
      });
  }

  // Helper method to determine if status should show as "UngeprüfT"
  isStatusOpen(): boolean {
    return !this.isReportClosed();
  }

  isReportClosed(): boolean {
    return isAkzenteReportClosed(this.report?.status);
  }

  canUserApprove(): boolean {
    return canAkzenteApproveReport(this.report?.status, this.report);
  }

  onFavoriteChanged(newStatus: boolean, report: any): void {
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;
    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (result) => {
        if (result) {
          report.isFavorite = result.isFavorite;
          if (result.isFavorite) {
            this.toastService.success('Einsatz zu Favoriten hinzugefügt');
          } else {
            this.toastService.info('Einsatz aus Favoriten entfernt');
          }
        }
      },
      error: (error) => {
        report.isFavorite = previousStatus; // revert on error
        this.toastService.error('Fehler beim Aktualisieren der Favoriten');
      },
    });
  }

  onAppointmentDateSelected(date: Date): void {
    this.report.appointmentDate = date;
    // Optionally handle date selection logic
  }

  sendClientMessage() {
    const content = this.clientMessageContent.trim();
    if (!content) return;
    this.sendingClientMessage = true;
    this.reportService.sendMessage(this.reportId, { content, receiverType: 'client' }).subscribe({
      next: (response) => {
        this.clientMessageContent = '';
        if (response && response.conversation) {
          this.report.conversation = response.conversation;
          this.processConversationMessages();
          // Scroll to bottom after new message is added and DOM is updated
          setTimeout(() => this.scrollToBottom('client'), 300);
        }
        this.sendingClientMessage = false;
      },
      error: () => {
        this.sendingClientMessage = false;
      },
    });
  }

  sendMerchandiserMessage() {
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
          setTimeout(() => this.scrollToBottom('merchandiser'), 300);
        }
        this.sendingMerchandiserMessage = false;
      },
      error: () => {
        this.sendingMerchandiserMessage = false;
      },
    });
  }

  get visibleQuestions(): any[] {
    return getVisibleProjectQuestions(this.report?.project?.questions);
  }

  getAnswerForQuestion(questionId: number) {
    if (!this.report || !this.report.answers) return null;
    return this.report.answers.find((a: any) => a.question && a.question.id === questionId) || null;
  }

  getMultiAnswersForQuestion(questionId: number): string {
    if (!this.report || !this.report.answers) return '';
    const answers = this.report.answers.filter((a: any) => a.question && a.question.id === questionId && a.selectedOption);
    return answers.map((a: any) => a.selectedOption.optionText).join(', ');
  }
}
