import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { catchError, of, finalize } from 'rxjs';
import { StaffStateService } from '../list/staff-state.service';

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
  selector: 'app-staff-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ImportsModule, AppIconComponent, FavoriteToggleComponent, FormsModule],
  templateUrl: './staff-detail.component.html',
  styleUrls: ['./staff-detail.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class StaffDetailComponent implements OnInit {
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

  // Accordion active value - set all panels open by default
  activeAccordionValue: string[] = ['0', '1', '2', '3', '4', '5', '6'];

  private readonly _toast = inject(HotToastService);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private merchandiserService: MerchandiserService,
    private feedbackService: FeedbackService,
    private initializerService: InitializerService, // Add this injection
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
    this.router.navigate(['/staff']);
  }

  goToEdit(newTab: boolean = false): void {
    const urlTree = this.router.createUrlTree(['/staff', this.staffId, 'edit']);

    if (newTab) {
      const url = window.location.origin + this.router.serializeUrl(urlTree);
      window.open(url, '_blank');
    } else {
      this.router.navigateByUrl(urlTree);
    }
  }

  onEditContextMenu(event: MouseEvent): boolean {
    event.preventDefault();
    this.goToEdit(true);
    return false;
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
    // Validation
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
            // Update the local feedbacks with the new response data
            this.updateFeedbacksFromResponse(response);

            // Close dialog and show success
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
    // Update feedback stats
    this.feedbackStats = {
      averageRating: response.averageRating,
      totalReviews: response.reviewCount,
    };

    // Update feedbacks array with the latest reviews from API
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

    // Update staff member's average rating
    if (this.staffMember) {
      this.staffMember.averageRating = response.averageRating;
      this.staffMember.totalReviews = response.reviewCount;
    }

    // Update merchandiser data if available
    if (this.merchandiser) {
      (this.merchandiser as any).reviewStats = {
        averageRating: response.averageRating,
        reviewCount: response.reviewCount,
      };
      (this.merchandiser as any).reviews = response.reviews;
    }
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

        this.feedbacks = (response.reviews || []).map((review) => ({
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
        this.userHasReviewed = !!currentUser && (response.reviews || []).some((r) => r.akzente?.user?.id === currentUser.id);

        if (this.staffMember) {
          this.staffMember.averageRating = this.feedbackStats?.averageRating ?? 0;
          this.staffMember.totalReviews = this.feedbackStats?.totalReviews ?? 0;
        }

        if (this.merchandiser) {
          (this.merchandiser as any).reviews = response.reviews;
          (this.merchandiser as any).reviewStats = {
            averageRating: response.averageRating,
            reviewCount: response.reviewCount,
          };
        }
      });
  }

  private checkIfUserHasReviewed(): void {
    // Get the current user from the initializer service
    const currentUser = this.initializerService.getCurrentUser();

    if (!currentUser) {
      this.userHasReviewed = false;
      return;
    }

    // Check if any review in the merchandiser's reviews is from the current user
    this.userHasReviewed =
      this.merchandiser?.reviews?.some((review) => {
        const reviewerUserId = review.akzente?.user?.id;
        const hasReviewed = reviewerUserId === currentUser.id;

        if (hasReviewed) {
        }

        return hasReviewed;
      }) || false;
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

  loadStaffDetails(): void {
    this.loading = true;
    this.error = false;

    this.merchandiserService
      .getMerchandiserById(parseInt(this.staffId))
      .pipe(
        catchError((error) => {
          console.error('❌ Error loading merchandiser details:', error);
          this.error = true;
          this.errorMessage = 'Fehler beim Laden der Personal-Details';
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (merchandiser) => {
          if (merchandiser) {
            this.merchandiser = merchandiser;
            this.staffMember = this.mapMerchandiserToStaff(merchandiser);

            // Load feedbacks after merchandiser data is available
            this.loadFeedbacks();

            // If we have reviewStats from API, update feedbackStats
            if ((merchandiser as any).reviewStats) {
              this.feedbackStats = {
                averageRating: (merchandiser as any).reviewStats.averageRating,
                totalReviews: (merchandiser as any).reviewStats.reviewCount,
              };
            }
          }
        },
      });
  }

  private mapMerchandiserToStaff(merchandiser: Merchandiser): any {
    const cachedDistance = this.getCachedDistance(merchandiser.id);

    return {
      id: merchandiser.id.toString(),
      firstName: merchandiser.user?.firstName || '',
      lastName: merchandiser.user?.lastName || '',
      email: merchandiser.user?.email || '',
      phone: merchandiser.user?.phone || '',
      address: merchandiser.street || '',
      postalCode: merchandiser.zipCode || '',
      city: merchandiser.city?.name || '',
      locationName: merchandiser.city?.name || '',
      country: merchandiser.city?.country?.name?.de || merchandiser.nationality || '',
      deliveryAddress: merchandiser.deliveryStreet || '',
      deliveryPostalCode: merchandiser.deliveryZipCode || '',
      deliveryCountry: merchandiser.deliveryCountry || '',
      secondaryResidence: merchandiser.secondaryResidence || '',
      secondaryPostalCode: merchandiser.secondaryZipCode || '',
      secondaryCountry: merchandiser.secondaryCountry || '',
      website: merchandiser.website || '',
      distance: cachedDistance ?? this.calculateDistance(merchandiser.city?.coordinates),
      qualifications:
        merchandiser.jobTypes?.map((job) => ({
          id: job.id,
          name: job.name,
          comment: job.comment,
        })) || [],
      specializations:
        merchandiser.specializations?.map((spec) => ({
          id: spec.id,
          specialization: {
            id: spec.specialization.id,
            name: spec.specialization.name,
            jobType: spec.specialization.jobType,
          },
        })) || [],
      dateOfBirth: this.formatDate(merchandiser.birthday),
      status: merchandiser.status?.name || '',
      isFavorite: merchandiser.isFavorite || false,
      location: this.extractLocation(merchandiser.city?.coordinates),
      image: this.getPortraitImage(merchandiser.files) || 'https://st2.depositphotos.com/1010683/7109/i/450/depositphotos_71090693-stock-photo-caucasian-handsome-man-in-grey.jpg',
      fullBodyImage: this.getFullBodyImage(merchandiser.files),
      languages:
        merchandiser.languages?.map((lang) => ({
          name: lang.language.name,
          level: this.translateLanguageLevel(lang.level),
        })) || [],
      contractuals: merchandiser.contractuals || [],
      references:
        merchandiser.references?.map((ref) => ({
          company: ref.company,
          activity: ref.activity,
          branche: ref.branche,
          industry: ref.branche,
          startDate: ref.startDate,
          endDate: ref.endDate,
        })) || [],
      education:
        merchandiser.education?.map((edu) => ({
          company: edu.company,
          activity: edu.activity,
          graduationDate: this.formatDate(edu.graduationDate),
        })) || [],
      files: {
        portrait: this.getFileByType(merchandiser.files, 'portrait'),
        fullBodyShot: this.getFileByType(merchandiser.files, 'full_body_shot'),
        resume: this.getFileByType(merchandiser.files, 'resume'),
        additionalAttachments: this.getFilesByType(merchandiser.files, 'additional_attachments'),
      },
      joinDate: this.formatDate(merchandiser.createdAt),
      taxId: 'DE123456789',
      taxNumber: '123/207/50234',
      // Use the reviewStats from API if available, otherwise default to 0
      averageRating: (merchandiser as any).reviewStats?.averageRating || 0,
      totalReviews: (merchandiser as any).reviewStats?.reviewCount || 0,
      // Add projects data
      projects: merchandiser.projects || { past: [], current: [] },
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

  goBack(): void {
    this.navigateBackToStaffList();
  }

  getSpecializationsForJobType(jobTypeName: string): any[] {
    return this.staffMember.specializations?.filter((spec: any) => spec.specialization.jobType.name === jobTypeName) || [];
  }

  formatProjectYear(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.getFullYear().toString();
  }

  getProjectDisplayName(project: any): string {
    const customer = project?.clientCompany?.name?.trim();
    const projectName = project?.name?.trim();
    const year = this.formatProjectYear(project?.startDate || project?.createdAt);

    if (customer && projectName) {
      return `${customer} – ${projectName}${year ? ` (${year})` : ''}`;
    }
    return `${customer || projectName || 'Unbekannt'}${year ? ` (${year})` : ''}`;
  }

  formatReferencePeriod(reference: { startDate?: string; endDate?: string | null }): string {
    const start = reference.startDate ? this.formatDate(reference.startDate) : '-';
    const end = reference.endDate ? this.formatDate(reference.endDate) : 'heute';
    return `${start} – ${end}`;
  }
}
