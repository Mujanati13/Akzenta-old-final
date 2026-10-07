import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { concatMap, last } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '@app/core/services/api.service';
import { environment } from '@env/environment';

export interface ReportToggleResponse {
  isFavorite: boolean;
  message: string;
}

export interface Report {
  id: number;
  title: string;
  description: string;
  status: {
    id: number;
    name: string;
    color?: string;
    akzenteName?: string;
    clientName?: string;
    merchandiserName?: string;
    akzenteColor?: string;
    clientColor?: string;
    merchandiserColor?: string;
  };
  createdAt: string;
  updatedAt: string;
  plannedOn: string;
  street: string;
  zipCode: string;
  note: string;
  reportTo: string;
  feedback: string;
  zeitraum?: string;
  project?: {
    id: number;
    name: string;
    description: string;
    status: string;
    zeitraum?: string;
    startDate?: string;
    endDate?: string;
  };
  merchandiser?: {
    id: number;
    user: {
      id: number;
      firstName: string;
      lastName: string;
    };
  };
  branch?: {
    id: number;
    name: string;
    phone: string;
    client?: {
      id: number;
      name: string;
    };
  };
  /** Set by API when report is loaded with clientCompany relation (used for filter/display) */
  clientCompany?: {
    id: number;
    name: string;
  };
  isFavorite?: boolean;
  accepted?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly endpoint = 'report';
  /** Upload in small batches to avoid timeouts on slow connections. */
  private static readonly UPLOAD_BATCH_SIZE = 3;
  /** Must stay below backend FILE_UPLOAD_REQUEST_TIMEOUT_MS. */
  private static readonly MAX_UPLOAD_TIMEOUT_MS = 240_000;

  constructor(private apiService: ApiService) {}

  createReport(payload: any): Observable<any> {
    return this.apiService.post<any>(this.endpoint, payload);
  }

  // Bulk insert reports for a project
  bulkInsertReports(projectId: string | number, data: any[]): Observable<any> {
    const url = `${this.endpoint}/bulkinsert/${projectId}`;
    return this.apiService.post<any>(url, data);
  }

  // Fetch reports for a project
  getReportsByProject(projectId: string | number): Observable<any[]> {
    return this.apiService.get<any[]>(`${this.endpoint}/project/${projectId}`);
  }

  // Fetch a single report by its ID
  getReportById(reportId: string | number): Observable<any> {
    return this.apiService.get<any>(`${this.endpoint}/${reportId}`);
  }

  // Export project reports as Excel file
  exportProjectReportsAsExcel(projectId: string | number): Observable<Blob> {
    return this.apiService.getBlob(`${this.endpoint}/project/${projectId}/export-excel`);
  }

  // Export single report as Excel file
  exportSingleReportAsExcel(reportId: string | number): Observable<Blob> {
    return this.apiService.getBlob(`${this.endpoint}/${reportId}/export-excel`);
  }

  // Update a report by its ID
  updateReport(reportId: string | number, payload: any): Observable<any> {
    return this.apiService.put<any>(`${this.endpoint}/${reportId}`, payload);
  }

  // Initialize dataset for a report
  initReportDataset(reportId: string | number, questions: any[]): Observable<any> {
    return this.apiService.post<any>(`${this.endpoint}/${reportId}/init-dataset`, { questions });
  }

  // Update a report with files as FormData (batched when many files are selected)
  updateReportWithFiles(reportId: string | number, payload: any, files: any[]): Observable<any> {
    const filesToUpload = (files || []).filter((fileData) => fileData?.file);

    if (filesToUpload.length <= ReportService.UPLOAD_BATCH_SIZE) {
      return this.patchReportFormData(reportId, payload, filesToUpload);
    }

    const batches: any[][] = [];
    for (let i = 0; i < filesToUpload.length; i += ReportService.UPLOAD_BATCH_SIZE) {
      batches.push(filesToUpload.slice(i, i + ReportService.UPLOAD_BATCH_SIZE));
    }

    const photoOrderUpdates = payload.photoOrderUpdates;
    const basePayload = { ...payload };
    if (photoOrderUpdates) {
      delete basePayload.photoOrderUpdates;
    }

    return from(batches).pipe(
      concatMap((batch, index) => {
        const isFirst = index === 0;
        const isLast = index === batches.length - 1;

        let batchPayload: any;
        if (isFirst) {
          batchPayload = { ...basePayload };
        } else {
          batchPayload = {
            visitDate: payload.visitDate,
            status: payload.status,
            filesToDelete: [],
          };
        }

        if (isLast && photoOrderUpdates?.length) {
          batchPayload.photoOrderUpdates = photoOrderUpdates;
        }

        return this.patchReportFormData(reportId, batchPayload, batch);
      }),
      last(),
    );
  }

