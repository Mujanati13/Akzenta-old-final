import { ReportStatusEnum } from '@app/@core/enums/status.enum';

export interface ReportStatusLike {
  id?: number | string | null;
  name?: string | null;
}

export interface ReportAcceptanceLike {
  accepted?: boolean | null;
  merchandiser?: unknown | null;
}

function resolveStatusId(status?: ReportStatusLike | null): number | null {
  if (status?.id == null) {
    return null;
  }

  const statusId = Number(status.id);
  if (Number.isNaN(statusId) || statusId <= 0) {
    return null;
  }

  return statusId;
}

export function isPendingMerchandiserAcceptance(report?: ReportAcceptanceLike | null): boolean {
  return report?.merchandiser != null && report.accepted === false;
}

export function canAkzenteAccessReport(_status?: ReportStatusLike | null): boolean {
  return true;
}

export function isAkzenteReportClosed(status?: ReportStatusLike | null): boolean {
  const statusId = resolveStatusId(status);
  if (statusId != null) {
    return [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(statusId);
  }

  const statusName = String(status?.name ?? '').trim();
  if (statusName === 'Prüfen' || statusName === 'Review') {
    return false;
  }

  return ['Im Prüfen', 'Ok', 'Done', 'Available'].includes(statusName);
}

export function canAkzenteApproveReport(status?: ReportStatusLike | null, report?: ReportAcceptanceLike | null): boolean {
  if (isPendingMerchandiserAcceptance(report)) {
    return false;
  }

  if (isAkzenteReportClosed(status)) {
    return false;
  }

  const statusId = resolveStatusId(status);
  if (statusId != null) {
    return statusId !== ReportStatusEnum.PENDING;
  }

  const statusName = String(status?.name ?? '')
    .trim()
    .toLowerCase();
  if (!statusName || statusName === 'new' || statusName === 'anfrage' || statusName === 'pending' || statusName === 'assigned') {
    return false;
  }

  return true;
}

export function categorizeReportForAkzente(statusId: number): 'new' | 'ongoing' | 'completed' | null {
  if (statusId === ReportStatusEnum.PENDING) {
    return 'new';
  }
  if ([ReportStatusEnum.SCHEDULED, ReportStatusEnum.SUBMITTED].includes(statusId)) {
    return 'ongoing';
  }
  if ([ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(statusId)) {
    return 'completed';
  }
  return null;
}
