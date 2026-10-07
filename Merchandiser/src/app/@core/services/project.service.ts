import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface ProjectToggleResponse {
  isFavorite: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  constructor(private apiService: ApiService) {}

  /**
   * Toggle favorite status for a project
   */
  toggleFavoriteStatus(projectId: string): Observable<ProjectToggleResponse> {
    return this.apiService.post<ProjectToggleResponse>(`/project/${projectId}/toggle-favorite`, {});
  }
}