  private patchReportFormData(reportId: string | number, payload: any, filesToUpload: any[]): Observable<any> {
    const formData = new FormData();

    formData.append('data', JSON.stringify(payload));

    if (payload.filesToDelete && payload.filesToDelete.length > 0) {
      formData.append('filesToDelete', JSON.stringify(payload.filesToDelete));
    }

    filesToUpload.forEach((fileData, index) => {
      formData.append(`files`, fileData.file);
      formData.append(`fileLabels`, fileData.label || `file_${index}`);
      formData.append(`advancedPhotoIds`, fileData.advancedPhotoId?.toString() || '');
      formData.append(`beforeAfterTypes`, fileData.beforeAfterType ?? '');
      formData.append(`fileOrders`, fileData.order !== undefined ? fileData.order.toString() : index.toString());
    });

    const timeoutMs = this.getReportUploadTimeoutMs(filesToUpload.length);
    return this.apiService.patchFile<any>(`${this.endpoint}/${reportId}`, formData, false, false, timeoutMs);
  }

  private getReportUploadTimeoutMs(fileCount: number): number {
    if (fileCount <= 0) {
      return 30_000;
    }
    return Math.min(ReportService.MAX_UPLOAD_TIMEOUT_MS, 45_000 + fileCount * 20_000);
  }

  // Send a message in the report conversation
  sendMessage(reportId: string | number, payload: { content: string; receiverType: string }): Observable<any> {
    return this.apiService.post<any>(`${this.endpoint}/${reportId}/send-message`, payload);
  }

  // Toggle favorite status for a report
  toggleFavoriteStatus(reportId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`${this.endpoint}/${reportId}/toggle-favorite`, {});
  }

  /**
   * Get all reports for the current merchandiser
   */
  getMerchandiserReports(): Observable<Report[]> {
    return this.apiService.get<Report[]>('/merchandiser/reports');
  }

  /**
   * Get favorites for the current merchandiser (reports and projects)
   */
  getMerchandiserFavorites(): Observable<any> {
    return this.apiService.get<any>('/merchandiser/favorites/list');
  }

  /**
   * Accept or reject a report (Anfrage)
   */
  acceptOrRejectReport(reportId: number, accept: boolean): Observable<any> {
    return this.apiService.post<any>(`${this.endpoint}/${reportId}/accept-reject`, { accept });
  }

  // Upload files only (no metadata) — called after save is already confirmed
  uploadFiles(reportId: string | number, files: any[]): Observable<any> {
    const toUpload = (files || []).filter((f) => f?.file);
    if (toUpload.length === 0) {
      return of({ uploaded: 0, failed: 0, failedFiles: [] });
    }

    const formData = new FormData();
    toUpload.forEach((fileData, index) => {
      formData.append('files', fileData.file);
      formData.append('fileLabels', fileData.label || `file_${index}`);
      formData.append('advancedPhotoIds', fileData.advancedPhotoId?.toString() || '');
      formData.append('beforeAfterTypes', fileData.beforeAfterType ?? '');
      formData.append('fileOrders', fileData.order !== undefined ? fileData.order.toString() : index.toString());
    });

    return this.apiService.postFile<any>(`${this.endpoint}/${reportId}/upload-files`, formData, false, false, 240_000);
  }

  // Transition report from not-started to in-progress
  transitionReportToInProgress(reportId: string | number): Observable<any> {
    return this.apiService.patch<any>(`${this.endpoint}/${reportId}/transition-to-in-progress`);
  }

  // Update report status
  closeReport(reportId: string | number): Observable<any> {
    return this.apiService.patch<any>(`${this.endpoint}/${reportId}/close`);
  }
}
