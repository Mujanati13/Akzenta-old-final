import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly endpoint = 'project';

  constructor(private apiService: ApiService) {}

  createProject(payload: any): Observable<any> {
    return this.apiService.post<any>(this.endpoint, payload);
  }

  updateProject(projectId: string | number, payload: any): Observable<any> {
    return this.apiService.patch<any>(`${this.endpoint}/${projectId}`, payload);
  }

  updateAdvancedPhoto(
    advancedPhotoId: string | number,
    payload: {
      labels?: string[];
      isBeforeAfter?: boolean | null;
      isVisibleInReport?: boolean;
    },
  ): Observable<any> {
    return this.apiService.patch<any>(`advanced-photo/${advancedPhotoId}`, payload);
  }

  /**
   * Toggle favorite status for a project
   */
  toggleFavoriteStatus(projectId: string): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`${this.endpoint}/${projectId}/toggle-favorite`, {});
  }
}
