import { Component, OnInit, ViewEncapsulation, ElementRef, ViewChild, AfterViewInit, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ImageItem } from '../../../shared/components/multi-image-upload/multi-image-upload.component';
import { ReportService } from '@app/@core/services/report.service';
import { ClientService } from '@app/@core/services/client.service';
import { HotToastService } from '@ngneat/hot-toast';
import { catchError, EMPTY, of } from 'rxjs';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { ReportStatusEnum } from '@app/@core/enums/status.enum';
import {
  canMerchandiserApproveReport,
  isPendingMerchandiserAcceptance,
  isMerchandiserReportClosed,
  mapStatusToLifecycleState,
  ReportLifecycleState,
} from '@app/@core/utils/report-merchandiser-status.util';
import { REPORT_PHOTO_MAX_FILE_SIZE_BYTES, sortUploadedAdvancedPhotos } from '../../../shared/constants/report-photo-upload.constants';
import { isAdvancedPhotoVisible, resolvePhotoSlotCount, resolvePhotoLabelsForType, PhotoNamingContext } from '@app/@core/utils/advanced-photo.util';

interface GalleryItem {
  itemImageSrc: string;
  thumbnailImageSrc: string;
  title: string;
  alt: string;
  beforeAfterType?: string;
  date?: Date | string;
}

type PrepopulatedKey = string;

