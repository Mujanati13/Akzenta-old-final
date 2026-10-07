import { ReportStatusEnum } from '@app/@core/enums/status.enum';

export interface ReportStatusLike {
  id?: number | string | null;
  name?: string | null;
}

export type ReportLifecycleState = 'NOT_STARTED' | 'IN_PROGRESS' | 'RELEASED';

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

export function isMerchandiserReportClosed(status?: ReportStatusLike | null): boolean {
  const statusId = resolveStatusId(status);
  if (statusId != null) {
    return [ReportStatusEnum.SUBMITTED, ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(statusId);
  }

  const statusName = String(status?.name ?? '').trim();
  return ['Im Prüfen', 'Ok', 'Done', 'Available', 'Prüfen', 'Review', 'Submitted'].includes(statusName);
}

export function canMerchandiserApproveReport(status?: ReportStatusLike | null, report?: ReportAcceptanceLike | null): boolean {
  if (isPendingMerchandiserAcceptance(report)) {
    return false;
  }

  if (isMerchandiserReportClosed(status)) {
    return false;
  }

  const statusId = resolveStatusId(status);
  if (statusId != null) {
    return statusId === ReportStatusEnum.SCHEDULED || statusId === ReportStatusEnum.PENDING;
  }

  const statusName = String(status?.name ?? '')
    .trim()
    .toLowerCase();
  return statusName === 'scheduled' || statusName === 'geplant' || statusName === 'pending' || statusName === 'new' || statusName === 'anfrage';
}

export function categorizeReportForMerchandiser(statusId: number): 'new' | 'ongoing' | 'completed' | null {
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

/**
 * Map a status object to a lifecycle state label.
 */
export function mapStatusToLifecycleState(status?: ReportStatusLike | null): ReportLifecycleState {
  if (isMerchandiserReportClosed(status)) {
    return 'RELEASED';
  }

  const statusId = resolveStatusId(status);
  if (statusId != null) {
    if (statusId === ReportStatusEnum.PENDING) {
      return 'NOT_STARTED';
    }
    return 'IN_PROGRESS';
  }

  const name = String(status?.name ?? '')
    .trim()
    .toLowerCase();
  if (!name || name === 'new' || name === 'anfrage' || name === 'pending') {
    return 'NOT_STARTED';
  }

  return 'IN_PROGRESS';
}

/**
 * The report can be moved into In Progress (i.e. it is still in Not Started).
 */
export function canTransitionToInProgress(status?: ReportStatusLike | null): boolean {
  return mapStatusToLifecycleState(status) === 'NOT_STARTED' && !isMerchandiserReportClosed(status);
}
