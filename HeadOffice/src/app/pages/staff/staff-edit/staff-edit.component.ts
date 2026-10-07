import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../../shared/app-icon.component';
import { FavoriteToggleComponent } from '../../../shared/components/favorite-toggle/favorite-toggle.component';
import { FormsModule } from '@angular/forms';
import { MerchandiserService, Merchandiser, Review } from '@app/core/services/merchandiser.service';
import { FeedbackService, CreateReviewDto, CreateReviewResponse } from '@app/core/services/feedback.service';
import { InitializerService } from '@app/core/services/initializer.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { ConfirmationService } from 'primeng/api';
import { catchError, of, finalize } from 'rxjs';
import { StaffStateService } from '../list/staff-state.service';
import { isValidPhoneNumber } from '@app/@core/utils/form-validators.utility';

// Update the Feedback interface to match the API structure
interface Feedback {
  id: number;
  rating: number;
  review: string;
  createdAt: string;
  reviewer: {
    firstName: string;
    lastName: string;
  };
}

interface FeedbackStats {
  averageRating: number;
  totalReviews: number;
}

@Component({
  selector: 'app-staff-edit',
  standalone: true,
  imports: [CommonModule, ImportsModule, AppIconComponent, FavoriteToggleComponent, FormsModule],
  templateUrl: './staff-edit.component.html',
  styleUrls: ['./staff-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [ConfirmationService],
})
export class StaffEditComponent implements OnInit {
  staffId: string;
  staffMember: any = null;
  merchandiser: Merchandiser | null = null;
  loading: boolean = true;
  error: boolean = false;
  errorMessage: string = '';

  // Feedback properties
  feedbackDialogVisible = false;
  rating: number = 0;
  reviewText: string = '';
  submittingFeedback = false;
  feedbacks: Feedback[] = [];
  loadingFeedbacks = false;
  feedbackStats: FeedbackStats | null = null;
  userHasReviewed = false;
  statuses: { id: number; name: string }[] = [];
  languageLevels: { id: number; name: string; code: string }[] = [];
  availableJobTypes: { id: number; name: string }[] = [];
  availableLanguages: { id: number; name: string }[] = [];

  // Email edit state
  emailEditMode: boolean = false;
  originalEmail: string = '';
  savingEmail: boolean = false;
  pendingNewEmail: string = '';

  // Form states
  showAddEducationForm: boolean = false;
  newEducation: { qualification: string; institution: string; graduationDate: string } = { qualification: '', institution: '', graduationDate: '' };
  showAddReferenceForm: boolean = false;
  newReference: { company: string; activity: string; industry: string; fromDate: string; toDate: string } = { company: '', activity: '', industry: '', fromDate: '', toDate: '' };

  // Save button states
  savingContractual: boolean = false;
  savingQualification: boolean = false;
  savingReferences: boolean = false;
  savingLanguages: boolean = false;
  savingFiles: boolean = false;

  // Accordion active value - start with all panels open by default (5 = Feedback)
  activeAccordionValue: string[] = ['0', '5', '1', '2', '3', '4'];
  savingHeader: boolean = false;
  phoneInvalid = false;
  phoneTouched = false;

  // File deletion tracking
  filesToDelete: number[] = [];

  private readonly _toast = inject(HotToastService);
  private readonly _confirmationService = inject(ConfirmationService);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private merchandiserService: MerchandiserService,
    private feedbackService: FeedbackService,
    private initializerService: InitializerService,
    private staffStateService: StaffStateService,
  ) {}

  ngOnInit(): void {
    this.staffId = this.route.snapshot.paramMap.get('id') || '';
    if (this.staffId) {
      this.loadStaffDetails();
    } else {
      this.error = true;
      this.errorMessage = 'Keine gültige Personal-ID gefunden';
      this.loading = false;
    }
  }

  navigateBackToStaffList(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    if (this.staffId) {
      this.router.navigate(['/staff', this.staffId]);
      return;
    }
    this.router.navigate(['/staff']);
  }

  navigateToStaffDetail(): void {
    if (this.staffId) {
      this.router.navigate(['/staff', this.staffId]);
    }
  }

  get staffEmail(): string {
    return this.staffMember?.email?.trim() || this.merchandiser?.user?.email?.trim() || this.merchandiser?.email?.trim() || '';
  }

  showNoEmailError(): void {
    this._toast.error('Keine E-Mail-Adresse vorhanden', {
      position: 'bottom-right',
      duration: 3000,
    });
  }

  toggleEmailEdit(): void {
    this.originalEmail = this.staffMember.email || '';
    this.emailEditMode = true;
  }

  cancelEmailEdit(): void {
    this.staffMember.email = this.originalEmail;
    this.emailEditMode = false;
  }

  saveEmailChange(): void {
    const newEmail = this.staffMember.email?.trim();

    if (!newEmail) {
      this._toast.error('Bitte geben Sie eine E-Mail-Adresse ein.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      this._toast.error('Das Format der E-Mail-Adresse ist ungültig. Bitte überprüfen Sie die Eingabe.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Case-insensitive comparison — if same email with different casing, accept silently
    if (newEmail.toLowerCase() === this.originalEmail.toLowerCase()) {
      this.emailEditMode = false;
      return;
    }

    this.savingEmail = true;

    this.merchandiserService
      .updateMerchandiser(parseInt(this.staffId), { email: newEmail })
      .subscribe({
        next: (response: any) => {
          this.savingEmail = false;
          this.emailEditMode = false;

          if (response?.emailUpdated && response?.welcomeEmailSent === false) {
            this._toast.warning(
              'E-Mail-Adresse erfolgreich aktualisiert, aber die Willkommens-E-Mail konnte nicht gesendet werden. Bitte kontaktieren Sie den Support.',
              { position: 'bottom-right', duration: 7000 },
            );
          } else {
            this._toast.success(
              'E-Mail-Adresse erfolgreich aktualisiert. Eine Willkommens-E-Mail wurde an die neue Adresse gesendet.',
              { position: 'bottom-right', duration: 5000 },
            );
          }

          this.applyPartialSaveResponse(response, ['email'] as any);
          this.staffStateService.clearCache();
        },
        error: (error) => {
          this.savingEmail = false;
          console.error('❌ Email change error:', error);

          const errorBody = error?.data || error?.error || {};
          const errorStatus = error?.status || 0;

          // Try multiple paths for the structured error code
          const code =
            errorBody?.code ||
            errorBody?.error ||
            error?.code ||
            '';

          const messageText =
            typeof errorBody?.message === 'string'
              ? errorBody.message
              : errorBody?.message?.message ||
                error?.message ||
                '';

          if (code === 'MERCHANDISER_HAS_ACTIVE_SESSIONS') {
            this.pendingNewEmail = this.staffMember.email?.trim() || '';
            this._confirmationService.confirm({
              header: 'E-Mail-Adresse aktualisieren',
              message:
                'Der Mitarbeiter ist möglicherweise noch aktiv. Möchten Sie die E-Mail trotzdem aktualisieren? Alle aktiven Sitzungen werden beendet.',
              icon: 'pi pi-exclamation-triangle',
              acceptLabel: 'Trotzdem aktualisieren',
              rejectLabel: 'Abbrechen',
              accept: () => this.confirmForceEmailUpdate(),
            });
          } else if (code === 'EMAIL_ALREADY_EXISTS') {
            this._toast.error(
              '✉️ Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet. Bitte wählen Sie eine andere Adresse.',
              { position: 'bottom-right', duration: 5000 },
            );
          } else if (messageText?.includes('bereits verwendet') || messageText?.includes('already exists')) {
            this._toast.error(
              '✉️ Diese E-Mail-Adresse ist bereits vergeben. Bitte wählen Sie eine andere Adresse.',
              { position: 'bottom-right', duration: 5000 },
            );
          } else if (errorStatus === 422) {
            this._toast.error(
              '❌ Die angegebene E-Mail-Adresse ist ungültig. Bitte überprüfen Sie die Eingabe.',
              { position: 'bottom-right', duration: 4000 },
            );
          } else {
            this._toast.error(
              '❌ Fehler beim Aktualisieren der E-Mail-Adresse. Bitte versuchen Sie es erneut.',
              { position: 'bottom-right', duration: 4000 },
            );
          }
        },
      });
  }

  confirmForceEmailUpdate(): void {
    if (!this.pendingNewEmail) return;

    this.savingEmail = true;

    this.merchandiserService
      .updateMerchandiser(parseInt(this.staffId), {
        email: this.pendingNewEmail,
        forceEmailUpdate: true,
      })
      .subscribe({
        next: (response: any) => {
          this.savingEmail = false;
          this.emailEditMode = false;

          if (response?.emailUpdated && response?.welcomeEmailSent === false) {
            this._toast.warning(
              'E-Mail-Adresse erfolgreich aktualisiert, aber die Willkommens-E-Mail konnte nicht gesendet werden. Bitte kontaktieren Sie den Support.',
              { position: 'bottom-right', duration: 7000 },
            );
          } else {
            this._toast.success(
              'E-Mail-Adresse erfolgreich aktualisiert. Eine Willkommens-E-Mail wurde an die neue Adresse gesendet.',
              { position: 'bottom-right', duration: 5000 },
            );
          }

          this.applyPartialSaveResponse(response, ['email'] as any);
          this.staffStateService.clearCache();
        },
        error: (error) => {
          this.savingEmail = false;
          console.error('❌ Force email change error:', error);

          const errorBody = error?.data || error?.error || {};
          const code = errorBody?.code || errorBody?.error || '';
          const errorStatus = error?.status || 0;

          if (code === 'EMAIL_ALREADY_EXISTS') {
            this._toast.error(
              '✉️ Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet. Bitte wählen Sie eine andere Adresse.',
              { position: 'bottom-right', duration: 5000 },
            );
          } else if (errorStatus === 422) {
            this._toast.error(
              '❌ Die angegebene E-Mail-Adresse ist ungültig. Bitte überprüfen Sie die Eingabe.',
              { position: 'bottom-right', duration: 4000 },
            );
          } else {
            this._toast.error(
              '❌ Fehler beim Aktualisieren der E-Mail-Adresse. Bitte versuchen Sie es erneut.',
              { position: 'bottom-right', duration: 4000 },
            );
          }
        },
      });
  }

  onFavoriteChanged(newStatus: boolean, staff: any): void {
    const previousStatus = staff.isFavorite;
    staff.isFavorite = newStatus;

    this.merchandiserService
      .toggleFavoriteStatus(parseInt(this.staffId))
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling favorite status:', error);
          staff.isFavorite = previousStatus;
          this._toast.error('Fehler beim Aktualisieren der Favoriten', {
            position: 'bottom-right',
            duration: 4000,
          });
          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            staff.isFavorite = result.isFavorite;
            if (result.isFavorite) {
              this._toast.success('Personal zu Favoriten hinzugefügt', {
                position: 'bottom-right',
                duration: 2000,
              });
            } else {
              this._toast.info('Personal aus Favoriten entfernt', {
                position: 'bottom-right',
                duration: 2000,
              });
            }
          }
        },
      });
  }

  loadFeedbacks(): void {
    if (!this.staffId) return;

    this.loadingFeedbacks = true;

    this.feedbackService
      .getReviewStatsByMerchandiser(parseInt(this.staffId, 10))
      .pipe(
        catchError((err) => {
          console.error('❌ Error loading feedbacks:', err);
          this.feedbacks = [];
          this.feedbackStats = null;
          this.userHasReviewed = false;
          return of(null);
        }),
        finalize(() => {
          this.loadingFeedbacks = false;
        }),
      )
      .subscribe((response) => {
        if (!response) return;

        this.feedbacks = (response.reviews || []).map((review: any) => ({
          id: review.id,
          rating: review.rating,
          review: review.review,
          createdAt: review.createdAt,
          reviewer: {
            firstName: review.akzente?.user?.firstName ?? '',
            lastName: review.akzente?.user?.lastName ?? '',
          },
        }));

        if (this.feedbacks.length > 0) {
          this.feedbackStats = {
            averageRating: response.averageRating ?? 0,
            totalReviews: response.reviewCount ?? this.feedbacks.length,
          };
        } else {
          this.feedbackStats = null;
        }

        const currentUser = this.initializerService.getCurrentUser();
        this.userHasReviewed = !!currentUser && (response.reviews || []).some((r: any) => r.akzente?.user?.id === currentUser.id);

        if (this.staffMember) {
          this.staffMember.averageRating = this.feedbackStats?.averageRating ?? 0;
          this.staffMember.totalReviews = this.feedbackStats?.totalReviews ?? 0;
        }

        if (this.merchandiser) {
          (this.merchandiser as any).reviews = response.reviews;
        }
      });
  }

  updateFeedbackStats(): void {
    if (this.feedbacks.length === 0) {
      this.feedbackStats = null;
      return;
    }

    const totalRating = this.feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
    const averageRating = totalRating / this.feedbacks.length;

    this.feedbackStats = {
      averageRating: averageRating,
      totalReviews: this.feedbacks.length,
    };

    // Update staff member's average rating if available
    if (this.staffMember) {
      this.staffMember.averageRating = averageRating;
      this.staffMember.totalReviews = this.feedbacks.length;
    }
  }

  formatFeedbackDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getReviewerInitials(reviewer: any): string {
    if (!reviewer) return 'NA';
    const firstName = reviewer.firstName || '';
    const lastName = reviewer.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  showFeedbackDialog(): void {
    this.feedbackDialogVisible = true;
    const currentUser = this.initializerService.getCurrentUser();
    const existingReview = currentUser && this.merchandiser?.reviews ? this.merchandiser.reviews.find((review) => review.akzente?.user?.id === currentUser.id) : null;

    if (existingReview) {
      this.rating = existingReview.rating;
      this.reviewText = existingReview.review;
    } else {
      this.rating = 0;
      this.reviewText = '';
    }
  }

  submitFeedback(): void {
    if (!this.rating || this.rating < 1 || this.rating > 5) {
      this._toast.error('Bitte wählen Sie eine Bewertung von 1-5 Sternen', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    if (!this.reviewText.trim()) {
      this._toast.error('Bitte geben Sie eine Bewertung ein', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    const reviewData: CreateReviewDto = {
      merchandiserId: parseInt(this.staffId),
      rating: this.rating,
      review: this.reviewText.trim(),
    };

    this.submittingFeedback = true;

    this.feedbackService
      .createReview(reviewData)
      .pipe(
        catchError((error) => {
          console.error('❌ Error submitting review:', error);
          this._toast.error('Fehler beim Senden der Bewertung', {
            position: 'bottom-right',
            duration: 4000,
          });
          return of(null);
        }),
        finalize(() => {
          this.submittingFeedback = false;
        }),
      )
      .subscribe({
        next: (response: CreateReviewResponse | null) => {
          if (response) {
            this.updateFeedbacksFromResponse(response);
            this.feedbackDialogVisible = false;
            this._toast.success('Bewertung erfolgreich gespeichert', {
              position: 'bottom-right',
              duration: 2000,
            });
            this.userHasReviewed = true;
            this.loadFeedbacks();
          }
        },
      });
  }

  private updateFeedbacksFromResponse(response: CreateReviewResponse): void {
    this.feedbackStats = {
      averageRating: response.averageRating,
      totalReviews: response.reviewCount,
    };
    this.feedbacks = response.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      review: review.review,
      createdAt: review.createdAt,
      reviewer: {
        firstName: review.akzente.user.firstName,
        lastName: review.akzente.user.lastName,
      },
    }));
    if (this.staffMember) {
      this.staffMember.averageRating = response.averageRating;
      this.staffMember.totalReviews = response.reviewCount;
    }
    if (this.merchandiser) {
      (this.merchandiser as any).reviews = response.reviews;
    }
  }

  loadStaffDetails(): void {
    this.loading = true;
    this.error = false;
    this.errorMessage = '';

    this.merchandiserService
      .getEditMerchandiserById(parseInt(this.staffId))
      .pipe(
        catchError((error) => {
          this.error = true;
          this.errorMessage = 'Fehler beim Laden der Personal-Details';
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (merchandiser: any) => {
          if (merchandiser) {
            this.merchandiser = merchandiser;
            // Set basic data first for immediate display
            this.statuses = merchandiser.statuses || [];
            this.languageLevels = merchandiser.languageLevels || [];
            this.availableJobTypes = merchandiser.availableJobTypes || [];
            this.availableLanguages = merchandiser.languages || [];

            // Map merchandiser to staff member (this is the heavy operation)
            this.staffMember = this.mapMerchandiserToStaff(merchandiser);

            // Load feedbacks asynchronously after main data is displayed
            setTimeout(() => {
              this.loadFeedbacks();
              if ((merchandiser as any).reviewStats) {
                this.feedbackStats = {
                  averageRating: (merchandiser as any).reviewStats.averageRating,
                  totalReviews: (merchandiser as any).reviewStats.reviewCount,
                };
              }
            }, 0);
          }
        },
      });
  }

  onStatusChange(status: string): void {
    this.staffMember.status = status;
    // Status change will be saved when user clicks "Stammdaten speichern"
  }

  private mapMerchandiserToStaff(apiData: any): any {
    const profile = apiData.profile ?? apiData;
    const user = profile.user ?? apiData.user;
    const merchandiserId = apiData.id ?? parseInt(this.staffId, 10);
    const cachedDistance = this.getCachedDistance(merchandiserId);

    // Helper for language level name
    const getLanguageLevelName = (levelId: number) => {
      const found = apiData.languageLevels?.find((lvl: any) => lvl.id === levelId);
      return found?.name || '';
    };

    return {
      id: merchandiserId?.toString(),
      firstName: profile.firstName || user?.firstName || '',
      lastName: profile.lastName || user?.lastName || '',
      email: profile.email || user?.email || '',
      phone: profile.phoneNumber || user?.phone || '',
      address: profile.street || apiData.street || '',
      postalCode: profile.postalCode || profile.zipCode || apiData.zipCode || '',
      city: profile.cityName || apiData.city?.name || '',
      cityId: profile.cityId ?? apiData.city?.id ?? null,
      country: profile.nationality || apiData.nationality || '',
      deliveryAddress: profile.deliveryAddress || profile.deliveryStreet || apiData.deliveryStreet || '',
      deliveryPostalCode: profile.deliveryPostalCode || profile.deliveryZipCode || apiData.deliveryZipCode || '',
      deliveryCountry: profile.deliveryCountry || apiData.deliveryCountry || '',
      secondaryResidence: profile.secondaryResidence || apiData.secondaryResidence || '',
      secondaryPostalCode: profile.secondaryPostalCode || profile.secondaryZipCode || apiData.secondaryZipCode || '',
      secondaryCountry: profile.secondaryCountry || apiData.secondaryCountry || '',
      website: profile.website || apiData.website || '',
      distance: cachedDistance ?? undefined,
      qualifications:
        profile.jobTypes?.map((job: any) => ({
          id: job.id,
          jobTypeId: job.jobTypeId,
          name: job.name,
          comment: job.comment || '',
        })) || [],
      specializations:
        profile.specializations?.map((spec: any) => ({
          name: spec.specialization?.name,
          jobTypeName: spec.specialization?.jobType?.name,
        })) || [],
      dateOfBirth: this.formatDate(profile.birthDate ?? profile.birthday ?? apiData.birthday),
      status: profile.status?.name || apiData.status?.name || 'Aktiv',
      isFavorite: profile.isFavorite || false,
      location: undefined, // No coordinates in new response
      image: this.getPortraitImage(profile.files) || 'https://st2.depositphotos.com/1010683/7109/i/450/depositphotos_71090693-stock-photo-caucasian-handsome-man-in-grey.jpg',
      fullBodyImage: this.getFullBodyImage(profile.files),
      languages:
        profile.languages?.map((lang: any) => ({
          id: lang.id,
          languageId: lang.languageId,
          levelId: lang.levelId,
          language: lang.language,
          level: { id: lang.levelId, name: getLanguageLevelName(lang.levelId) },
        })) || [],
      references:
        profile.references?.map((ref: any) => ({
          id: ref.id,
          company: ref.company,
          activity: ref.activity,
          industry: ref.industry ?? ref.branche ?? '',
          fromDate: this.formatDateForInput(ref.fromDate ?? ref.startDate),
          toDate: this.formatDateForInput(ref.toDate ?? ref.endDate),
        })) || [],
      education:
        profile.education?.map((edu: any) => ({
          id: edu.id,
          institution: edu.institution,
          qualification: edu.qualification,
          graduationDate: this.formatDateForInput(edu.graduationDate),
        })) || [],
      files: {
        portrait: this.getFileByType(profile.files, 'portrait'),
        fullBodyShot: this.getFileByType(profile.files, 'full_body_shot'),
        resume: this.getFileByType(profile.files, 'resume'),
        additionalAttachments: this.getFilesByType(profile.files, 'additional_attachments'),
      },
      joinDate: '', // Not present in new response
      taxId: profile.tax_id || '',
      taxNumber: profile.tax_no || '',
      averageRating: profile.reviewStats?.averageRating || 0,
      totalReviews: profile.reviewStats?.reviewCount || 0,
      contractuals:
        profile.contractuals?.map((c: any) => ({
          id: c.contractualId || c.id,
          name: c.name,
        })) || [],
    };
  }

  private getPortraitImage(files: any[]): string | null {
    const portraitFile = files?.find((f) => f.type === 'portrait');
    return portraitFile?.file?.path || null;
  }

  private getFullBodyImage(files: any[]): string | null {
    const fullBodyFile = files?.find((f) => f.type === 'full_body_shot');
    return fullBodyFile?.file?.path || null;
  }

  private getFileByType(files: any[], type: string): any | null {
    return files?.find((f) => f.type === type) || null;
  }

  private getFilesByType(files: any[], type: string): any[] {
    return files?.filter((f) => f.type === type) || [];
  }

  private translateLanguageLevel(level: string): string {
    const translations: { [key: string]: string } = {
      basic: 'Grundkenntnisse',
      intermediate: 'Fließend',
      advanced: 'Fortgeschritten',
      native: 'Muttersprache',
    };
    return translations[level] || level;
  }

  private extractLocation(coordinates: number[]): { lat: number; lng: number } | undefined {
    if (coordinates && coordinates.length >= 2) {
      return {
        lat: coordinates[0],
        lng: coordinates[1],
      };
    }
    return undefined;
  }

  private getCachedDistance(merchandiserId: number): string | null {
    const snapshot = this.staffStateService.getStaffDataSnapshot();
    if (!snapshot || !snapshot.allStaffData || snapshot.allStaffData.length === 0) {
      return null;
    }
    const cached = snapshot.allStaffData.find((s) => s.id === merchandiserId.toString());
    return cached?.distance ?? null;
  }

  private calculateDistance(coordinates?: number[]): string {
    if (!coordinates || coordinates.length < 2) {
      return '-- km';
    }
    return '-- km';
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  }

  /** Format a date for <input type="date"> (YYYY-MM-DD). */
  private formatDateForInput(dateValue: string | Date | null | undefined): string {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static readonly STAFF_HEADER_FIELDS = [
    'firstName',
    'lastName',
    'phone',
    'website',
    'address',
    'postalCode',
    'city',
    'cityId',
    'country',
    'dateOfBirth',
    'status',
    'deliveryAddress',
    'deliveryPostalCode',
    'deliveryCity',
    'deliveryCountry',
    'secondaryResidence',
    'secondaryPostalCode',
    'secondaryCity',
    'secondaryCountry',
  ] as const;

  private static readonly STAFF_CONTRACTUAL_FIELDS = ['taxId', 'taxNumber', 'contractuals'] as const;

  private static readonly STAFF_QUALIFICATION_FIELDS = ['qualifications', 'specializations', 'education'] as const;

  private static readonly STAFF_REFERENCES_FIELDS = ['references'] as const;

  private static readonly STAFF_LANGUAGE_FIELDS = ['languages'] as const;

  private static readonly STAFF_FILES_FIELDS = ['files', 'image', 'fullBodyImage'] as const;

  private static readonly STAFF_UI_ONLY_FIELDS = ['isFavorite', 'distance', 'averageRating', 'totalReviews', 'location'] as const;

  /** Apply server response after a section save without wiping unsaved edits in other sections. */
  private applyPartialSaveResponse(_response: any, updatedFields: readonly string[]): void {
    const previous = this.staffMember;

    this.merchandiserService.getEditMerchandiserById(parseInt(this.staffId, 10)).subscribe({
      next: (data) => {
        const mapped = this.mapMerchandiserToStaff(data);
        const allFields = [
          ...StaffEditComponent.STAFF_HEADER_FIELDS,
          ...StaffEditComponent.STAFF_CONTRACTUAL_FIELDS,
          ...StaffEditComponent.STAFF_QUALIFICATION_FIELDS,
          ...StaffEditComponent.STAFF_REFERENCES_FIELDS,
          ...StaffEditComponent.STAFF_LANGUAGE_FIELDS,
          ...StaffEditComponent.STAFF_FILES_FIELDS,
          ...StaffEditComponent.STAFF_UI_ONLY_FIELDS,
        ];
        const updatedSet = new Set(updatedFields);

        for (const field of allFields) {
          if (!updatedSet.has(field) && previous?.[field] !== undefined) {
            mapped[field] = previous[field];
          }
        }

        this.staffMember = mapped;
      },
    });
  }

  goBack(): void {
    this.navigateBackToStaffList();
  }

  toggleContractual(id: number, checked: boolean) {
    if (!this.staffMember.contractuals) this.staffMember.contractuals = [];
    if (checked) {
      // Add if not present
      if (!this.staffMember.contractuals.some((c) => c.id === id)) {
        this.staffMember.contractuals.push({ id, name: this.getContractualName(id) });
      }
    } else {
      // Remove if present
      this.staffMember.contractuals = this.staffMember.contractuals.filter((c) => c.id !== id);
    }
  }

  getContractualName(id: number): string {
    switch (id) {
      case 1:
        return 'Gewerbeschein';
      case 2:
        return 'DSVGO';
      case 3:
        return 'Clearing';
      default:
        return '';
    }
  }
  hasContractual(id: number): boolean {
    return this.staffMember?.contractuals?.some((c) => c.id === id) ?? false;
  }
  getSpecializationsForJobType(jobType: any): any[] {
    return this.staffMember.specializations?.filter((spec: any) => spec.jobTypeName === jobType.name) || [];
  }

  addLanguage(): void {
    if (!this.staffMember.languages) {
      this.staffMember.languages = [];
    }

    // Add a new language with default values
    this.staffMember.languages.push({
      id: null,
      languageId: null,
      levelId: null,
      language: { id: null, name: '' },
      level: { id: null, name: '' },
    });
  }

  removeLanguage(index: number): void {
    if (this.staffMember.languages && this.staffMember.languages.length > index) {
      this.staffMember.languages.splice(index, 1);
    }
  }

  addEducation(): void {
    if (!this.staffMember.education) {
      this.staffMember.education = [];
    }

    // Add a new education entry with default values
    this.staffMember.education.push({
      id: null,
      institution: '',
      qualification: '',
      graduationDate: '',
    });
  }

  removeEducation(index: number): void {
    if (this.staffMember.education && this.staffMember.education.length > index) {
      this.staffMember.education.splice(index, 1);
    }
  }

  confirmAddEducation(): void {
    if (this.newEducation.qualification && this.newEducation.institution) {
      this.staffMember.education.push({
        id: null,
        qualification: this.newEducation.qualification,
        institution: this.newEducation.institution,
        graduationDate: this.newEducation.graduationDate,
      });

      // Reset form
      this.newEducation = { qualification: '', institution: '', graduationDate: '' };
      this.showAddEducationForm = false;
    }
  }

  cancelAddEducation(): void {
    this.newEducation = { qualification: '', institution: '', graduationDate: '' };
    this.showAddEducationForm = false;
  }

  addReference(): void {
    if (!this.staffMember.references) {
      this.staffMember.references = [];
    }

    // Add a new reference with default values
    this.staffMember.references.push({
      id: null,
      company: '',
      activity: '',
      industry: '',
      fromDate: '',
      toDate: '',
    });
  }

  removeReference(index: number): void {
    if (this.staffMember.references && this.staffMember.references.length > index) {
      this.staffMember.references.splice(index, 1);
    }
  }

  confirmAddReference(): void {
    if (this.newReference.company && this.newReference.activity) {
      this.staffMember.references.push({
        id: null,
        company: this.newReference.company,
        activity: this.newReference.activity,
        industry: this.newReference.industry,
        fromDate: this.newReference.fromDate,
        toDate: this.newReference.toDate,
      });

      // Reset form
      this.newReference = { company: '', activity: '', industry: '', fromDate: '', toDate: '' };
      this.showAddReferenceForm = false;
    }
  }

  cancelAddReference(): void {
    this.newReference = { company: '', activity: '', industry: '', fromDate: '', toDate: '' };
    this.showAddReferenceForm = false;
  }

  showAddAttachmentForm = false;
  editingFileIndex: number | null = null;

  getFileNameFromPath(path: string): string {
    const segments = path.split('/');
    const last = segments[segments.length - 1] || '';
    return decodeURIComponent(last);
  }

  isImageFile(path: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(path);
  }

  previewImage(path: string): void {
    window.open(path, '_blank');
  }

  getFileExtension(path: string): string {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  toggleEditFile(index: number): void {
    this.editingFileIndex = this.editingFileIndex === index ? null : index;
    if (this.editingFileIndex === index) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-attachment-input]');
        if (inputs[index]) (inputs[index] as HTMLInputElement).focus();
      }, 0);
    }
  }

  saveAttachmentName(attachment: any, newName: string): void {
    this.editingFileIndex = null;
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (trimmed === (attachment.name || this.getFileNameFromPath(attachment.file.path))) {
      return;
    }
    attachment.name = trimmed;
    if (attachment.id) {
      this.merchandiserService.updateFileName(attachment.id, trimmed).subscribe({
        error: () => {
          this._toast.error('Fehler beim Speichern des Dateinamens.', {
            position: 'bottom-right', duration: 4000,
          });
        },
      });
    }
  }

  addAttachment(name: string, fileInput: any): void {
    const file = fileInput?.files?.[0];
    if (!file) {
      this._toast.error('Bitte wählen Sie eine Datei aus.', {
        position: 'bottom-right', duration: 4000,
      });
      return;
    }
    const label = name?.trim() || this.getFileNameFromPath(file.name);
    this.uploadFileToServer(file, 'additional_attachments', label);
    this.showAddAttachmentForm = false;
    fileInput.value = '';
  }

  replaceAttachment(attachment: any, newFile: File): void {
    if (!newFile) return;
    const fileId = attachment.id;
    if (!fileId) return;
    this.savingFiles = true;
    this.merchandiserService.deleteFile(fileId).subscribe({
      next: () => {
        this.uploadFileToServer(newFile, attachment.type || 'additional_attachments', attachment.name || undefined);
      },
      error: () => {
        this.savingFiles = false;
        this._toast.error('Fehler beim Ersetzen der Datei.', {
          position: 'bottom-right', duration: 4000,
        });
      },
    });
  }

  // File management methods
  onFileSelected(event: any, fileType: string): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadFileToServer(file, fileType);
    }
    event.target.value = '';
  }

  uploadFileToServer(file: File, fileType: string, name?: string): void {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', fileType);
    formData.append('merchandiserId', this.staffId);
    if (name) formData.append('name', name);

    this.savingFiles = true;

    this.merchandiserService.uploadFile(formData).subscribe({
      next: (response) => {
        this.savingFiles = false;
        this._toast.success('Datei erfolgreich hochgeladen!', {
          position: 'bottom-right', duration: 4000,
        });
        this.merchandiserService.getEditMerchandiserById(parseInt(this.staffId)).subscribe({
          next: (merchandiser) => {
            if (merchandiser) {
              this.applyPartialSaveResponse(merchandiser, StaffEditComponent.STAFF_FILES_FIELDS);
            }
          },
        });
      },
      error: (error) => {
        this.savingFiles = false;
        this._toast.error('Fehler beim Hochladen der Datei. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right', duration: 4000,
        });
      },
    });
  }

  deleteFile(fileType: string, index?: number): void {
    let fileId: number | null = null;

    // Get file ID based on type
    switch (fileType) {
      case 'portrait':
        fileId = this.staffMember.files.portrait?.id;
        break;
      case 'full_body_shot':
        fileId = this.staffMember.files.fullBodyShot?.id;
        break;
      case 'resume':
        fileId = this.staffMember.files.resume?.id;
        break;
      case 'additional_attachments':
        if (index !== undefined && this.staffMember.files.additionalAttachments[index]) {
          fileId = this.staffMember.files.additionalAttachments[index].id;
        }
        break;
    }

    if (!fileId) {
      this._toast.error('Datei nicht gefunden.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    // Show loading state
    this.savingFiles = true;

    // Call your delete service here
    this.merchandiserService.deleteFile(fileId).subscribe({
      next: (response) => {
        this.savingFiles = false;
        this.editingFileIndex = null;
        this._toast.success('Datei erfolgreich gelöscht!', {
          position: 'bottom-right',
          duration: 4000,
        });

        switch (fileType) {
          case 'portrait':
            this.staffMember.files.portrait = null;
            break;
          case 'full_body_shot':
            this.staffMember.files.fullBodyShot = null;
            break;
          case 'resume':
            this.staffMember.files.resume = null;
            break;
          case 'additional_attachments':
            if (index !== undefined) {
              this.staffMember.files.additionalAttachments.splice(index, 1);
            }
            break;
        }
      },
      error: (error) => {
        this.savingFiles = false;
        this._toast.error('Fehler beim Löschen der Datei. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  onLanguageChange(language: any, event: any): void {
    const selectedLanguageId = event.value;
    const selectedLanguage = this.availableLanguages.find((lang) => lang.id === selectedLanguageId);

    if (selectedLanguage) {
      language.languageId = selectedLanguageId;
      language.language = selectedLanguage;
    }
  }

  onLevelChange(language: any, event: any): void {
    // Handle level selection
    const selectedLevelId = event.value;
    const selectedLevel = this.languageLevels.find((level) => level.id === selectedLevelId);

    if (selectedLevel) {
      language.levelId = selectedLevelId;
      language.level = selectedLevel;
    }
  }

  getAvailableLanguages(currentIndex?: number): any[] {
    const selectedIds = this.staffMember.languages
      ?.map((l: any, i: number) => (i !== currentIndex ? l.languageId : null))
      .filter((id: number | null) => id != null) ?? [];
    return this.availableLanguages.filter((l) => !selectedIds.includes(l.id));
  }

  getLanguageName(languageId: number): string {
    const language = this.availableLanguages.find((lang) => lang.id === languageId);
    return language ? language.name : '';
  }

  getLevelName(levelId: number): string {
    const level = this.languageLevels.find((level) => level.id === levelId);
    return level ? level.name : '';
  }

  saveContractualData(): void {
    this.savingContractual = true;

    // Prepare data for saving
    const contractualData: any = {
      taxId: this.staffMember.taxId,
      taxNumber: this.staffMember.taxNumber,
      contractuals: this.staffMember.contractuals,
    };

    this.merchandiserService.updateMerchandiser(parseInt(this.staffId), contractualData).subscribe({
      next: (response) => {
        this.savingContractual = false;
        this._toast.success('Vertragsliches erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });

        this.applyPartialSaveResponse(response, StaffEditComponent.STAFF_CONTRACTUAL_FIELDS);
      },
      error: (error) => {
        this.savingContractual = false;
        this._toast.error('Fehler beim Speichern der Vertragsdaten. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  saveQualificationData(): void {
    this.savingQualification = true;

    // Prepare data for saving - map back to API structure
    const qualificationData: any = {
      jobTypes: this.staffMember.qualifications?.map((qual: any) => ({
        id: qual.id,
        jobTypeId: qual.jobTypeId,
        name: qual.name,
        comment: qual.comment,
      })),
      education: this.staffMember.education?.map((edu: any) => ({
        id: edu.id,
        institution: edu.institution,
        qualification: edu.qualification,
        graduationDate: edu.graduationDate,
      })),
    };

    this.merchandiserService.updateMerchandiser(parseInt(this.staffId), qualificationData).subscribe({
      next: (response) => {
        this.savingQualification = false;
        this._toast.success('Qualifikation erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });

        this.applyPartialSaveResponse(response, StaffEditComponent.STAFF_QUALIFICATION_FIELDS);
      },
      error: (error) => {
        this.savingQualification = false;
        this._toast.error('Fehler beim Speichern der Qualifikation. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  saveReferencesData(): void {
    this.savingReferences = true;

    // Prepare data for saving
    const referencesData: any = {
      references: this.staffMember.references,
    };

    this.merchandiserService.updateMerchandiser(parseInt(this.staffId), referencesData).subscribe({
      next: (response) => {
        this.savingReferences = false;
        this._toast.success('Referenzen erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });

        this.applyPartialSaveResponse(response, StaffEditComponent.STAFF_REFERENCES_FIELDS);
      },
      error: (error) => {
        this.savingReferences = false;
        this._toast.error('Fehler beim Speichern der Referenzen. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  saveLanguagesData(): void {
    this.savingLanguages = true;

    // Prepare data for saving
    const languagesData: any = {
      languages: this.staffMember.languages,
    };

    this.merchandiserService.updateMerchandiser(parseInt(this.staffId), languagesData).subscribe({
      next: (response) => {
        this.savingLanguages = false;
        this._toast.success('Sprachen erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });

        this.applyPartialSaveResponse(response, StaffEditComponent.STAFF_LANGUAGE_FIELDS);
      },
      error: (error) => {
        this.savingLanguages = false;
        this._toast.error('Fehler beim Speichern der Sprachen. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  saveFilesData(): void {
    this.savingFiles = true;

    // Prepare data for saving
    const filesData: any = {
      files: this.staffMember.files,
    };

    this.merchandiserService.updateMerchandiser(parseInt(this.staffId), filesData).subscribe({
      next: (response) => {
        this.savingFiles = false;
        this._toast.success('Dateien erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
      error: (error) => {
        this.savingFiles = false;
        this._toast.error('Fehler beim Speichern der Dateien. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  onPhoneBlur(): void {
    this.phoneTouched = true;
    this.validatePhoneField();
  }

  onPhoneChange(): void {
    if (this.phoneTouched) {
      this.validatePhoneField();
    }
  }

  private validatePhoneField(): void {
    this.phoneInvalid = !isValidPhoneNumber(this.staffMember?.phone);
  }

  saveHeaderData(): void {
    this.phoneTouched = true;
    this.validatePhoneField();
    if (this.phoneInvalid) {
      this._toast.error('Bitte geben Sie eine gültige deutsche Telefonnummer ein.', {
        position: 'bottom-right',
        duration: 4000,
      });
      return;
    }

    this.savingHeader = true;

    // Prepare data for saving (adjust fields as needed)
    // Note: email is handled separately via saveEmailChange() with session check + welcome email
    const headerData: any = {
      firstName: this.staffMember.firstName,
      lastName: this.staffMember.lastName,
      dateOfBirth: this.staffMember.dateOfBirth,
      phone: this.staffMember.phone,
      website: this.staffMember.website,
      address: this.staffMember.address,
      street: this.staffMember.address,
      postalCode: this.staffMember.postalCode,
      cityName: this.staffMember.city?.trim() || undefined,
      country: this.staffMember.country,
      status: this.staffMember.status,
      deliveryAddress: this.staffMember.deliveryAddress,
      deliveryPostalCode: this.staffMember.deliveryPostalCode,
      deliveryCountry: this.staffMember.deliveryCountry,
      secondaryResidence: this.staffMember.secondaryResidence,
      secondaryPostalCode: this.staffMember.secondaryPostalCode,
      secondaryCountry: this.staffMember.secondaryCountry,
    };

    this.merchandiserService.updateMerchandiser(parseInt(this.staffId), headerData).subscribe({
      next: (response) => {
        this.savingHeader = false;
        this._toast.success('Stammdaten erfolgreich gespeichert!', {
          position: 'bottom-right',
          duration: 4000,
        });

        this.applyPartialSaveResponse(response, StaffEditComponent.STAFF_HEADER_FIELDS);
        this.staffStateService.clearCache();
      },
      error: () => {
        this.savingHeader = false;
        this._toast.error('Fehler beim Speichern der Stammdaten. Bitte versuchen Sie es erneut.', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }
}