@Component({
  selector: 'app-report-edit',
  standalone: false,
  templateUrl: './report-edit.component.html',
  styleUrls: ['./report-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReportEditComponent implements OnInit, AfterViewInit, AfterViewChecked {
  reportId: string;
  clientId: string;
  projectId: string;
  report: any = null;
  loading: boolean = true;
  error: boolean = false;
  saving: boolean = false;
  savingAndApproving: boolean = false;
  backgroundUploadInProgress: boolean = false;
  downloadingExcel: boolean = false;
  showConfirmApproveDialog: boolean = false;
  selectedPhotoIndex: number = 0;
  galleryImages: GalleryItem[] = [];
  yesNoOptions = [
    { label: 'Ja', value: true },
    { label: 'Nein', value: false },
  ];
  templateVersionOptions = [
    { label: 'Version 1.0', value: 'v1.0' },
    { label: 'Version 1.1', value: 'v1.1' },
    { label: 'Version 2.0', value: 'v2.0' },
  ];

  localContactOptions = [
    { label: 'Hans Müller', value: 'hans' },
    { label: 'Anna Schmidt', value: 'anna' },
    { label: 'Thomas Weber', value: 'thomas' },
  ];

  inventoryStatusOptions = [
    { label: 'Ausreichend', value: 'sufficient' },
    { label: 'Nachbestellt', value: 'reordered' },
    { label: 'Knapp', value: 'low' },
  ];
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

  // Dynamic map for advanced photo images (supports any number of photo sections)
  advancedPhotoImages: { [key: string]: ImageItem[] } = {};
  newAdvancedPhotoImages: { [key: string]: ImageItem[] } = {};

  // Image collection properties (legacy - kept for compatibility)
  vorherImages1: ImageItem[] = [];
  nachherImages1: ImageItem[] = [];
  nachherImages2: ImageItem[] = [];
  vorherImages3: ImageItem[] = [];
  nachherImages3: ImageItem[] = [];

  // Prepopulated images for each photo section (legacy - kept for compatibility)
  prepopulatedVorherImages1: ImageItem[] = [];
  prepopulatedNachherImages1: ImageItem[] = [];
  prepopulatedNachherImages2: ImageItem[] = [];
  prepopulatedVorherImages3: ImageItem[] = [];
  prepopulatedNachherImages3: ImageItem[] = [];

  // Dynamic form data for questions
  questionAnswers: { [questionId: number]: any } = {};
  questionOptions: { [questionId: number]: string[] } = {};
  filteredQuestionOptions: { [questionId: number]: string[] } = {};

  // Files to delete and replaced images tracking
  filesToDelete: number[] = [];
  replacedImages: { [fileId: number]: ImageItem } = {};

  // Image deletion dialog properties
  showConfirmDeleteImageDialog: boolean = false;
  pendingImageDelete: { fileId: number; index: number; photoIndex: number; type: 'vorher' | 'nachher' | 'nachher-only' } | null = null;
  photoUploadErrorMessage: string = '';
  photoUploadStatusMessage: string = '';
  readonly reportPhotoMaxFileSizeBytes = REPORT_PHOTO_MAX_FILE_SIZE_BYTES;

  // Next visit date (informational only, no auto follow-up)
  nextVisitDate: Date | null = null;

  // Lifecycle state for 3-state display
  reportState: ReportLifecycleState = 'NOT_STARTED';
  isAdvancingState: boolean = false;

  // Conversation and messaging properties (from report-detail)
  public clientMessageContent: string = '';
  public sendingClientMessage = false;
  @ViewChild('clientScrollContainer', { static: false }) clientScrollContainer!: ElementRef;
  private shouldScroll = false;
  private isFromNotifications = false;

  // Accordion active value - set all panels open by default
  activeAccordionValue: string[] = ['0', '1', '2', '3'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private reportService: ReportService,
    private toast: HotToastService,
    private clientService: ClientService,
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    // Extract route parameters - using clientId instead of clientSlug for ID-based routing
    this.clientId = this.route.snapshot.paramMap.get('clientId');
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    // Extract reportId and clean it (remove any query parameters that might be accidentally included)
    const rawReportId = this.route.snapshot.paramMap.get('reportID');
    this.reportId = rawReportId ? rawReportId.split('?')[0].split('/')[0] : null;
    const referrer = this.route.snapshot.queryParamMap.get('referrer') || this.route.snapshot.queryParamMap.get('reference');
    this.isFromNotifications = referrer === 'notifications';

    // Initialize arrays to prevent template errors
    this.galleryImages = [];
    this.report = null;

    this.syncNavigationContextFromRoute();
    this.loadReportDetails();
  }

  ngAfterViewInit() {}

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom() {
    // Try scrolling multiple times with increasing delays to ensure DOM is fully rendered
    // This handles cases where the element is conditionally rendered with *ngIf
    const tryScroll = (delay: number) => {
      setTimeout(() => {
        if (this.clientScrollContainer?.nativeElement) {
          const element = this.clientScrollContainer.nativeElement;
          // Force scroll to bottom
          element.scrollTop = element.scrollHeight;
          // Also try using scrollIntoView as a fallback
          if (element.lastElementChild) {
            element.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }
      }, delay);
    };

    // Try immediately
    tryScroll(0);
    // Try after a short delay
    tryScroll(100);
    // Try after a longer delay (for slower DOM updates)
    tryScroll(300);
  }

  private triggerScrollToBottom() {
    this.shouldScroll = true;
  }

  get reportQuestions(): any[] {
    return this.report?.dataset?.questions ?? this.report?.project?.questions ?? [];
  }

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

  loadReportDetails(): void {
    this.loading = true;
    this.error = false;
    this.reportService.getReportById(this.reportId).subscribe({
      next: (data) => {
        this.report = data;

        // Ensure proper data structure initialization
        if (!this.report) {
          this.report = {};
        }

        if (this.report.visitDate && typeof this.report.visitDate === 'string') {
          this.report.visitDate = new Date(this.report.visitDate);
        }

        if (!this.report.project) this.report.project = {};
        if (!this.report.project.questions) this.report.project.questions = [];

        // Merge project.photos into advancedPhotos so they render in the template
        if (this.report.project.photos?.length && !this.report.project.advancedPhotos?.length) {
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

        // Sort questions by ID (whichever source is used)
        const sortQs = (arr: any[]) => arr.sort((a: any, b: any) => a.id - b.id);
        if (this.report.project.questions) {
          sortQs(this.report.project.questions);
        }
        if (this.report.dataset?.questions) {
          sortQs(this.report.dataset.questions);
        }

        if (!this.report.answers) this.report.answers = [];
        if (!this.report.photos && this.report.project.photos) this.report.photos = this.report.project.photos;
        if (!this.report.conversation) this.report.conversation = { messages: [] };
        if (!this.report.merchandiserMessages) this.report.merchandiserMessages = [];

        // Initialize next visit date
        this.nextVisitDate = this.report.nextVisitDate ? new Date(this.report.nextVisitDate) : null;

        // Derive lifecycle state from status
        this.reportState = mapStatusToLifecycleState(this.report?.status);

        console.log('📋 Report loaded, answers:', this.report.answers);

        this.report.uploadedAdvancedPhotos = this.dedupeUploadedAdvancedPhotosForSlots(this.report.uploadedAdvancedPhotos || []);
        this.galleryImages = this.buildGalleryImagesFromUploads(this.report.uploadedAdvancedPhotos);

        this.syncRouteIdsFromReport();
        this.syncNavigationContext();

        this.processConversationMessages();

        // Check if a dataset snapshot exists; if not, create one from project questions
        if (!this.report.dataset && this.report?.project?.questions?.length) {
          this.initReportDataset();
        } else {
          this.finalizeAfterLoad();
        }
      },
      error: (error) => {
        console.error('Error loading report details:', error);
        this.error = true;
        this.loading = false;

        // Check if it's a 403 Forbidden error (permission denied)
        if (error.status === 403) {
          this.toast.error('Sie haben keine Berechtigung, diesen Bericht zu bearbeiten.', {
            position: 'bottom-right',
            duration: 3000,
          });
          this.router.navigate(['/dashboard']);
        } else {
          this.toast.error('Fehler beim Laden des Berichts.', {
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

  private initReportDataset(): void {
    const questions = [...(this.report?.project?.questions || [])];
    this.reportService.initReportDataset(this.reportId, questions).subscribe({
      next: (dataset) => {
        this.report.dataset = dataset;
        this.finalizeAfterLoad();
      },
      error: () => {
        this.finalizeAfterLoad();
      },
    });
  }

  private finalizeAfterLoad(): void {
    this.initializeQuestionData();
    this.processUploadedAdvancedPhotos();
    this.loading = false;
  }

  // Initialize question data when report is loaded
  initializeQuestionData(): void {
    if (!this.reportQuestions.length) return;

    this.reportQuestions.forEach((question) => {
      const questionId = question.id;

      // Initialize options for this question
      this.questionOptions[questionId] = question.options?.map((option) => option.optionText) || [];
      this.filteredQuestionOptions[questionId] = [...this.questionOptions[questionId]];

      const answerType = question.answerType?.name;
      if (!answerType) {
        return;
      }

      // Handle multiselect separately since it has multiple answer entries
      if (answerType === 'multiselect') {
        // For multiselect, find all answers for this question
        // Each multiselect option is stored as a separate answer entry
        const multiselectAnswers =
          this.report.answers?.filter((answer) => {
            // Handle both cases: answer.question.id or answer.questionId
            const qId = answer.question?.id || answer.questionId;
            return qId === questionId && answer.selectedOption;
          }) || [];
        console.log('🔍 Loading multiselect answers for question', questionId, ':', multiselectAnswers);
        if (multiselectAnswers.length > 0) {
          const selectedOptions = multiselectAnswers.map((answer) => answer.selectedOption?.optionText).filter((text) => text !== null && text !== undefined);
          console.log('✅ Selected options loaded:', selectedOptions);
          this.questionAnswers[questionId] = selectedOptions;
        } else {
          console.log('⚠️ No multiselect answers found, initializing empty array');
          this.questionAnswers[questionId] = [];
        }
      } else {
        // For other answer types, find the single answer entry
        const existingAnswer = this.report.answers?.find((answer) => {
          const qId = answer.question?.id || answer.questionId;
          return qId === questionId;
        });

        if (existingAnswer) {
          switch (answerType) {
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
          }
        } else {
          // Set default values for non-multiselect questions
          switch (answerType) {
            case 'text':
              this.questionAnswers[questionId] = '';
              break;
            case 'boolean':
              this.questionAnswers[questionId] = null;
              break;
            case 'select':
              this.questionAnswers[questionId] = null;
              break;
          }
        }
      }
    });
  }

  // Conversation processing method (exact same as report-detail)
  processConversationMessages(): void {
    if (!this.report?.conversation?.messages) {
      this.report.merchandiserMessages = [];
      if (this.isFromNotifications) {
        this.triggerScrollToBottom();
      }
      return;
    }
    const messages = this.report.conversation.messages;
    console.log('🔄 Processing conversation messages:', messages);

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
    if (this.isFromNotifications) {
      this.triggerScrollToBottom();
    }
  }

  // Message sending method (exact same as report-detail)
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
        }
        this.sendingClientMessage = false;
      },
      error: () => {
        this.sendingClientMessage = false;
      },
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

  // Confirm image deletion
  confirmDeleteImage(): void {
    if (this.isReportReadOnly()) {
      this.showConfirmDeleteImageDialog = false;
      this.pendingImageDelete = null;
      return;
    }

    if (!this.pendingImageDelete) {
      return;
    }

    const { fileId, index, photoIndex, type } = this.pendingImageDelete;

    console.log(`Confirming deletion of image: fileId=${fileId}, index=${index}, type=${type}`);

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
      console.log('Added to filesToDelete:', this.filesToDelete);
    } else {
      console.warn('File ID not added to filesToDelete (missing or duplicate):', fileId);
    }

    // Clear any replaced image tracking for this file
    delete this.replacedImages[fileId];

    // Close dialog and reset pending delete
    this.showConfirmDeleteImageDialog = false;
    this.pendingImageDelete = null;

    // Show success message
    this.toast.success('Bild wurde zum Löschen markiert. Änderungen werden beim Speichern übernommen.', {
      position: 'bottom-right',
      duration: 3000,
    });
  }

  public getAnswerForQuestion(questionId: number): any {
    if (!this.report?.answers) return null;
    const answer = this.report.answers.find((ans: any) => ans.question?.id === questionId);
    return answer?.textAnswer || answer?.selectedOption?.optionText || null;
  }

  public getMultiAnswersForQuestion(questionId: number): string[] {
    if (!this.report?.answers) return [];
    // For multiselect, there are multiple answer entries, each with one selectedOption
    const answers = this.report.answers.filter((ans: any) => ans.question?.id === questionId && ans.selectedOption);
    return answers.map((ans: any) => ans.selectedOption.optionText) || [];
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

  onFavoriteChanged(newStatus: boolean, report: any): void {
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

  get allRequiredQuestionsAnswered(): boolean {
    return this.getUnansweredRequiredQuestions().length === 0;
  }

  getUnansweredRequiredQuestions(): Array<{ id: number; questionText: string }> {
    const unanswered: Array<{ id: number; questionText: string }> = [];
    for (const question of this.reportQuestions) {
      if (!question.isRequired) continue;
      const answer = this.questionAnswers[question.id];
      const type = question.answerType?.name;
      let isAnswered = false;
      switch (type) {
        case 'text':
          isAnswered = answer !== null && answer !== undefined && String(answer).trim() !== '';
          break;
        case 'boolean':
          isAnswered = answer === true || answer === false;
          break;
        case 'select':
          isAnswered = answer !== null && answer !== undefined;
          break;
        case 'multiselect':
          isAnswered = Array.isArray(answer) && answer.length > 0;
          break;
        default:
          isAnswered = answer !== null && answer !== undefined;
      }
      if (!isAnswered) {
        unanswered.push({ id: question.id, questionText: question.questionText });
      }
    }
    return unanswered;
  }

  advanceToInProgress(): void {
    if (this.isAdvancingState || this.isReportReadOnly()) return;
    this.isAdvancingState = true;
    this.reportService.transitionReportToInProgress(this.reportId).subscribe({
      next: (response) => {
        this.isAdvancingState = false;
        if (response) {
          this.report = response;
          this.reportState = mapStatusToLifecycleState(this.report?.status);
          this.toast.success('Bericht wird jetzt bearbeitet', {
            position: 'bottom-right',
            duration: 3000,
          });
        }
      },
      error: () => {
        this.isAdvancingState = false;
        this.toast.error('Status konnte nicht geändert werden', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
    });
  }

  onNextVisitDateSelected(date: Date | null): void {
    this.nextVisitDate = date;
  }

  prepareAnswersForSave(): any[] {
    const answers: any[] = [];

    if (!this.reportQuestions.length) {
      return answers;
    }

    Object.keys(this.questionAnswers).forEach((questionIdStr) => {
      const questionId = parseInt(questionIdStr);
      const answer = this.questionAnswers[questionId];
      const question = this.reportQuestions.find((q) => q.id === questionId);

      if (question && answer !== null && answer !== undefined) {
        const answerType = question.answerType?.name;
        if (!answerType) {
          return;
        }

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

  saveReportPhotos(): void {
    if (this.backgroundUploadInProgress) {
      this.toast.warning('Ihre Fotos werden noch hochgeladen. Bitte einen Moment warten.', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    this.photoUploadErrorMessage = '';
    this.photoUploadStatusMessage = '';
    if (this.isReportReadOnly()) {
      this.toast.warning(this.isReportClosed() ? 'Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden' : 'Bitte zuerst die Anfrage annehmen oder ablehnen.', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    if (!this.report || this.saving) {
      return;
    }

    this.saving = true;

    const { allFiles, inferredDeletedIds } = this.collectFilesForUpload();
    if (inferredDeletedIds.length > 0) {
      this.filesToDelete = Array.from(new Set([...this.filesToDelete, ...inferredDeletedIds]));
    }

    const answers = this.prepareAnswersForSave();
    const photoOrderUpdates = this.buildPhotoOrderUpdates();

    const payload = {
      visitDate: this.report.visitDate,
      answers,
      status: this.report.status,
      filesToDelete: this.filesToDelete,
      nextVisitDate: this.nextVisitDate,
    };

    if (photoOrderUpdates.length > 0) {
      (payload as any).photoOrderUpdates = photoOrderUpdates;
    }

    // Step 1: Save metadata (fast) — no files
    const allFilesToUpload = allFiles;
    const hasFiles = allFilesToUpload.length > 0;

    this.reportService.updateReportWithFiles(this.reportId, payload, []).subscribe({
      next: () => {
        this.saving = false;
        this.filesToDelete = [];
        this.photoUploadErrorMessage = '';
        this.photoUploadStatusMessage = '';

        this.toast.success('Report erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });

        if (hasFiles) {
          // Photos stay visible from local File previews (advancedPhotoImages).
          // Upload files in background, then refresh so server URLs replace local previews.
          this.backgroundUploadInProgress = true;
          this.reportService.uploadFiles(this.reportId, allFilesToUpload).subscribe({
            next: () => {
              this.backgroundUploadInProgress = false;
              this.replacedImages = {};
              this.refreshReportSilently();
            },
            error: (err) => {
              this.backgroundUploadInProgress = false;
              console.error('Background file upload error:', err);
              this.toast.error('Einige Bilder konnten nicht hochgeladen werden. Bitte erneut speichern.', {
                position: 'bottom-right',
                duration: 6000,
              });
            },
          });
        } else {
          // No files to upload — refresh immediately
          this.replacedImages = {};
          this.refreshReportSilently();
        }
      },
      error: (error) => {
        console.error('Error updating report:', error);
        this.handlePhotoUploadError(error);
      },
    });
  }

  onPhotoFileRejected(message: string): void {
    this.photoUploadErrorMessage = message;
    this.toast.error(message, {
      position: 'bottom-right',
      duration: 5000,
    });
  }

  /**
   * Collects all new files for upload and infers deleted photo IDs from the UI.
   */
  private collectFilesForUpload(): { allFiles: any[]; inferredDeletedIds: number[] } {
    const allFiles: any[] = [];

    if (this.report?.project?.advancedPhotos) {
      this.report.project.advancedPhotos.forEach((advancedPhoto: any, photoIndex: number) => {
        const beforeKey = `before_${photoIndex}`;
        const afterKey = `after_${photoIndex}`;

        let vorherImages = this.newAdvancedPhotoImages[beforeKey] || [];
        let nachherImages = this.newAdvancedPhotoImages[afterKey] || [];

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

        if (advancedPhoto.isBeforeAfter) {
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

    const inferredDeletedIds = this.inferDeletedUploadedPhotoIdsFromUi();

    return { allFiles, inferredDeletedIds };
  }

  private setPhotoUploadStatus(fileCount: number): void {
    if (fileCount <= 0) {
      this.photoUploadStatusMessage = 'Änderungen werden gespeichert…';
      return;
    }

    this.photoUploadStatusMessage =
      fileCount === 1 ? '1 Bild wird hochgeladen – große Fotos werden automatisch verkleinert…' : `${fileCount} Bilder werden hochgeladen – große Fotos werden automatisch verkleinert…`;
  }

  private handlePhotoUploadError(error: any): void {
    this.saving = false;
    this.savingAndApproving = false;
    this.photoUploadStatusMessage = '';

    const serverMessage = (error?.data?.message || error?.error?.message || error?.message || '').toString();
    const messageLower = serverMessage.toLowerCase();

    const isSizeError =
      error?.status === 413 ||
      messageLower.includes('too large') ||
      messageLower.includes('file too large') ||
      messageLower.includes('zu groß') ||
      messageLower.includes('payload') ||
      messageLower.includes('imagetoolarge') ||
      messageLower.includes('multer');
    const isTimeout = error?.status === 408 || error?.name === 'TimeoutError' || messageLower.includes('timeout') || messageLower.includes('zeitüberschreitung');
    const isNetworkError = error?.status === 0 || error?.status === undefined;
    const isClosedReport = error?.status === 403 && (messageLower.includes('closed') || messageLower.includes('geschlossen'));

    if (isClosedReport) {
      this.photoUploadErrorMessage = 'Dieser Bericht ist bereits freigegeben und kann nicht mehr bearbeitet werden.';
      this.refreshReportSilently();
    } else if (serverMessage && !isSizeError && !isTimeout && error?.status !== 500) {
      this.photoUploadErrorMessage = serverMessage;
    } else if (isSizeError) {
      this.photoUploadErrorMessage = 'Mindestens ein Bild ist zu groß. Bitte wählen Sie kleinere Fotos (max. 10 MB) – sie werden beim Auswählen automatisch verkleinert.';
    } else if (isTimeout) {
      this.photoUploadErrorMessage = 'Das Speichern hat zu lange gedauert. Bitte erneut versuchen – weniger Bilder auf einmal oder eine stabilere Verbindung kann helfen.';
    } else if (isNetworkError) {
      this.photoUploadErrorMessage = 'Verbindungsfehler beim Hochladen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
    } else if (error?.status === 422) {
      this.photoUploadErrorMessage = serverMessage || 'Einige Bilder konnten nicht gespeichert werden. Bitte erneut speichern oder kleinere Dateien verwenden.';
    } else {
      this.photoUploadErrorMessage = 'Fehler beim Speichern des Reports. Bitte versuchen Sie es erneut.';
    }

    this.toast.error(this.photoUploadErrorMessage, {
      position: 'bottom-right',
      duration: 6000,
    });
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

        // Ensure proper data structure initialization
        if (!this.report) {
          this.report = {};
        }
        if (!this.report.project) this.report.project = {};
        if (!this.report.project.questions) this.report.project.questions = [];

        // Merge project.photos into advancedPhotos so they render in the template
        if (this.report.project.photos?.length && !this.report.project.advancedPhotos?.length) {
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

        // Sort questions by ID (whichever source is used)
        const sortQs = (arr: any[]) => arr.sort((a: any, b: any) => a.id - b.id);
        if (this.report.project.questions) {
          sortQs(this.report.project.questions);
        }
        if (this.report.dataset?.questions) {
          sortQs(this.report.dataset.questions);
        }

        if (!this.report.answers) this.report.answers = [];
        if (!this.report.photos && this.report.project.photos) this.report.photos = this.report.project.photos;
        if (!this.report.conversation) this.report.conversation = { messages: [] };
        if (!this.report.merchandiserMessages) this.report.merchandiserMessages = [];

        console.log('📋 Report silently refreshed');

        this.report.uploadedAdvancedPhotos = this.dedupeUploadedAdvancedPhotosForSlots(this.report.uploadedAdvancedPhotos || []);
        const newGalleryImages = this.buildGalleryImagesFromUploads(this.report.uploadedAdvancedPhotos);
        this.galleryImages.length = 0;
        this.galleryImages.push(...newGalleryImages);

        // Refresh lifecycle display
        this.nextVisitDate = this.report.nextVisitDate ? new Date(this.report.nextVisitDate) : null;
        this.reportState = mapStatusToLifecycleState(this.report?.status);

        // Reinitialize data
        this.processConversationMessages();
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

    // Group uploaded photos by advancedPhotoId and beforeAfterType
    const groupedPhotos: { [key: string]: any[] } = {};

    this.report.uploadedAdvancedPhotos.forEach((uploadedPhoto: any) => {
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

  findPhotoInfoForLabel(label: string): { advancedPhotoId: number; beforeAfterType: string } | null {
    // This method should find the advancedPhotoId and beforeAfterType based on the label
    // For now, return null - you may need to implement this based on your label structure
    if (!this.report?.project?.advancedPhotos) {
      return null;
    }

    for (const photo of this.report.project.advancedPhotos) {
      if (photo.labels && photo.labels.includes(label)) {
        return {
          advancedPhotoId: photo.id,
          beforeAfterType: photo.isBeforeAfter ? 'after' : 'after',
        };
      }
    }

    return null;
  }

  public saveReport(): void {
    if (this.isReportReadOnly()) {
      return;
    }

    if (!this.report || this.saving) {
      return;
    }

    this.saving = true;

    // Prepare the report data for saving
    const reportData = {
      // Add all the form data here
      note: this.report.note || '',
      feedback: this.report.feedback || '',
      // Add other fields as needed
    };

    // Prepare files for upload
    const filesToUpload: any[] = [];

    // Collect files from all image collections
    const allImageCollections = [...this.vorherImages1, ...this.nachherImages1, ...this.nachherImages2, ...this.vorherImages3, ...this.nachherImages3];

    allImageCollections.forEach((imageItem) => {
      if (imageItem.file) {
        filesToUpload.push({
          file: imageItem.file,
          label: imageItem.label || '',
          advancedPhotoId: imageItem.advancedPhotoId,
          beforeAfterType: imageItem.beforeAfterType || 'before',
        });
      }
    });

    this.reportService.updateReportWithFiles(this.reportId, reportData, filesToUpload).subscribe({
      next: (response) => {
        console.log('✅ Report saved successfully:', response);
        this.toast.success('Bericht erfolgreich gespeichert', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
      error: (error) => {
        console.error('❌ Error saving report:', error);
        this.toast.error('Fehler beim Speichern des Berichts', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
      complete: () => {
        this.saving = false;
      },
    });
  }

  // Additional methods needed for HeadOffice template compatibility
  onAppointmentDateSelected(date: Date): void {
    if (this.isReportReadOnly()) {
      return;
    }
    this.report.visitDate = date;
  }

  onQuestionAnswerChanged(questionId: number): void {
    if (this.isReportReadOnly()) {
      return;
    }
    console.log('Question answer changed for question:', questionId, this.questionAnswers[questionId]);
  }

  filterQuestionOptions(event: any, questionId: number): void {
    const query = event.query.toLowerCase();
    this.filteredQuestionOptions[questionId] = this.questionOptions[questionId].filter((option) => option.toLowerCase().includes(query));
  }

  // Multi-select methods
  toggleMultiAnswer(questionId: number, option: string): void {
    if (this.isReportReadOnly()) {
      return;
    }

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

  // Check if a single select option is selected (for radio buttons)
  isSingleAnswerSelected(questionId: number, option: string): boolean {
    return this.questionAnswers[questionId] === option;
  }

  // Handle single select option click (radio button behavior)
  selectSingleAnswer(questionId: number, option: string): void {
    if (this.isReportReadOnly()) {
      return;
    }

    // If clicking the same option, deselect it (allow clearing)
    if (this.questionAnswers[questionId] === option) {
      this.questionAnswers[questionId] = null;
    } else {
      this.questionAnswers[questionId] = option;
    }
    this.onQuestionAnswerChanged(questionId);
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
    if (this.isReportReadOnly()) {
      return;
    }

    const normalized = this.normalizeImageList(images, type);
    const key = `${type}_${index}`;

    // Initialize array if it doesn't exist
    if (!this.advancedPhotoImages[key]) {
      this.advancedPhotoImages[key] = [];
    }

    // Check for replaced images BEFORE syncing, using the current prepopulated state
    const originalPrepopulated = [...this.advancedPhotoImages[key]];
    this.checkForReplacedImages(normalized, originalPrepopulated);

    // Sync with prepopulated order logic
    this.syncPrepopulatedOrder(normalized, key);

    // Update new images collection (exclude any already-deleted server files)
    this.newAdvancedPhotoImages[key] = normalized.filter((img) => !!img.file && (!img.fileId || !this.filesToDelete.includes(img.fileId))).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately.
    this.setAdvancedPhotoImages(key, normalized);

    console.log(`${type} images changed for index ${index}:`, images);
  }

  // Generic handler for file deletion
  onFileDeleted(event: { fileId: number; index: number }, index: number, type: 'before' | 'after'): void {
    if (this.isReportReadOnly()) {
      return;
    }

    console.log(`File deleted for index ${index} type ${type}:`, event);
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
      console.log('No uploaded advanced photos or project advanced photos found');
      return;
    }

    console.log('Processing uploaded advanced photos:', this.report.uploadedAdvancedPhotos);
    console.log('Project advanced photos:', this.report.project.advancedPhotos);

    // Group uploaded photos by advancedPhotoId and beforeAfterType
    const groupedPhotos: { [key: string]: any[] } = {};

    this.report.uploadedAdvancedPhotos.forEach((uploadedPhoto: any) => {
      const key = `${uploadedPhoto.advancedPhoto.id}_${uploadedPhoto.beforeAfterType}`;
      if (!groupedPhotos[key]) {
        groupedPhotos[key] = [];
      }
      groupedPhotos[key].push(uploadedPhoto);
    });

    console.log('Grouped photos:', groupedPhotos);

    // Process each advanced photo section
    this.report.project.advancedPhotos.forEach((advancedPhoto: any, photoIndex: number) => {
      const beforeKey = `${advancedPhoto.id}_before`;
      const afterKey = `${advancedPhoto.id}_after`;

      console.log(`Processing photo ${photoIndex}:`, { beforeKey, afterKey, advancedPhoto });

      // Process before photos (vorher)
      if (advancedPhoto.isBeforeAfter) {
        const sortedBefore = groupedPhotos[beforeKey]
          ? [...groupedPhotos[beforeKey]].sort((a, b) => {
              const orderA = typeof a.order === 'number' ? a.order : 0;
              const orderB = typeof b.order === 'number' ? b.order : 0;
              return orderA - orderB;
            })
          : [];

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

        // Store in dynamic map (always set, even if empty, to keep stable reference)
        this.advancedPhotoImages[`before_${photoIndex}`] = beforeImages;

        // Legacy support
        if (photoIndex === 0) {
          this.prepopulatedVorherImages1 = beforeImages;
        } else if (photoIndex === 2) {
          this.prepopulatedVorherImages3 = beforeImages;
        }
      }

      // Process after photos (nachher)
      const sortedAfter = groupedPhotos[afterKey]
        ? [...groupedPhotos[afterKey]].sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 0;
            const orderB = typeof b.order === 'number' ? b.order : 0;
            return orderA - orderB;
          })
        : [];

      const afterImages: ImageItem[] = sortedAfter.map(
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
      );

      // Store in dynamic map
      this.advancedPhotoImages[`after_${photoIndex}`] = afterImages;

      // Legacy support - assign to the correct array based on photo index
      if (photoIndex === 0) {
        this.prepopulatedNachherImages1 = afterImages;
      } else if (photoIndex === 1) {
        this.prepopulatedNachherImages2 = afterImages;
      } else if (photoIndex === 2) {
        this.prepopulatedNachherImages3 = afterImages;
      }
    });

    console.log('Final processed uploaded advanced photos (Dynamic):', this.advancedPhotoImages);
  }

  private normalizeImageList(images: ImageItem[], type: 'before' | 'after'): ImageItem[] {
    return images.map(
      (img, index) =>
        ({
          ...img,
          beforeAfterType: type,
          // Preserve the slot position coming from the uploader.
          // Falling back to index keeps backward compatibility for older payloads.
          order: typeof img.order === 'number' ? img.order : index,
        }) as ImageItem & { order?: number },
    );
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
    // Check if key exists in advancedPhotoImages (dynamic), else fall back to legacy
    let prepopulatedImages: ImageItem[];
    if (this.advancedPhotoImages[key]) {
      prepopulatedImages = this.advancedPhotoImages[key];
    } else {
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
          reordered.push({ ...existing, label: img.label, beforeAfterType: type, order: index } as ImageItem & { order?: number });
        } else {
          reordered.push({ ...img, label: img.label, beforeAfterType: type, order: index } as ImageItem & { order?: number });
        }
      } else if (img.file || img.fileName || img.preview) {
        reordered.push({ ...img, label: img.label, beforeAfterType: type, order: index } as ImageItem & { order?: number });
      }
    });

    // Update the correct storage
    if (this.advancedPhotoImages[key]) {
      this.advancedPhotoImages[key] = reordered.map((item) => ({ ...item }));
    } else {
      (this as any)[key] = reordered.map((item) => ({ ...item }));
    }
  }

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
          console.log(`Image replaced: ${matchingPrepopulated.fileId} with new file:`, newImg.fileName);
        }
      }
    });
  }

  // Image handling methods
  onVorherImages1Changed(images: ImageItem[]): void {
    const normalized = this.normalizeImageList(images, 'before');
    // Check for replaced images BEFORE syncing
    const originalPrepopulated = [...this.prepopulatedVorherImages1];
    this.checkForReplacedImages(normalized, originalPrepopulated);
    this.syncPrepopulatedOrder(normalized, 'prepopulatedVorherImages1');
    this.vorherImages1 = normalized.filter((img) => !!img.file).map((img) => ({ ...img }));

    // Update prepopulated array to include new files so they display immediately
    this.prepopulatedVorherImages1 = normalized.map((img) => ({ ...img }));

    console.log('Vorher images 1 changed:', images);
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

    console.log('Nachher images 1 changed:', images);
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

    console.log('Nachher images 2 changed:', images);
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

    console.log(`Nachher only images changed for photoIndex ${photoIndex}:`, images);
  }

  // Dynamic handler for deleting files from "Nachher only" photos at any index
  onNachherOnlyFileDeleted(event: { fileId: number; index: number }, photoIndex: number): void {
    console.log(`Nachher only file deleted for photoIndex ${photoIndex}:`, event);
    // Show confirmation dialog
    this.pendingImageDelete = {
      fileId: event.fileId,
      index: event.index,
      photoIndex: photoIndex,
      type: 'nachher-only',
    };
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

    console.log('Vorher images 3 changed:', images);
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

    console.log('Nachher images 3 changed:', images);
  }

  onVorherImages1FileDeleted(event: { fileId: number; index: number }): void {
    console.log('Vorher images 1 file deleted:', event);
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 0, type: 'vorher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onNachherImages1FileDeleted(event: { fileId: number; index: number }): void {
    console.log('Nachher images 1 file deleted:', event);
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 0, type: 'nachher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onNachherImages2FileDeleted(event: { fileId: number; index: number }): void {
    console.log('Nachher images 2 file deleted:', event);
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 1, type: 'nachher-only' };
    this.showConfirmDeleteImageDialog = true;
  }

  onVorherImages3FileDeleted(event: { fileId: number; index: number }): void {
    console.log('Vorher images 3 file deleted:', event);
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 2, type: 'vorher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onNachherImages3FileDeleted(event: { fileId: number; index: number }): void {
    console.log('Nachher images 3 file deleted:', event);
    // Show confirmation dialog
    this.pendingImageDelete = { fileId: event.fileId, index: event.index, photoIndex: 2, type: 'nachher' };
    this.showConfirmDeleteImageDialog = true;
  }

  onBeforeAfterCrossDrop(photoIndex: number, photo: any, payload: { event: CdkDragDrop<ImageItem[]>; listType: 'before' | 'after' | 'single'; dropListId: string }): void {
    if (this.isReportReadOnly()) {
      return;
    }

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
      const normalizedBefore = beforeData.map((item, index) => ({
        ...item,
        beforeAfterType: 'before' as const,
        order: index,
        label: item.label,
      }));

      const originalBeforePrepopulated = this.advancedPhotoImages[beforeConfig.preKey] ? [...this.advancedPhotoImages[beforeConfig.preKey]] : [...((this as any)[beforeConfig.preKey] || [])];
      this.checkForReplacedImages(normalizedBefore, originalBeforePrepopulated);

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
      const normalizedAfter = afterData.map((item, index) => ({
        ...item,
        beforeAfterType: 'after' as const,
        order: index,
        label: item.label,
      }));

      const originalAfterPrepopulated = this.advancedPhotoImages[afterConfig.preKey] ? [...this.advancedPhotoImages[afterConfig.preKey]] : [...((this as any)[afterConfig.preKey] || [])];
      this.checkForReplacedImages(normalizedAfter, originalAfterPrepopulated);

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
          updates.push({
            uploadedPhotoId: img.fileId,
            advancedPhotoId,
            beforeAfterType,
            label: img.label,
            order: typeof (img as any).order === 'number' ? (img as any).order : index,
          });
        }
      });
    };

    this.report?.project?.advancedPhotos?.forEach((advancedPhoto: any, photoIndex: number) => {
      if (!advancedPhoto) {
        return;
      }

      if (advancedPhoto.isBeforeAfter) {
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

  // ── 3-state lifecycle helpers ──────────────────────────────────

  private static readonly STATE_ORDER: Record<ReportLifecycleState, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    RELEASED: 2,
  };

  private static readonly STATE_LABELS: Record<ReportLifecycleState, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    RELEASED: 'Released',
  };

  get stateLabel(): string {
    return ReportEditComponent.STATE_LABELS[this.reportState];
  }

  isStateAtOrAfter(state: ReportLifecycleState): boolean {
    return ReportEditComponent.STATE_ORDER[this.reportState] >= ReportEditComponent.STATE_ORDER[state];
  }

  canTransitionTo(state: ReportLifecycleState): boolean {
    if (this.isReportReadOnly()) return false;
    const current = ReportEditComponent.STATE_ORDER[this.reportState];
    const target = ReportEditComponent.STATE_ORDER[state];
    return target === current + 1 || (state === 'RELEASED' && current === 0);
  }

  onStateClick(state: ReportLifecycleState): void {
    if (!this.canTransitionTo(state)) return;

    if (state === 'IN_PROGRESS') {
      this.advanceToInProgress();
    } else if (state === 'RELEASED') {
      this.showConfirmApproveDialog = true;
    }
  }

  isReportClosed(): boolean {
    return isMerchandiserReportClosed(this.report?.status);
  }

  isReportReadOnly(): boolean {
    return this.isReportClosed() || this.isAwaitingAssignmentAcceptance();
  }

  canUserApprove(): boolean {
    return canMerchandiserApproveReport(this.report?.status, this.report);
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
            this.toast.warning('Dieser Bericht ist bereits geschlossen', {
              position: 'bottom-right',
              duration: 3000,
            });
          } else if (error.error?.message?.includes('can only close reports')) {
            this.toast.warning('Sie können diesen Bericht noch nicht genehmigen. Warten Sie auf die vorherige Genehmigung.', {
              position: 'bottom-right',
              duration: 4000,
            });
          } else {
            this.toast.error('Fehler beim Aktualisieren des Status', {
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
            this.toast.success('Bericht erfolgreich geschlossen', {
              position: 'bottom-right',
              duration: 2000,
            });
          }
        },
      });
  }

  /**
   * Save report and approve it (change status to Freigegeben)
   */
  confirmSaveAndApprove(): void {
    if (this.backgroundUploadInProgress) {
      this.showConfirmApproveDialog = false;
      this.toast.warning('Ihre Fotos werden noch hochgeladen. Bitte einen Moment warten.', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    if (this.isReportReadOnly() || !this.canUserApprove()) {
      this.showConfirmApproveDialog = false;
      this.toast.warning(
        this.isReportClosed()
          ? 'Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden'
          : this.isAwaitingAssignmentAcceptance()
            ? 'Bitte zuerst die Anfrage annehmen oder ablehnen.'
            : 'Sie können diesen Bericht noch nicht freigeben.',
        {
          position: 'bottom-right',
          duration: 3000,
        },
      );
      return;
    }

    this.showConfirmApproveDialog = false;
    this.savingAndApproving = true;
    this.photoUploadErrorMessage = '';
    this.photoUploadStatusMessage = '';

    const { allFiles, inferredDeletedIds } = this.collectFilesForUpload();
    if (inferredDeletedIds.length > 0) {
      this.filesToDelete = Array.from(new Set([...this.filesToDelete, ...inferredDeletedIds]));
    }

    const answers = this.prepareAnswersForSave();
    const photoOrderUpdates = this.buildPhotoOrderUpdates();

    const unanswered = this.getUnansweredRequiredQuestions();
    if (unanswered.length > 0) {
      this.savingAndApproving = false;
      const questionList = unanswered.map((q) => `"${q.questionText}"`).join(', ');
      this.toast.error(`Bitte beantworten Sie alle Pflichtfragen: ${questionList}`, {
        position: 'bottom-right',
        duration: 6000,
      });
      return;
    }

    const payload = {
      visitDate: this.report.visitDate,
      answers,
      status: this.report.status,
      filesToDelete: this.filesToDelete,
      nextVisitDate: this.nextVisitDate,
    };

    if (photoOrderUpdates.length > 0) {
      (payload as any).photoOrderUpdates = photoOrderUpdates;
    }

    const hasFiles = allFiles.length > 0;
    const advance$ = this.reportState === 'NOT_STARTED'
      ? this.reportService.transitionReportToInProgress(this.reportId)
      : of(null);

    advance$.subscribe({
      next: () => {
        // Step 1: Save metadata (fast, no files)
        this.reportService.updateReportWithFiles(this.reportId, payload, []).subscribe({
          next: () => {
            this.photoUploadStatusMessage = 'Report wird freigegeben…';
            // Step 2: Approve (close) the report
            this.reportService
              .closeReport(this.reportId)
              .pipe(
                catchError((error) => {
                  console.error('Error approving report:', error);
                  this.savingAndApproving = false;
                  this.toast.error('Fehler beim Freigeben des Reports.', {
                    position: 'bottom-right',
                    duration: 4000,
                  });
                  return EMPTY;
                }),
              )
              .subscribe({
                next: () => {
                  this.savingAndApproving = false;
                  this.filesToDelete = [];
                  this.photoUploadStatusMessage = '';

                  this.toast.success('Report erfolgreich gespeichert und freigegeben!', {
                    position: 'bottom-right',
                    duration: 4000,
                  });

                  // Step 3: Upload files in background (if any)
                  if (hasFiles) {
                    // Photos stay visible from local File previews.
                    // After upload, refresh so server URLs replace local previews.
                    this.backgroundUploadInProgress = true;
                    this.reportService.uploadFiles(this.reportId, allFiles).subscribe({
                      next: () => {
                        this.backgroundUploadInProgress = false;
                        this.replacedImages = {};
                        this.refreshReportSilently();
                      },
                      error: (err) => {
                        this.backgroundUploadInProgress = false;
                        console.error('Background file upload error:', err);
                        this.toast.error('Einige Bilder konnten nicht hochgeladen werden. Bitte erneut speichern.', {
                          position: 'bottom-right',
                          duration: 6000,
                        });
                      },
                    });
                  } else {
                    this.replacedImages = {};
                    this.refreshReportSilently();
                  }
                },
              });
          },
          error: (error) => {
            console.error('Error saving report metadata:', error);
            this.savingAndApproving = false;
            this.handlePhotoUploadError(error);
          },
        });
      },
      error: () => {
        this.savingAndApproving = false;
        this.toast.error('Status konnte nicht geändert werden', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
    });
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
        this.toast.success('Excel-Export erfolgreich heruntergeladen');
      },
      error: (error) => {
        console.error('Error downloading Excel:', error);
        this.downloadingExcel = false;
        this.toast.error('Excel-Export fehlgeschlagen!');
      },
    });
  }

  cancelConfirmApprove(): void {
    this.showConfirmApproveDialog = false;
  }

  isAwaitingAssignmentAcceptance(): boolean {
    return isPendingMerchandiserAcceptance(this.report);
  }

  /**
   * Generate formatted address string for a report
   * Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
   */
  getFormattedAddress(report: any): string {
    if (!report) return '';

    const street = (report.street || report.branch?.street || '').trim();
    const zip = (report.zipCode || report.branch?.zipCode || '').trim();

    let city = '';
    if (report.branch?.city?.name) {
      city = report.branch.city.name.trim();
    }

    let country = '';
    if (report.branch?.city?.country) {
      const countryObj = report.branch.city.country;
      country = (countryObj.name?.de || countryObj.name || '').toString().trim();
    }

    const parts = [street, zip, city, country].filter(Boolean);
    return parts.join(', ');
  }
}
