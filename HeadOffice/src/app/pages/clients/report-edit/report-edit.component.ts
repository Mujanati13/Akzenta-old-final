import { Component, OnInit, ViewEncapsulation, inject, ViewChild, ElementRef, AfterViewInit, AfterViewChecked, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { ImageItem } from '../../../shared/components/multi-image-upload/multi-image-upload.component';
import { ReportService } from '@app/core/services/report.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of, Subscription } from 'rxjs';
import { ClientService } from '@app/@core/services/client.service';
import { ReportCacheService } from '@app/core/services/report-cache.service';
import { getVisibleProjectQuestions, getVisibleQuestionOptionTexts } from '@app/@core/utils/project-question.util';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { REPORT_PHOTO_MAX_FILE_SIZE_BYTES, sortUploadedAdvancedPhotos } from '../../../shared/constants/report-photo-upload.constants';
import { canAkzenteAccessReport, canAkzenteApproveReport, isAkzenteReportClosed } from '@app/@core/utils/report-akzente-status.util';
import { isAdvancedPhotoVisible, resolvePhotoSlotCount, resolvePhotoLabelsForType, PhotoNamingContext } from '@app/@core/utils/advanced-photo.util';

interface GalleryItem {
  itemImageSrc: string;
  thumbnailImageSrc: string;
  title: string;
  alt: string;
}

type PrepopulatedKey = string;

@Component({
  selector: 'app-report-edit',
  standalone: false,
  templateUrl: './report-edit.component.html',
  styleUrls: ['./report-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReportEditComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('clientScrollContainer') private clientScrollContainer!: ElementRef;
  @ViewChild('merchandiserScrollContainer') private merchandiserScrollContainer!: ElementRef;

  reportId: string;
  clientId: string;
  projectId: string;
  report: any = null;
  nextVisitDate: Date | null = null;
  loading: boolean = true;
  error: boolean = false;
  saving: boolean = false;
  savingType: 'save' | 'approve' | null = null;
  showConfirmApproveDialog: boolean = false;
  showConfirmStatusDialog: boolean = false;
  pendingStatusChange: string | null = null;
  showConfirmDeleteImageDialog: boolean = false;
  pendingImageDelete: { fileId: number; index: number; photoIndex: number; type: 'vorher' | 'nachher' | 'nachher-only' } | null = null;
  downloadingReportExcel: boolean = false;
  photoUploadErrorMessage: string = '';
  readonly reportPhotoMaxFileSizeBytes = REPORT_PHOTO_MAX_FILE_SIZE_BYTES;
  private shouldScroll = false;
  private enterScrollResetTimeouts: ReturnType<typeof setTimeout>[] = [];
  selectedPhotoIndex: number = 0;
  galleryImages: GalleryItem[] = [];
  yesNoOptions: { label: string; value: boolean }[] = [];
  templateVersionOptions: { label: string; value: string }[] = [];

  localContactOptions: { label: string; value: string }[] = [];

  inventoryStatusOptions: { label: string; value: string }[] = [];
  // Galleria configuration
  position: string = 'bottom';
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

  // Dynamic storage for advanced photos
  // Key format: 'before_INDEX' or 'after_INDEX'
  advancedPhotoImages: { [key: string]: ImageItem[] } = {};

  // New images to be uploaded
  newAdvancedPhotoImages: { [key: string]: ImageItem[] } = {};

  // Legacy properties kept for compatibility during refactor (will be removed)
  vorherImages1: ImageItem[] = [];
  nachherImages1: ImageItem[] = [];
  nachherImages2: ImageItem[] = [];
  vorherImages3: ImageItem[] = [];
  nachherImages3: ImageItem[] = [];

  prepopulatedVorherImages1: ImageItem[] = [];
  prepopulatedNachherImages1: ImageItem[] = [];
  prepopulatedNachherImages2: ImageItem[] = [];
  prepopulatedVorherImages3: ImageItem[] = [];
  prepopulatedNachherImages3: ImageItem[] = [];

  // Files to delete and replaced images tracking
  filesToDelete: number[] = [];
  replacedImages: { [fileId: number]: ImageItem } = {};

  // Dynamic form data for questions
  questionAnswers: { [questionId: number]: any } = {};
  questionOptions: { [questionId: number]: string[] } = {};
  filteredQuestionOptions: { [questionId: number]: string[] } = {};
  questionErrors: { [questionId: number]: string } = {};

  // Dialog state for export feedback
  csvDialogVisible: boolean = false;
  csvDialogIsError: boolean = false;
  dialogMessage: string = '';

  private returnToProjectQueryParams: Record<string, any> = {};
  private referrer: string = '';
  private routeParamsSubscription?: Subscription;

  get viewReportQueryParams(): Record<string, any> {
    return this.cleanNavigationQueryParams({
      ...this.returnToProjectQueryParams,
    });
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
      case 'report-detail':
        // Navigate back to report detail
        if (!this.clientId || !this.projectId || !this.reportId) {
          return;
        }
        const reportParams = this.cleanNavigationQueryParams({
          ...this.returnToProjectQueryParams,
        });
        const reportExtras: any = {};
        if (Object.keys(reportParams).length > 0) {
          reportExtras.queryParams = reportParams;
        }
        this.router.navigate(['/clients', this.clientId, 'projects', this.projectId, 'reports', this.reportId], reportExtras);
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

  navigateToViewReport(newTab: boolean = false): void {
    if (!this.clientId || !this.projectId || !this.reportId) {
      return;
    }

    const params = this.cleanNavigationQueryParams({
      ...this.returnToProjectQueryParams,
    });

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/clients', this.clientId, 'projects', this.projectId, 'reports', this.reportId], { queryParams: params });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      const extras: any = {};
      if (Object.keys(params).length > 0) {
        extras.queryParams = params;
      }
      this.router.navigate(['/clients', this.clientId, 'projects', this.projectId, 'reports', this.reportId], extras);
    }
  }

  onViewReportContextMenu(event: MouseEvent): boolean {
    event.preventDefault();
    this.navigateToViewReport(true);
    return false;
  }

  // Initialize question data when report is loaded
  initializeQuestionData(): void {
    this.visibleQuestions.forEach((question) => {
      const questionId = question.id;
      const answerTypeName = question.answerType?.name;
      if (!answerTypeName) {
        return;
      }

      // Initialize options for this question
      this.questionOptions[questionId] = getVisibleQuestionOptionTexts(question.options);
      this.filteredQuestionOptions[questionId] = [...this.questionOptions[questionId]];

      // Find existing answer for this question
      const existingAnswer = this.report.answers?.find((answer) => answer.question?.id === questionId);

      if (existingAnswer) {
        switch (answerTypeName) {
          case 'text':
            this.questionAnswers[questionId] = existingAnswer.textAnswer || '';
            break;
          case 'boolean':
            this.questionAnswers[questionId] = existingAnswer.textAnswer === 'true';
            break;
          case 'select':
            if (existingAnswer.selectedOption) {
              this.questionAnswers[questionId] = existingAnswer.selectedOption.optionText;
            }
            break;
          case 'multiselect':
            // For multiselect, find all answers for this question
            const multiselectAnswers = this.report.answers?.filter((answer) => answer.question.id === questionId) || [];
            if (multiselectAnswers.length > 0) {
              this.questionAnswers[questionId] = multiselectAnswers.map((answer) => answer.selectedOption?.optionText).filter((text) => text !== null && text !== undefined);
            } else {
              this.questionAnswers[questionId] = [];
            }
            break;
        }
      } else {
        // Set default values
        switch (answerTypeName) {
          case 'text':
            this.questionAnswers[questionId] = '';
            break;
          case 'boolean':
            this.questionAnswers[questionId] = null;
            break;
          case 'select':
            this.questionAnswers[questionId] = null;
            break;
          case 'multiselect':
            this.questionAnswers[questionId] = [];
            break;
        }
      }
    });
  }

  // Filter options for autocomplete
  filterQuestionOptions(event: any, questionId: number): void {
    const query = event.query?.toLowerCase() || '';
    this.filteredQuestionOptions[questionId] = this.questionOptions[questionId].filter((option) => option.toLowerCase().includes(query));
  }

  // Handle question answer changes
  onQuestionAnswerChanged(questionId: number): void {
    this.clearQuestionError(questionId);
    const answer = this.questionAnswers[questionId];
    const question = this.report?.project?.questions?.find((q) => q.id === questionId);

    if (question?.answerType?.name === 'multiselect') {
      // Get the actual option objects to display proper text
      const selectedOptions = Array.isArray(answer)
        ? answer
            .map((optionText) => {
              const option = question.options?.find((opt) => opt.optionText === optionText);
              return {
                id: option?.id,
                text: option?.optionText,
              };
            })
            .filter((opt) => opt.id && opt.text)
        : [];
    } else {
    }

    // Here you can add logic to save the answer or update the report
  }

  toggleMultiAnswer(questionId: number, option: string): void {
    if (!Array.isArray(this.questionAnswers[questionId])) {
      this.questionAnswers[questionId] = [];
    }

    const answers: string[] = [...this.questionAnswers[questionId]];
    const index = answers.indexOf(option);
    if (index !== -1) {
      answers.splice(index, 1);
    } else {
      answers.push(option);
    }

    this.questionAnswers[questionId] = answers;
    this.onQuestionAnswerChanged(questionId);
  }

  isMultiAnswerSelected(questionId: number, option: string): boolean {
    if (!Array.isArray(this.questionAnswers[questionId])) {
      return false;
    }
    return this.questionAnswers[questionId].includes(option);
  }

  getMultiSelectOptions(questionId: number): { label: string; value: string }[] {
    return (this.questionOptions[questionId] || []).map((opt) => ({ label: opt, value: opt }));
  }

  validateRequiredQuestions(): boolean {
    this.questionErrors = {};
    let valid = true;

    this.visibleQuestions.forEach((question) => {
      if (!question.isRequired) return;

      const answer = this.questionAnswers[question.id];
      const answerType = question.answerType?.name;
      let isEmpty = false;

      switch (answerType) {
        case 'text':
          isEmpty = !answer || (typeof answer === 'string' && answer.trim() === '');
          break;
        case 'boolean':
          isEmpty = answer === null || answer === undefined;
          break;
        case 'select':
          isEmpty = !answer;
          break;
        case 'multiselect':
          isEmpty = !Array.isArray(answer) || answer.length === 0;
          break;
      }

      if (isEmpty) {
        this.questionErrors[question.id] = 'Dieses Feld ist erforderlich';
        valid = false;
      }
    });

    return valid;
  }

  clearQuestionError(questionId: number): void {
    if (this.questionErrors[questionId]) {
      delete this.questionErrors[questionId];
    }
  }

  hasQuestionError(questionId: number): boolean {
    return !!this.questionErrors[questionId];
  }

  // Check if a single select option is selected (for radio buttons)
  isSingleAnswerSelected(questionId: number, option: string): boolean {
    return this.questionAnswers[questionId] === option;
  }

  // Handle single select option click (radio button behavior)
  selectSingleAnswer(questionId: number, option: string): void {
    // If clicking the same option, deselect it (allow clearing)
    if (this.questionAnswers[questionId] === option) {
      this.questionAnswers[questionId] = null;
    } else {
      this.questionAnswers[questionId] = option;
    }
    this.onQuestionAnswerChanged(questionId);
  }

  // Prepare answers for saving
  prepareAnswersForSave(): any[] {
    const answers: any[] = [];

    Object.keys(this.questionAnswers).forEach((questionIdStr) => {
      const questionId = parseInt(questionIdStr);
      const answer = this.questionAnswers[questionId];
      const question = this.report.project.questions.find((q) => q.id === questionId);

      if (question && answer !== null && answer !== undefined) {
        const answerType = question.answerType.name;

        switch (answerType) {
          case 'text':
            answers.push({
              questionId: questionId,
              textAnswer: answer,
            });
            break;
          case 'boolean':
            answers.push({
              questionId: questionId,
              textAnswer: answer.toString(),
            });
            break;
          case 'select':
            if (answer) {
              const selectedOption = question.options.find((opt) => opt.optionText === answer);
              answers.push({
                questionId: questionId,
                selectedOptionId: selectedOption?.id,
              });
            }
            break;
          case 'multiselect':
            if (Array.isArray(answer) && answer.length > 0) {
              answer.forEach((selectedText) => {
                const selectedOption = question.options.find((opt) => opt.optionText === selectedText);
                if (selectedOption) {
                  answers.push({
                    questionId: questionId,
                    selectedOptionId: selectedOption.id,
                  });
                }
              });
            }
            break;
        }
      }
    });

    return answers;
  }

  private readonly _toast = inject(HotToastService);
  private readonly reportCacheService = inject(ReportCacheService);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
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
    } else if (!this.activeAccordionValue.includes('3') && this.referrer === 'notifications') {
      this.activeAccordionValue = [...this.activeAccordionValue, '3'];
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

  ngOnDestroy(): void {
    this.routeParamsSubscription?.unsubscribe();
    this.enterScrollResetTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.enterScrollResetTimeouts = [];
  }

  ngAfterViewInit(): void {
    // Scroll to bottom after view init - wait for accordion and DOM to be ready
    setTimeout(() => this.scrollToBottom(), 300);
  }

  ngAfterViewChecked(): void {
    // Auto-scroll when shouldScroll flag is set
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    // Try scrolling multiple times with increasing delays to ensure DOM is fully rendered
    // This handles cases where the element is conditionally rendered with *ngIf
    const tryScroll = (delay: number) => {
      setTimeout(() => {
        if (this.clientScrollContainer?.nativeElement) {
          const element = this.clientScrollContainer.nativeElement;
          element.scrollTop = element.scrollHeight;
        }
        if (this.merchandiserScrollContainer?.nativeElement) {
          const element = this.merchandiserScrollContainer.nativeElement;
          element.scrollTop = element.scrollHeight;
        }
      }, delay);
    };

    // Try scrolling at 0ms, 100ms, 200ms, and 400ms to handle various DOM rendering scenarios
    tryScroll(0);
    tryScroll(100);
    tryScroll(200);
    tryScroll(400);
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

          // Merge project.photos into advancedPhotos so they render in the template
          if (this.report?.project?.photos?.length && !this.report?.project?.advancedPhotos?.length) {
            this.report.project.advancedPhotos = this.report.project.photos
              .filter((p: any) => p.isBeforeAfter !== undefined && p.isBeforeAfter !== null)
              .map((p: any) => ({
                id: p.id,
                labels: ['Foto'],
                isBeforeAfter: p.isBeforeAfter,
                isVisibleInReport: p.isVisibleInReport ?? true,
                createdAt: p.createdAt,
              }));
          }

          // Sort advancedPhotos by createdAt (creation order)
          if (this.report?.project?.advancedPhotos) {
            this.report.project.advancedPhotos.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          }

          // Sort questions by createdAt (creation order)
          if (this.report?.project?.questions) {
            this.report.project.questions.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          }

          // Prefill appointment date from report data
          if (this.report.visitDate) {
            this.report.visitDate = new Date(this.report.visitDate);
          }
          if (this.report.nextVisitDate) {
            this.nextVisitDate = new Date(this.report.nextVisitDate);
          }

          this.processConversationMessages();
          this.initializeQuestionData();
          this.processUploadedAdvancedPhotos();
          this.loading = false;
          setTimeout(() => this.scrollToBottom(), 400);
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
    if (!this.report.project.advancedPhotos) {
      this.report.project.advancedPhotos = [];
    }
    if (!this.report.conversation) {
      this.report.conversation = { messages: [] };
    }
    if (!this.report.answers) {
      this.report.answers = [];
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

  // Helper to get images for a specific photo index and type
  getVisibleAdvancedPhotos(): any[] {
    return (this.report?.project?.advancedPhotos || []).filter((photo: any) => isAdvancedPhotoVisible(photo));
  }

  getPhotoSlotCount(photo: any, type: 'before' | 'after' = 'after'): number {
    return resolvePhotoSlotCount(photo, type);
  }

  getPhotoLabels(photo: any, type: 'before' | 'after' = 'after'): string[] {
    return resolvePhotoLabelsForType(photo, type, this.getPhotoNamingContext());
  }

  private getPhotoNamingContext(): PhotoNamingContext {
    const project = this.report?.project;
    const branch = this.report?.branch;
    const plannedOn = this.report?.plannedOn || this.report?.visitDate;

    return {
      imageNamePattern: project?.photoImageNamePattern,
      clientName: project?.clientCompany?.name || this.report?.clientCompany?.name,
      projectName: project?.name,
      branchName: branch?.name || branch?.branchNumber?.toString(),
      reportDate: plannedOn ? new Date(plannedOn).toISOString().slice(0, 10) : undefined,
    };
  }

  getAdvancedPhotoIndex(photo: any): number {
    return (this.report?.project?.advancedPhotos || []).findIndex((entry: any) => entry?.id === photo?.id);
  }

  getImages(index: number, type: 'before' | 'after'): ImageItem[] {
    const key = `${type}_${index}`;
    return this.advancedPhotoImages[key] || [];
  }

  // Generic handler for image changes
  onImagesChanged(images: ImageItem[], index: number, type: 'before' | 'after'): void {
    const normalized = this.normalizeImageList(images, type);
    const key = `${type}_${index}`;

    // Initialize array if it doesn't exist
    if (!this.advancedPhotoImages[key]) {
      this.advancedPhotoImages[key] = [];
    }

    // IMPORTANT: Check for replaced images BEFORE syncing, using the current prepopulated state
    // This ensures we compare against the original prepopulated images before they're modified
    const originalPrepopulated = [...this.advancedPhotoImages[key]];
    this.checkForReplacedImages(normalized, originalPrepopulated);

    // Sync with prepopulated order logic
    this.syncPrepopulatedOrder(normalized, key);

    // Update new images collection (exclude any already-deleted server files)
    this.newAdvancedPhotoImages[key] = normalized.filter((img) => !!img.file && (!img.fileId || !this.filesToDelete.includes(img.fileId))).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately.
    // Skip reassignment when nothing changed to avoid redundant child re-inits.
    this.setAdvancedPhotoImages(key, normalized);
  }

  // Generic handler for file deletion
  onFileDeleted(event: { fileId: number; index: number }, index: number, type: 'before' | 'after'): void {
    this.pendingImageDelete = {
      fileId: event.fileId,
      index: event.index,
      photoIndex: index,
      type: type === 'before' ? 'vorher' : 'nachher',
    };
    this.showConfirmDeleteImageDialog = true;
  }

  // Process uploaded advanced photos and convert them to ImageItem format
  processUploadedAdvancedPhotos(): void {
    if (!this.report?.uploadedAdvancedPhotos || !this.report?.project?.advancedPhotos) {
      return;
    }

    this.report.uploadedAdvancedPhotos = sortUploadedAdvancedPhotos(this.report.uploadedAdvancedPhotos);

    // Group uploaded photos by advancedPhotoId and beforeAfterType
    const groupedPhotos: { [key: string]: any[] } = {};

    this.report.uploadedAdvancedPhotos.forEach((uploadedPhoto) => {
      const key = `${uploadedPhoto.advancedPhoto.id}_${uploadedPhoto.beforeAfterType}`;
      if (!groupedPhotos[key]) {
        groupedPhotos[key] = [];
      }
      groupedPhotos[key].push(uploadedPhoto);
    });

    // Process each advanced photo section
    this.report.project.advancedPhotos.forEach((advancedPhoto: any, photoIndex: number) => {
      const beforeKey = `${advancedPhoto.id}_before`;
      const afterKey = `${advancedPhoto.id}_after`;

      // Process before photos (vorher)
      if (advancedPhoto.isBeforeAfter) {
        const sortedBefore = groupedPhotos[beforeKey]
          ? [...groupedPhotos[beforeKey]].sort((a, b) => {
              const orderA = typeof a.order === 'number' ? a.order : 0;
              const orderB = typeof b.order === 'number' ? b.order : 0;
              return orderA - orderB;
            })
          : [];

        const beforeImages: ImageItem[] = sortedBefore.map((uploadedPhoto, idx): ImageItem => {
          return {
            id: uploadedPhoto.id,
            file: undefined, // No file since it's already uploaded
            preview: uploadedPhoto.file.path, // Use the file path as preview
            fileName: uploadedPhoto.file.path.split('/').pop() || 'image.jpg',
            label: uploadedPhoto.label, // Use label from database
            isImage: true,
            fileId: uploadedPhoto.id, // Use the uploaded photo ID
            beforeAfterType: 'before',
            order: typeof uploadedPhoto.order === 'number' ? uploadedPhoto.order : idx,
          };
        });

        // Store in dynamic map
        this.advancedPhotoImages[`before_${photoIndex}`] = beforeImages;

        // Legacy support
        if (photoIndex === 0) this.prepopulatedVorherImages1 = beforeImages;
        if (photoIndex === 2) this.prepopulatedVorherImages3 = beforeImages;
      }

      // Process after photos (nachher)
      const sortedAfter = groupedPhotos[afterKey]
        ? [...groupedPhotos[afterKey]].sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 0;
            const orderB = typeof b.order === 'number' ? b.order : 0;
            return orderA - orderB;
          })
        : [];

      const afterImages: ImageItem[] = sortedAfter.map((uploadedPhoto, idx): ImageItem => {
        return {
          id: uploadedPhoto.id,
          file: undefined, // No file since it's already uploaded
          preview: uploadedPhoto.file.path, // Use the file path as preview
          fileName: uploadedPhoto.file.path.split('/').pop() || 'image.jpg',
          label: uploadedPhoto.label, // Use label from database
          isImage: true,
          fileId: uploadedPhoto.id, // Use the uploaded photo ID
          beforeAfterType: 'after',
          order: typeof uploadedPhoto.order === 'number' ? uploadedPhoto.order : idx,
        };
      });

      // Store in dynamic map
      this.advancedPhotoImages[`after_${photoIndex}`] = afterImages;

      // Legacy support
      if (photoIndex === 0) this.prepopulatedNachherImages1 = afterImages;
      if (photoIndex === 1) this.prepopulatedNachherImages2 = afterImages;
      if (photoIndex === 2) this.prepopulatedNachherImages3 = afterImages;
    });
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

    if (this.downloadingReportExcel) {
      return;
    }

    this.downloadingReportExcel = true;

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

        this.downloadingReportExcel = false;

        // Show success dialog
        this.dialogMessage = 'Excel-Export erfolgreich heruntergeladen';
        this.csvDialogIsError = false;
        this.csvDialogVisible = true;
      },
      error: (error) => {
        this.downloadingReportExcel = false;

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

  onFavoriteChanged(newStatus: boolean, report: any): void {
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;

    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (result) => {
        if (result) {
          report.isFavorite = result.isFavorite;
          if (result.isFavorite) {
            this._toast.success('Einsatz zu Favoriten hinzugefügt');
          } else {
            this._toast.info('Einsatz aus Favoriten entfernt');
          }
        }
      },
      error: (error) => {
        report.isFavorite = previousStatus; // revert on error
        this._toast.error('Fehler beim Aktualisieren der Favoriten');
      },
    });
  }

  // Handle date selection/clearing for appointment (Termin)
  onAppointmentDateSelected(date: Date | null): void {
    // Ensure that clearing the date sends an explicit null to the backend
    this.report.visitDate = date ?? null;
  }

  onNextVisitDateSelected(date: Date | null): void {
    this.nextVisitDate = date ?? null;
  }

  // Handler methods for image changes
  onVorherImages1Changed(images: ImageItem[]): void {
    const normalized = this.normalizeImageList(images, 'before');
    // Check for replaced images BEFORE syncing
    const originalPrepopulated = [...this.prepopulatedVorherImages1];
    this.checkForReplacedImages(normalized, originalPrepopulated);
    this.syncPrepopulatedOrder(normalized, 'prepopulatedVorherImages1');
    this.vorherImages1 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately
    this.prepopulatedVorherImages1 = normalized.map((img) => ({ ...img }));
  }

  onNachherImages1Changed(images: ImageItem[]): void {
    const normalized = this.normalizeImageList(images, 'after');
    // Check for replaced images BEFORE syncing
    const originalPrepopulated = [...this.prepopulatedNachherImages1];
    this.checkForReplacedImages(normalized, originalPrepopulated);
    this.syncPrepopulatedOrder(normalized, 'prepopulatedNachherImages1');
    this.nachherImages1 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately
    this.prepopulatedNachherImages1 = normalized.map((img) => ({ ...img }));
  }

  onNachherImages2Changed(images: ImageItem[]): void {
    const normalized = this.normalizeImageList(images, 'after');
    // Check for replaced images BEFORE syncing
    const originalPrepopulated = [...this.prepopulatedNachherImages2];
    this.checkForReplacedImages(normalized, originalPrepopulated);
    this.syncPrepopulatedOrder(normalized, 'prepopulatedNachherImages2');
    this.nachherImages2 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately
    this.prepopulatedNachherImages2 = normalized.map((img) => ({ ...img }));
  }

  // Dynamic handler for "Nachher only" photos at any index
  onNachherOnlyImagesChanged(images: ImageItem[], photoIndex: number): void {
    const normalized = this.normalizeImageList(images, 'after');

    // Determine which prepopulated array and nachherImages array to use based on photoIndex
    let prepopulatedKey: PrepopulatedKey;
    let originalPrepopulated: ImageItem[];

    if (photoIndex === 0) {
      prepopulatedKey = 'prepopulatedNachherImages1';
      // Check for replaced images BEFORE syncing
      originalPrepopulated = [...this.prepopulatedNachherImages1];
      this.checkForReplacedImages(normalized, originalPrepopulated);
      this.syncPrepopulatedOrder(normalized, prepopulatedKey);
      this.nachherImages1 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

      // Update prepopulated array to include new files so they display immediately
      this.prepopulatedNachherImages1 = normalized.map((img) => ({ ...img }));
    } else if (photoIndex === 1) {
      prepopulatedKey = 'prepopulatedNachherImages2';
      // Check for replaced images BEFORE syncing
      originalPrepopulated = [...this.prepopulatedNachherImages2];
      this.checkForReplacedImages(normalized, originalPrepopulated);
      this.syncPrepopulatedOrder(normalized, prepopulatedKey);
      this.nachherImages2 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

      // Update prepopulated array to include new files so they display immediately
      this.prepopulatedNachherImages2 = normalized.map((img) => ({ ...img }));
    } else if (photoIndex === 2) {
      prepopulatedKey = 'prepopulatedNachherImages3';
      // Check for replaced images BEFORE syncing
      originalPrepopulated = [...this.prepopulatedNachherImages3];
      this.checkForReplacedImages(normalized, originalPrepopulated);
      this.syncPrepopulatedOrder(normalized, prepopulatedKey);
      this.nachherImages3 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

      // Update prepopulated array to include new files so they display immediately
      this.prepopulatedNachherImages3 = normalized.map((img) => ({ ...img }));
    }
  }

  // Dynamic handler for deleting files from "Nachher only" photos at any index
  onNachherOnlyFileDeleted(event: { fileId: number; index: number }, photoIndex: number): void {
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: photoIndex, type: 'nachher-only' };
    this.showConfirmDeleteImageDialog = true;
  }

  onVorherImages3Changed(images: ImageItem[]): void {
    const normalized = this.normalizeImageList(images, 'before');
    // Check for replaced images BEFORE syncing
    const originalPrepopulated = [...this.prepopulatedVorherImages3];
    this.checkForReplacedImages(normalized, originalPrepopulated);
    this.syncPrepopulatedOrder(normalized, 'prepopulatedVorherImages3');
    this.vorherImages3 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately
    this.prepopulatedVorherImages3 = normalized.map((img) => ({ ...img }));
  }

  onNachherImages3Changed(images: ImageItem[]): void {
    const normalized = this.normalizeImageList(images, 'after');
    // Check for replaced images BEFORE syncing
    const originalPrepopulated = [...this.prepopulatedNachherImages3];
    this.checkForReplacedImages(normalized, originalPrepopulated);
    this.syncPrepopulatedOrder(normalized, 'prepopulatedNachherImages3');
    this.nachherImages3 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately
    this.prepopulatedNachherImages3 = normalized.map((img) => ({ ...img }));
  }

  onBeforeAfterCrossDrop(photoIndex: number, photo: any, payload: { event: CdkDragDrop<ImageItem[]>; listType: 'before' | 'after' | 'single'; dropListId: string }): void {
    if (!photo?.isBeforeAfter) {
      return;
    }

    const { event } = payload;

    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }

    // Store the source item and its label before transfer
    const sourceItem = event.previousContainer.data[event.previousIndex];
    const sourceLabel = sourceItem?.label;

    // Check if there's an item at the target position
    const hasTargetItem = event.container.data.length > event.currentIndex && event.container.data[event.currentIndex];
    const targetItem = hasTargetItem ? event.container.data[event.currentIndex] : null;
    const targetLabel = targetItem?.label;

    if (targetItem) {
    }

    // Transfer the image item (this moves the entire ImageItem including its label)
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);

    const targetType: 'before' | 'after' = event.container.id.includes('vorher-list-') ? 'before' : 'after';
    const movedItem = event.container.data[event.currentIndex];
    if (movedItem) {
      // Always set the label, even if undefined (to preserve the original label)
      movedItem.label = sourceLabel;
      movedItem.beforeAfterType = targetType;
    }

    // If there was a target item at the drop position, it was moved to the source position
    // Swap its label with the source label if needed
    if (targetItem && event.previousContainer.data.length > event.previousIndex) {
      // Find the item that was moved to the source position (it's the targetItem that was shifted)
      // After transferArrayItem, the target item (if it existed) is now at previousIndex in previousContainer
      const swappedItem = event.previousContainer.data[event.previousIndex];
      if (swappedItem && swappedItem !== sourceItem) {
        // This is the item that was at the target position, give it the target label
        swappedItem.label = targetLabel;
      }
    }

    const beforeData = event.container.id.includes('vorher-list-') ? event.container.data : event.previousContainer.id.includes('vorher-list-') ? event.previousContainer.data : undefined;

    const afterData = event.container.id.includes('nachher-list-') ? event.container.data : event.previousContainer.id.includes('nachher-list-') ? event.previousContainer.data : undefined;

    this.rebuildBeforeAfterCollections(photoIndex, beforeData, afterData);
  }

  private rebuildBeforeAfterCollections(photoIndex: number, beforeData?: ImageItem[], afterData?: ImageItem[]): void {
    const beforeConfig = this.getBeforeCollections(photoIndex);
    if (beforeConfig && beforeData) {
      // Preserve existing labels from items - don't reassign based on position
      // Labels should move with images during drag and drop
      const normalizedBefore = beforeData.map((item, index) => ({
        ...item,
        beforeAfterType: 'before' as const,
        order: index,
        // Explicitly preserve the label - it should already be set from the drag operation
        label: item.label,
      }));

      // Check for replaced images BEFORE syncing, using a copy of the current state
      const originalBeforePrepopulated = this.advancedPhotoImages[beforeConfig.preKey] ? [...this.advancedPhotoImages[beforeConfig.preKey]] : [...((this as any)[beforeConfig.preKey] || [])];
      this.checkForReplacedImages(normalizedBefore, originalBeforePrepopulated);

      // Only update items that have fileId (existing uploaded images)
      this.syncPrepopulatedOrder(normalizedBefore, beforeConfig.preKey);

      // Force Angular change detection by creating new array reference
      if (this.advancedPhotoImages[beforeConfig.preKey]) {
        this.advancedPhotoImages[beforeConfig.preKey] = [...this.advancedPhotoImages[beforeConfig.preKey]];
      } else {
        (this as any)[beforeConfig.preKey] = [...((this as any)[beforeConfig.preKey] || [])];
      }

      beforeConfig.setNew(normalizedBefore.filter((item) => !item.fileId).map((item) => ({ ...item })));
    }

    const afterConfig = this.getAfterCollections(photoIndex);
    if (afterConfig && afterData) {
      // Preserve existing labels from items - don't reassign based on position
      // Labels should move with images during drag and drop
      const normalizedAfter = afterData.map((item, index) => ({
        ...item,
        beforeAfterType: 'after' as const,
        order: index,
        // Explicitly preserve the label - it should already be set from the drag operation
        label: item.label,
      }));

      // Check for replaced images BEFORE syncing, using a copy of the current state
      const originalAfterPrepopulated = this.advancedPhotoImages[afterConfig.preKey] ? [...this.advancedPhotoImages[afterConfig.preKey]] : [...((this as any)[afterConfig.preKey] || [])];
      this.checkForReplacedImages(normalizedAfter, originalAfterPrepopulated);

      // Only update items that have fileId (existing uploaded images)
      this.syncPrepopulatedOrder(normalizedAfter, afterConfig.preKey);

      // Force Angular change detection by creating new array reference
      if (this.advancedPhotoImages[afterConfig.preKey]) {
        this.advancedPhotoImages[afterConfig.preKey] = [...this.advancedPhotoImages[afterConfig.preKey]];
      } else {
        (this as any)[afterConfig.preKey] = [...((this as any)[afterConfig.preKey] || [])];
      }

      afterConfig.setNew(normalizedAfter.filter((item) => !item.fileId).map((item) => ({ ...item })));
    }
  }

  private getBeforeCollections(photoIndex: number): { preKey: string; setNew: (list: ImageItem[]) => void } | null {
    const key = `before_${photoIndex}`;
    return {
      preKey: key,
      setNew: (list: ImageItem[]) => {
        this.newAdvancedPhotoImages[key] = list;
      },
    };
  }

  private getAfterCollections(photoIndex: number): { preKey: string; setNew: (list: ImageItem[]) => void } | null {
    const key = `after_${photoIndex}`;
    return {
      preKey: key,
      setNew: (list: ImageItem[]) => {
        this.newAdvancedPhotoImages[key] = list;
      },
    };
  }

  onPhotoFileRejected(message: string): void {
    this.photoUploadErrorMessage = message;
    this._toast.error(message, {
      position: 'bottom-right',
      duration: 5000,
    });
  }

  private handlePhotoUploadError(error: any): void {
    this.saving = false;
    this.savingType = null;

    const message = (error?.error?.message || error?.message || '').toString().toLowerCase();
    const isSizeError =
      error?.status === 413 || message.includes('too large') || message.includes('size') || message.includes('zu groß') || message.includes('payload') || message.includes('imagetoolarge');
    const isTimeout = error?.status === 408 || error?.name === 'TimeoutError' || message.includes('timeout') || message.includes('zeitüberschreitung');

    if (isSizeError) {
      this.photoUploadErrorMessage = 'Das Bild ist zu groß. Bitte laden Sie eine kleinere Datei hoch.';
    } else if (isTimeout) {
      this.photoUploadErrorMessage = 'Das Speichern hat zu lange gedauert. Bitte erneut versuchen – große Fotos werden beim Auswählen automatisch verkleinert.';
    } else {
      this.photoUploadErrorMessage = 'Fehler beim Speichern des Reports. Bitte versuchen Sie es erneut.';
    }

    this._toast.error(this.photoUploadErrorMessage, {
      position: 'bottom-right',
      duration: 5000,
    });
  }

  private normalizeImageList(images: ImageItem[], type: 'before' | 'after'): ImageItem[] {
    return images.map((img, index) => ({
      ...img,
      beforeAfterType: type,
      order: typeof img.order === 'number' ? img.order : index,
    }));
  }

  private isSameImageList(a: ImageItem[], b: ImageItem[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((item, index) => {
      const other = b[index];
      return item.fileId === other.fileId && item.fileName === other.fileName && item.label === other.label && item.order === other.order && item.preview === other.preview && item.file === other.file;
    });
  }

  private setAdvancedPhotoImages(key: string, images: ImageItem[]): void {
    const filtered = images.filter((img) => !img.fileId || !this.filesToDelete.includes(img.fileId)).map((img) => ({ ...img }));

    const existing = this.advancedPhotoImages[key];
    if (existing && this.isSameImageList(existing, filtered)) {
      return;
    }

    this.advancedPhotoImages[key] = filtered;
  }

  private syncPrepopulatedOrder(images: ImageItem[], key: PrepopulatedKey): void {
    // Check if key exists in advancedPhotoImages
    let prepopulatedImages: ImageItem[];
    if (this.advancedPhotoImages[key]) {
      prepopulatedImages = this.advancedPhotoImages[key];
    } else {
      // Fallback to legacy properties
      prepopulatedImages = (this as any)[key] as ImageItem[];
    }

    if (!Array.isArray(prepopulatedImages)) {
      return;
    }

    const reordered: ImageItem[] = [];
    const type: 'before' | 'after' = key.toLowerCase().includes('vorher') || key.startsWith('before_') ? 'before' : 'after';

    images.forEach((img, index) => {
      if (img.fileId && !img.file) {
        const existing = prepopulatedImages.find((pre) => pre.fileId === img.fileId);
        if (existing) {
          // IMPORTANT: Use the label from img (the new position), NOT from existing (old position)
          const updated = { ...existing, label: img.label, beforeAfterType: type, order: index };
          reordered.push(updated);
        } else {
          reordered.push({ ...img, label: img.label, beforeAfterType: type, order: index });
        }
      } else if (img.file || img.fileName || img.preview) {
        reordered.push({ ...img, label: img.label, beforeAfterType: type, order: index });
      }
    });

    // Update the correct storage
    if (this.advancedPhotoImages[key]) {
      this.advancedPhotoImages[key] = reordered.map((item) => ({ ...item }));
    } else {
      (this as any)[key] = reordered.map((item) => ({ ...item }));
    }
  }

  private buildPhotoOrderUpdates(): Array<{
    uploadedPhotoId: number;
    advancedPhotoId: number;
    beforeAfterType: 'before' | 'after';
    label?: string;
    order: number;
  }> {
    const updates: Array<{
      uploadedPhotoId: number;
      advancedPhotoId: number;
      beforeAfterType: 'before' | 'after';
      label?: string;
      order: number;
    }> = [];

    const pushUpdates = (images: ImageItem[] | undefined, advancedPhotoId: number, beforeAfterType: 'before' | 'after') => {
      if (!Array.isArray(images)) {
        return;
      }

      images.forEach((img, index) => {
        if (typeof img.fileId === 'number') {
          const update = {
            uploadedPhotoId: img.fileId,
            advancedPhotoId,
            beforeAfterType,
            label: img.label || null, // Explicitly set to null if undefined
            order: typeof img.order === 'number' ? img.order : index,
          };
          updates.push(update);
        }
      });
    };

    this.report?.project?.advancedPhotos?.forEach((advancedPhoto: any, photoIndex: number) => {
      if (!advancedPhoto) {
        return;
      }

      if (advancedPhoto.isBeforeAfter) {
        // Try dynamic storage first, then fallback to legacy if needed (though dynamic should be populated)
        const beforeImages = this.advancedPhotoImages[`before_${photoIndex}`] || (photoIndex === 0 ? this.prepopulatedVorherImages1 : photoIndex === 2 ? this.prepopulatedVorherImages3 : []);

        const afterImages = this.advancedPhotoImages[`after_${photoIndex}`] || (photoIndex === 0 ? this.prepopulatedNachherImages1 : photoIndex === 2 ? this.prepopulatedNachherImages3 : []);

        pushUpdates(beforeImages, advancedPhoto.id, 'before');
        pushUpdates(afterImages, advancedPhoto.id, 'after');
      } else {
        const afterImages =
          this.advancedPhotoImages[`after_${photoIndex}`] ||
          (photoIndex === 0 ? this.prepopulatedNachherImages1 : photoIndex === 1 ? this.prepopulatedNachherImages2 : photoIndex === 2 ? this.prepopulatedNachherImages3 : []);

        pushUpdates(afterImages, advancedPhoto.id, 'after');
      }
    });

    return updates;
  }

  // Check if any prepopulated images have been replaced with new files
  checkForReplacedImages(newImages: ImageItem[], prepopulatedImages: ImageItem[]): void {
    // Clear previous replaced images for this section
    prepopulatedImages.forEach((prepopulatedImg) => {
      if (prepopulatedImg.fileId) {
        delete this.replacedImages[prepopulatedImg.fileId];
      }
    });

    // Check for replaced images
    newImages.forEach((newImg) => {
      // If this is a new file (has file property) and has the same label as a prepopulated image
      if (newImg.file && newImg.label) {
        const matchingPrepopulated = prepopulatedImages.find(
          (prepopulatedImg) =>
            prepopulatedImg.label === newImg.label &&
            prepopulatedImg.fileId &&
            // Don't consider images that are already marked for deletion as "replaced"
            // Those are just new uploads to empty slots
            !this.filesToDelete.includes(prepopulatedImg.fileId),
        );

        if (matchingPrepopulated) {
          // This prepopulated image has been replaced
          this.replacedImages[matchingPrepopulated.fileId] = newImg;
        }
      }
    });
  }

  // Find photo information for a given label
  findPhotoInfoForLabel(label: string): { advancedPhotoId: number; beforeAfterType: string } | null {
    if (!this.report?.project?.advancedPhotos) return null;

    for (const advancedPhoto of this.report.project.advancedPhotos) {
      // Check if the label matches any of the photo labels
      if (advancedPhoto.labels && advancedPhoto.labels.includes(label)) {
        // Determine if this is a before or after photo based on the label position
        const labelIndex = advancedPhoto.labels.indexOf(label);

        // For before/after photos, the first half are "before", second half are "after"
        if (advancedPhoto.isBeforeAfter) {
          const midPoint = Math.ceil(advancedPhoto.labels.length / 2);
          const beforeAfterType = labelIndex < midPoint ? 'before' : 'after';
          return {
            advancedPhotoId: advancedPhoto.id,
            beforeAfterType: beforeAfterType,
          };
        } else {
          // For photos without before/after, everything is "after"
          return {
            advancedPhotoId: advancedPhoto.id,
            beforeAfterType: 'after',
          };
        }
      }
    }

    return null;
  }

  // Handler methods for file deletion events - now with confirmation
  onVorherImages1FileDeleted(event: { fileId: number; index: number }): void {
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 0, type: 'vorher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onNachherImages1FileDeleted(event: { fileId: number; index: number }): void {
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 0, type: 'nachher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onNachherImages2FileDeleted(event: { fileId: number; index: number }): void {
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 1, type: 'nachher-only' };
    this.showConfirmDeleteImageDialog = true;
  }

  onVorherImages3FileDeleted(event: { fileId: number; index: number }): void {
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 2, type: 'vorher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onNachherImages3FileDeleted(event: { fileId: number; index: number }): void {
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 2, type: 'nachher' };
    this.showConfirmDeleteImageDialog = true;
  }

  // Confirm image deletion
  confirmDeleteImage(): void {
    if (!this.pendingImageDelete) {
      return;
    }

    const { fileId, index, photoIndex, type } = this.pendingImageDelete;

    // Dynamic update
    const storageType = type === 'vorher' ? 'before' : 'after';
    const key = `${storageType}_${photoIndex}`;

    if (this.advancedPhotoImages[key]) {
      this.advancedPhotoImages[key] = this.advancedPhotoImages[key].filter((img) => img.fileId !== fileId);
    }

    if (this.newAdvancedPhotoImages[key]) {
      this.newAdvancedPhotoImages[key] = this.newAdvancedPhotoImages[key].filter((img) => img.fileId !== fileId);
    }

    // Legacy support
    if (type === 'vorher') {
      if (photoIndex === 0) {
        this.prepopulatedVorherImages1 = this.prepopulatedVorherImages1.filter((img) => img.fileId !== fileId);
        this.vorherImages1 = this.vorherImages1.filter((img) => img.fileId !== fileId);
      } else if (photoIndex === 2) {
        this.prepopulatedVorherImages3 = this.prepopulatedVorherImages3.filter((img) => img.fileId !== fileId);
        this.vorherImages3 = this.vorherImages3.filter((img) => img.fileId !== fileId);
      }
    } else if (type === 'nachher' || type === 'nachher-only') {
      if (photoIndex === 0) {
        this.prepopulatedNachherImages1 = this.prepopulatedNachherImages1.filter((img) => img.fileId !== fileId);
        this.nachherImages1 = this.nachherImages1.filter((img) => img.fileId !== fileId);
      } else if (photoIndex === 1) {
        this.prepopulatedNachherImages2 = this.prepopulatedNachherImages2.filter((img) => img.fileId !== fileId);
        this.nachherImages2 = this.nachherImages2.filter((img) => img.fileId !== fileId);
      } else if (photoIndex === 2) {
        this.prepopulatedNachherImages3 = this.prepopulatedNachherImages3.filter((img) => img.fileId !== fileId);
        this.nachherImages3 = this.nachherImages3.filter((img) => img.fileId !== fileId);
      }
    }

    // Add to files to delete array
    if (fileId && !this.filesToDelete.includes(fileId)) {
      this.filesToDelete.push(fileId);
    } else {
      console.warn('File ID not added to filesToDelete (missing or duplicate):', fileId);
    }

    // Clear any replaced image tracking for this file
    delete this.replacedImages[fileId];

    // Close dialog and reset pending delete
    this.showConfirmDeleteImageDialog = false;
    this.pendingImageDelete = null;

    // Show success message
    this._toast.success('Bild wurde zum Löschen markiert. Änderungen werden beim Speichern übernommen.', {
      position: 'bottom-right',
      duration: 3000,
    });
  }

  // Cancel image deletion
  cancelDeleteImage(): void {
    // Force Angular to re-run ngOnChanges on the child component so it restores
    // the row that was visually cleared when the user clicked X.
    if (this.pendingImageDelete) {
      const storageType = this.pendingImageDelete.type === 'vorher' ? 'before' : 'after';
      const key = `${storageType}_${this.pendingImageDelete.photoIndex}`;
      if (this.advancedPhotoImages[key]) {
        this.advancedPhotoImages[key] = [...this.advancedPhotoImages[key]];
      }
    }
    this.showConfirmDeleteImageDialog = false;
    this.pendingImageDelete = null;
  }

  private invalidateProjectReportCache(): void {
    const projectId = this.report?.project?.id || this.projectId;
    if (projectId) {
      this.reportCacheService.invalidate(projectId);
    }
  }

  /**
   * Refreshes the report data silently without showing the loading state.
   * This preserves the current view and updates data in the background.
   * Only updates the necessary data without triggering full re-renders.
   */
  private refreshReportSilently(): void {
    this.reportService.getReportById(this.reportId).subscribe({
      next: (data) => {
        // Update report properties in place to avoid full re-render
        // Instead of replacing entire object: this.report = data
        if (this.report && data) {
          // Update specific properties without replacing the object reference
          Object.assign(this.report, {
            ...data,
            project: this.report.project ? { ...this.report.project, ...data.project } : data.project,
          });
        } else {
          this.report = data;
        }

        // Prefill appointment date from report data
        if (this.report.visitDate) {
          this.report.visitDate = new Date(this.report.visitDate);
        }
        if (this.report.nextVisitDate) {
          this.nextVisitDate = new Date(this.report.nextVisitDate);
        } else {
          this.nextVisitDate = null;
        }

        // Process conversation messages
        this.processConversationMessages();

        // Initialize question data
        this.initializeQuestionData();

        // Process uploaded photos and update prepopulated arrays in place
        this.processUploadedAdvancedPhotosInPlace();

        // Clear the new file arrays since they've been uploaded (in place)
        this.vorherImages1.length = 0;
        this.nachherImages1.length = 0;
        this.nachherImages2.length = 0;
        this.vorherImages3.length = 0;
        this.nachherImages3.length = 0;

        // Clear dynamic new images to prevent duplicate uploads on subsequent saves
        Object.keys(this.newAdvancedPhotoImages).forEach((key) => {
          this.newAdvancedPhotoImages[key] = [];
        });

        // Scroll to bottom after messages are loaded and DOM is updated
        setTimeout(() => this.scrollToBottom(), 400);
      },
      error: (error) => {
        console.error('Error silently refreshing report:', error);
        // Don't show error toast - the save was successful, just the refresh failed
      },
    });
  }

  /**
   * Process uploaded advanced photos and update prepopulated arrays in place
   * to avoid triggering ngOnChanges in child components
   */
  private processUploadedAdvancedPhotosInPlace(): void {
    if (!this.report?.uploadedAdvancedPhotos || !this.report?.project?.advancedPhotos) {
      return;
    }

    this.report.uploadedAdvancedPhotos = sortUploadedAdvancedPhotos(this.report.uploadedAdvancedPhotos);

    // Group uploaded photos by advancedPhotoId and beforeAfterType
    const groupedPhotos: { [key: string]: any[] } = {};

    this.report.uploadedAdvancedPhotos.forEach((uploadedPhoto) => {
      const key = `${uploadedPhoto.advancedPhoto.id}_${uploadedPhoto.beforeAfterType}`;
      if (!groupedPhotos[key]) {
        groupedPhotos[key] = [];
      }
      groupedPhotos[key].push(uploadedPhoto);
    });

    // Process each advanced photo section
    this.report.project.advancedPhotos.forEach((advancedPhoto: any, photoIndex: number) => {
      const beforeKey = `${advancedPhoto.id}_before`;
      const afterKey = `${advancedPhoto.id}_after`;

      // Process before photos (vorher)
      if (advancedPhoto.isBeforeAfter && groupedPhotos[beforeKey]) {
        const sortedBefore = [...groupedPhotos[beforeKey]].sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 0;
          const orderB = typeof b.order === 'number' ? b.order : 0;
          return orderA - orderB;
        });

        const beforeImages: ImageItem[] = sortedBefore.map(
          (uploadedPhoto, idx): ImageItem =>
            ({
              id: uploadedPhoto.id,
              file: undefined,
              preview: uploadedPhoto.file.path,
              fileName: uploadedPhoto.file.path.split('/').pop() || 'image.jpg',
              label: uploadedPhoto.label,
              isImage: true,
              fileId: uploadedPhoto.id,
              beforeAfterType: 'before',
              order: typeof uploadedPhoto.order === 'number' ? uploadedPhoto.order : idx,
            }) as ImageItem & { order?: number },
        );

        // Update arrays in place
        const beforeStorageKey = `before_${photoIndex}`;
        if (!this.advancedPhotoImages[beforeStorageKey]) this.advancedPhotoImages[beforeStorageKey] = [];
        this.advancedPhotoImages[beforeStorageKey].length = 0;
        this.advancedPhotoImages[beforeStorageKey].push(...beforeImages);

        // Legacy support
        if (photoIndex === 0) {
          this.prepopulatedVorherImages1.length = 0;
          this.prepopulatedVorherImages1.push(...beforeImages);
        } else if (photoIndex === 2) {
          this.prepopulatedVorherImages3.length = 0;
          this.prepopulatedVorherImages3.push(...beforeImages);
        }
      }

      // Process after photos (nachher)
      const afterImages: ImageItem[] = groupedPhotos[afterKey]
        ? [...groupedPhotos[afterKey]]
            .sort((a, b) => {
              const orderA = typeof a.order === 'number' ? a.order : 0;
              const orderB = typeof b.order === 'number' ? b.order : 0;
              return orderA - orderB;
            })
            .map(
              (uploadedPhoto, idx): ImageItem =>
                ({
                  id: uploadedPhoto.id,
                  file: undefined,
                  preview: uploadedPhoto.file.path,
                  fileName: uploadedPhoto.file.path.split('/').pop() || 'image.jpg',
                  label: uploadedPhoto.label,
                  isImage: true,
                  fileId: uploadedPhoto.id,
                  beforeAfterType: 'after',
                  order: typeof uploadedPhoto.order === 'number' ? uploadedPhoto.order : idx,
                }) as ImageItem & { order?: number },
            )
        : [];

      // Update arrays in place
      const afterStorageKey = `after_${photoIndex}`;
      if (!this.advancedPhotoImages[afterStorageKey]) this.advancedPhotoImages[afterStorageKey] = [];
      this.advancedPhotoImages[afterStorageKey].length = 0;
      this.advancedPhotoImages[afterStorageKey].push(...afterImages);

      // Legacy support
      if (photoIndex === 0) {
        this.prepopulatedNachherImages1.length = 0;
        this.prepopulatedNachherImages1.push(...afterImages);
      } else if (photoIndex === 1) {
        this.prepopulatedNachherImages2.length = 0;
        this.prepopulatedNachherImages2.push(...afterImages);
      } else if (photoIndex === 2) {
        this.prepopulatedNachherImages3.length = 0;
        this.prepopulatedNachherImages3.push(...afterImages);
      }
    });
  }

  private getVisibleUploadedPhotoIdsFromUi(): number[] {
    const ids = new Set<number>();

    Object.values(this.advancedPhotoImages).forEach((images) => {
      if (!Array.isArray(images)) {
        return;
      }

      images.forEach((img) => {
        if (typeof img?.fileId === 'number') {
          ids.add(img.fileId);
        }
      });
    });

    return Array.from(ids);
  }

  private inferDeletedUploadedPhotoIdsFromUi(): number[] {
    const originallyLoadedIds = new Set<number>(
      Array.isArray(this.report?.uploadedAdvancedPhotos)
        ? this.report.uploadedAdvancedPhotos.map((photo: any) => (typeof photo?.id === 'number' ? photo.id : Number(photo?.id))).filter((id: number) => !Number.isNaN(id))
        : [],
    );

    if (originallyLoadedIds.size === 0) {
      return [];
    }

    const stillVisibleIds = new Set<number>(this.getVisibleUploadedPhotoIdsFromUi());
    return Array.from(originallyLoadedIds).filter((id) => !stillVisibleIds.has(id));
  }

  saveReportPhotos(): void {
    this.photoUploadErrorMessage = '';

    this.saving = true;
    this.savingType = 'save';

    // Collect all files from all image sections
    const allFiles: any[] = [];

    // Process advanced photos from the project
    if (this.report?.project?.advancedPhotos) {
      this.report.project.advancedPhotos.forEach((advancedPhoto: any, photoIndex: number) => {
        // Get the corresponding image arrays based on photo index
        const beforeKey = `before_${photoIndex}`;
        const afterKey = `after_${photoIndex}`;

        // Use dynamic storage for new images (files to upload)
        // Fallback to legacy arrays if dynamic is empty (though dynamic should be populated)
        let vorherImages = this.newAdvancedPhotoImages[beforeKey] || [];
        let nachherImages = this.newAdvancedPhotoImages[afterKey] || [];

        // Legacy fallback (just in case)
        if (vorherImages.length === 0 && nachherImages.length === 0) {
          if (photoIndex === 0) {
            vorherImages = this.vorherImages1;
            nachherImages = this.nachherImages1;
          } else if (photoIndex === 1) {
            nachherImages = this.nachherImages2;
          } else if (photoIndex === 2) {
            vorherImages = this.vorherImages3;
            nachherImages = this.nachherImages3;
          }
        }

        // For "Before/After" photos: use vorherImages and nachherImages arrays
        // For "Nachher only" photos: use nachherImages array directly (which contains only new uploads)
        if (advancedPhoto.isBeforeAfter) {
          // Before/After photos
          if (vorherImages.length > 0) {
            vorherImages.forEach((img, imgIndex) => {
              if (img.file) {
                allFiles.push({
                  file: img.file,
                  label: img.label || `Vorher ${photoIndex + 1}`,
                  advancedPhotoId: advancedPhoto.id,
                  fileName: img.fileName,
                  beforeAfterType: 'before',
                  order: typeof img.order === 'number' ? img.order : imgIndex,
                });
              }
            });
          }

          if (nachherImages.length > 0) {
            nachherImages.forEach((img, imgIndex) => {
              if (img.file) {
                allFiles.push({
                  file: img.file,
                  label: img.label || `Nachher ${photoIndex + 1}`,
                  advancedPhotoId: advancedPhoto.id,
                  fileName: img.fileName,
                  beforeAfterType: 'after',
                  order: typeof img.order === 'number' ? img.order : imgIndex,
                });
              }
            });
          }
        } else {
          // "Nachher only" photos: use nachherImages array directly
          // nachherImages2 already contains only new uploads (filtered in onNachherImages2Changed)
          if (nachherImages.length > 0) {
            nachherImages.forEach((img, imgIndex) => {
              if (img.file) {
                allFiles.push({
                  file: img.file,
                  label: img.label || `Nachher ${photoIndex + 1}`,
                  advancedPhotoId: advancedPhoto.id,
                  fileName: img.fileName,
                  beforeAfterType: 'after',
                  order: typeof img.order === 'number' ? img.order : imgIndex,
                });
              }
            });
          }
        }
      });
    }

    const photoOrderUpdates = this.buildPhotoOrderUpdates();

    // Add replaced images to files to delete
    Object.keys(this.replacedImages).forEach((fileIdStr) => {
      const fileId = parseInt(fileIdStr);
      if (!this.filesToDelete.includes(fileId)) {
        this.filesToDelete.push(fileId);
      }
    });

    const inferredDeletedIds = this.inferDeletedUploadedPhotoIdsFromUi();
    if (inferredDeletedIds.length > 0) {
      this.filesToDelete = Array.from(new Set([...this.filesToDelete, ...inferredDeletedIds]));
    }

    // Add replaced images as new files to upload
    Object.values(this.replacedImages).forEach((replacedImg) => {
      if (replacedImg.file) {
        // Find the corresponding advanced photo and beforeAfterType
        const photoInfo = this.findPhotoInfoForLabel(replacedImg.label);
        if (photoInfo) {
          allFiles.push({
            file: replacedImg.file,
            label: replacedImg.label,
            advancedPhotoId: photoInfo.advancedPhotoId,
            fileName: replacedImg.fileName,
            beforeAfterType: photoInfo.beforeAfterType,
          });
        }
      }
    });

    // Prepare answers for saving
    const answers = this.prepareAnswersForSave();

    // Prepare the complete payload for submission (without files)
    const payload = {
      visitDate: this.report.visitDate,
      nextVisitDate: this.nextVisitDate,
      answers: answers,
      status: this.report.status,
      filesToDelete: this.filesToDelete, // Add files to delete to the payload
    };

    if (photoOrderUpdates.length > 0) {
      (payload as any).photoOrderUpdates = photoOrderUpdates;
    }

    // Call the service to update the report with files
    this.reportService.updateReportWithFiles(this.reportId, payload, allFiles).subscribe({
      next: (response) => {
        this.saving = false;
        this.savingType = null;
        this.filesToDelete = [];
        this.replacedImages = {};
        this.photoUploadErrorMessage = '';

        if ((response as any)?._emailSendFailed) {
          this._toast.warning('Report gespeichert, aber die Zuweisungs-E-Mail konnte nicht gesendet werden.', {
            position: 'bottom-right',
            duration: 6000,
          });
        } else {
          this._toast.success('Report erfolgreich gespeichert!', {
            position: 'bottom-right',
            duration: 4000,
          });
        }

        // Silently refresh the report data without showing loading state
        this.refreshReportSilently();
      },
      error: (error) => {
        console.error('Error updating report:', error);
        this.handlePhotoUploadError(error);
      },
    });
  }

  /**
   * Save report and approve it (change status to Freigegeben)
   */
  confirmSaveAndApprove(): void {
    this.showConfirmApproveDialog = false;
    this.photoUploadErrorMessage = '';

    if (!this.validateRequiredQuestions()) {
      this._toast.error('Bitte füllen Sie alle erforderlichen Felder aus.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    this.saving = true;
    this.savingType = 'approve';

    // Collect all files from all image sections
    const allFiles: any[] = [];

    // Process advanced photos from the project (same logic as saveReportPhotos)
    if (this.report?.project?.advancedPhotos) {
      this.report.project.advancedPhotos.forEach((advancedPhoto: any, photoIndex: number) => {
        let vorherImages: ImageItem[] = [];
        let nachherImages: ImageItem[] = [];

        if (photoIndex === 0) {
          vorherImages = this.vorherImages1;
          nachherImages = this.nachherImages1;
        } else if (photoIndex === 1) {
          nachherImages = this.nachherImages2;
        } else if (photoIndex === 2) {
          vorherImages = this.vorherImages3;
          nachherImages = this.nachherImages3;
        }

        // Map photo index to prepopulated arrays
        let prepopulatedVorher: ImageItem[] = [];
        let prepopulatedNachher: ImageItem[] = [];

        if (photoIndex === 0) {
          prepopulatedVorher = this.prepopulatedVorherImages1;
          prepopulatedNachher = this.prepopulatedNachherImages1;
        } else if (photoIndex === 1) {
          prepopulatedNachher = this.prepopulatedNachherImages2;
        } else if (photoIndex === 2) {
          prepopulatedVorher = this.prepopulatedVorherImages3;
          prepopulatedNachher = this.prepopulatedNachherImages3;
        }

        // For "Nachher only" photos, we need to check prepopulated images as they contain the current state
        // For "Before/After" photos, we use the separate vorher/nachher arrays
        // Only include images with a file property (new uploads) in allFiles
        if (advancedPhoto.isBeforeAfter) {
          // Before/After photos: use vorherImages and nachherImages arrays
          if (vorherImages.length > 0) {
            vorherImages.forEach((img, imgIndex) => {
              if (img.file) {
                allFiles.push({
                  file: img.file,
                  label: img.label || `Vorher ${photoIndex + 1}`,
                  advancedPhotoId: advancedPhoto.id,
                  fileName: img.fileName,
                  beforeAfterType: 'before',
                  order: typeof img.order === 'number' ? img.order : imgIndex,
                });
              }
            });
          }

          if (nachherImages.length > 0) {
            nachherImages.forEach((img, imgIndex) => {
              if (img.file) {
                allFiles.push({
                  file: img.file,
                  label: img.label || `Nachher ${photoIndex + 1}`,
                  advancedPhotoId: advancedPhoto.id,
                  fileName: img.fileName,
                  beforeAfterType: 'after',
                  order: typeof img.order === 'number' ? img.order : imgIndex,
                });
              }
            });
          }
        } else {
          // "Nachher only" photos: need to check both prepopulated and new images
          // Combine prepopulated images (which may have been reordered) with new uploads
          // Only prepopulated images that have been replaced or new uploads will have a file property
          const allNachherImages = [...prepopulatedNachher, ...nachherImages];

          // Remove duplicates (if a prepopulated image was replaced, it will be in both arrays)
          const uniqueNachherImages = allNachherImages.filter((img, index, self) => {
            if (img.fileId) {
              // For existing images, keep only the first occurrence
              return index === self.findIndex((i) => i.fileId === img.fileId);
            }
            // For new images without fileId, check by file name or include all
            return true;
          });

          if (uniqueNachherImages.length > 0) {
            uniqueNachherImages.forEach((img, imgIndex) => {
              // Only add images with a file property (new uploads or replaced images)
              if (img.file) {
                allFiles.push({
                  file: img.file,
                  label: img.label || `Nachher ${photoIndex + 1}`,
                  advancedPhotoId: advancedPhoto.id,
                  fileName: img.fileName,
                  beforeAfterType: 'after',
                  order: typeof img.order === 'number' ? img.order : imgIndex,
                });
              }
            });
          }
        }
      });
    }

    // Add replaced images to files to delete
    Object.keys(this.replacedImages).forEach((fileIdStr) => {
      const fileId = parseInt(fileIdStr);
      if (!this.filesToDelete.includes(fileId)) {
        this.filesToDelete.push(fileId);
      }
    });

    const inferredDeletedIds = this.inferDeletedUploadedPhotoIdsFromUi();
    if (inferredDeletedIds.length > 0) {
      this.filesToDelete = Array.from(new Set([...this.filesToDelete, ...inferredDeletedIds]));
    }

    // Add replaced images as new files to upload
    Object.values(this.replacedImages).forEach((replacedImg) => {
      if (replacedImg.file) {
        const photoInfo = this.findPhotoInfoForLabel(replacedImg.label);
        if (photoInfo) {
          allFiles.push({
            file: replacedImg.file,
            label: replacedImg.label,
            advancedPhotoId: photoInfo.advancedPhotoId,
            fileName: replacedImg.fileName,
            beforeAfterType: photoInfo.beforeAfterType,
          });
        }
      }
    });

    // Prepare answers for saving
    const answers = this.prepareAnswersForSave();

    // Prepare the complete payload
    const payload = {
      visitDate: this.report.visitDate,
      nextVisitDate: this.nextVisitDate,
      answers: answers,
      status: this.report.status,
      filesToDelete: this.filesToDelete,
    };

    const photoOrderUpdates = this.buildPhotoOrderUpdates();
    if (photoOrderUpdates.length > 0) {
      (payload as any).photoOrderUpdates = photoOrderUpdates;
    }

    // First save the report, then approve it
    this.reportService.updateReportWithFiles(this.reportId, payload, allFiles).subscribe({
      next: (saveResponse) => {
        const emailFailed = (saveResponse as any)?._emailSendFailed;
        // After saving, approve the report (change status to Freigegeben)
        this.reportService
          .closeReport(this.reportId)
          .pipe(
            catchError((error) => {
              console.error('❌ Error approving report:', error);
              this.saving = false;
              this.savingType = null;
              this._toast.error('Fehler beim Freigeben des Reports.', {
                position: 'bottom-right',
                duration: 4000,
              });
              return of(null);
            }),
          )
          .subscribe({
            next: (response) => {
              this.saving = false;
              this.savingType = null;
              this.filesToDelete = [];
              this.replacedImages = {};
              this.photoUploadErrorMessage = '';

              if (response) {
                Object.assign(this.report, response);
              }
              this.invalidateProjectReportCache();

              if (emailFailed) {
                this._toast.warning('Report gespeichert und freigegeben, aber die Zuweisungs-E-Mail konnte nicht gesendet werden.', {
                  position: 'bottom-right',
                  duration: 6000,
                });
              } else {
                this._toast.success('Report erfolgreich gespeichert und freigegeben!', {
                  position: 'bottom-right',
                  duration: 4000,
                });
              }

              // Silently refresh the report data without showing loading state
              this.refreshReportSilently();
            },
          });
      },
      error: (error) => {
        console.error('Error saving report:', error);
        this.handlePhotoUploadError(error);
      },
    });
  }

  cancelConfirmApprove(): void {
    this.showConfirmApproveDialog = false;
  }

  get visibleQuestions(): any[] {
    return getVisibleProjectQuestions(this.report?.project?.questions);
  }

  // Returns the answer object for a given questionId from report.answers
  getAnswerForQuestion(questionId: number) {
    if (!this.report || !this.report.answers) return null;
    return this.report.answers.find((a: any) => a.question && a.question.id === questionId) || null;
  }

  // Message input values
  clientMessageContent: string = '';
  merchandiserMessageContent: string = '';

  // Accordion active value - set all panels open by default
  activeAccordionValue: string[] = ['0', '1', '2', '3'];

  // Send message to client
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
          setTimeout(() => this.scrollToBottom(), 300);
        }
        this.sendingClientMessage = false;
      },
      error: () => {
        this.sendingClientMessage = false;
      },
    });
  }

  // Send message to merchandiser
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
          setTimeout(() => this.scrollToBottom(), 300);
        }
        this.sendingMerchandiserMessage = false;
      },
      error: () => {
        this.sendingMerchandiserMessage = false;
      },
    });
  }

  sendingClientMessage = false;
  sendingMerchandiserMessage = false;

  // Process conversation messages and separate them for display
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

    // Separate messages for client (akzente <-> client)
    this.report.clientMessages = messages
      .filter(
        (msg) =>
          // Akzente -> Client
          (getTypeName(msg.senderType) === 'akzente' && (getTypeName(msg.receiverType) === 'client' || msg.receiverTypeString === 'client')) ||
          // Client -> Akzente
          (getTypeName(msg.senderType) === 'client' && (getTypeName(msg.receiverType) === 'akzente' || msg.receiverTypeString === 'akzente')),
      )
      .map((msg) => {
        const createdAt = new Date(msg.createdAt);
        const senderFirstName = msg.senderFirstName || '';
        const senderLastName = msg.senderLastName || '';
        const fullName = `${senderFirstName} ${senderLastName}`.trim();
        const isAkzente = getTypeName(msg.senderType) === 'akzente';
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

    // Separate messages for merchandiser (akzente <-> merchandiser)
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
        const isAkzente = getTypeName(msg.senderType) === 'akzente';
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
  }

  private getMerchandiserPortraitUrl(): string | null {
    const merch = this.report?.merchandiser as any;
    if (!merch || !Array.isArray(merch.files)) {
      return null;
    }
    const portrait = merch.files.find((f: any) => f?.type === 'portrait' && f.file?.path);
    return portrait ? portrait.file.path : null;
  }

  getMultiAnswersForQuestion(questionId: number): string {
    if (!this.report || !this.report.answers) return '';
    const answers = this.report.answers.filter((a: any) => a.question && a.question.id === questionId && a.selectedOption);
    return answers.map((a: any) => a.selectedOption.optionText).join(', ');
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

  showStatusConfirmation(status: string): void {
    // Prevent any status changes if report is already closed
    if (this.isReportClosed()) {
      this._toast.warning('Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    // Check if user can approve (sequential approval logic)
    if (status === 'Freigegeben' && !this.canUserApprove()) {
      this._toast.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
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
      this._toast.warning('Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    // Check if user can approve (sequential approval logic)
    if (status === 'Freigegeben' && !this.canUserApprove()) {
      this._toast.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
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
            this._toast.warning('Dieser Bericht ist bereits geschlossen', {
              position: 'bottom-right',
              duration: 3000,
            });
          } else if (error.error?.message?.includes('can only close reports')) {
            this._toast.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
              position: 'bottom-right',
              duration: 4000,
            });
          } else {
            this._toast.error('Fehler beim Aktualisieren des Status', {
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
            this._toast.success('Bericht erfolgreich geschlossen', {
              position: 'bottom-right',
              duration: 2000,
            });
          }
        },
      });
  }
}
