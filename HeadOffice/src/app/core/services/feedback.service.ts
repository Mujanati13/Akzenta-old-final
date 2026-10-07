import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface CreateReviewDto {
  merchandiserId: number;
  rating: number;
  review: string;
}

export interface ReviewUser {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  type: {
    id: number;
    name: string;
    __entity: string;
  };
  role: {
    id: number;
    name: string;
    __entity: string;
  };
  status: {
    id: number;
    name: string;
    __entity: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ReviewAkzente {
  id: number;
  user: ReviewUser;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: number;
  akzente: ReviewAkzente;
  rating: number;
  review: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewResponse {
  averageRating: number;
  reviewCount: number;
  reviews: Review[];
}

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly endpoint = 'review';

  constructor(private apiService: ApiService) {}

  /**
   * Create new review for a merchandiser
   */
  createReview(reviewData: CreateReviewDto): Observable<CreateReviewResponse> {
    return this.apiService.post<CreateReviewResponse>(this.endpoint, reviewData);
  }

  /**
   * Get reviews for a specific merchandiser (array only)
   */
  getReviewsByMerchandiser(merchandiserId: number): Observable<Review[]> {
    return this.apiService.get<Review[]>(`${this.endpoint}/merchandiser/${merchandiserId}`);
  }

  /**
   * Get review stats and list for a merchandiser (averageRating, reviewCount, reviews)
   */
  getReviewStatsByMerchandiser(merchandiserId: number): Observable<CreateReviewResponse> {
    return this.apiService.get<CreateReviewResponse>(`${this.endpoint}/merchandiser/${merchandiserId}/stats`);
  }
}
