import { ReportStatusEnum } from '@app/@core/enums/status.enum';

export interface ReportStatusLike {
  id?: number | string | null;
  name?: string | null;
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

export function isClientReportClosed(status?: ReportStatusLike | null): boolean {
  const statusId = resolveStatusId(status);
  if (statusId != null) {
    return statusId === ReportStatusEnum.VIEWED;
  }

  const statusName = String(status?.name ?? '').trim();
  return statusName === 'Done' || statusName === 'Ok';
}

export function canClientApproveReport(status?: ReportStatusLike | null): boolean {
  const statusId = resolveStatusId(status);
  if (statusId != null) {
    return statusId === ReportStatusEnum.APPROVED;
  }

  const statusName = String(status?.name ?? '').trim();
  return statusName === 'Available' || statusName === 'Verfügbar';
}

export function categorizeReportForClient(statusId: number): 'new' | 'ongoing' | 'completed' | null {
  if (statusId === ReportStatusEnum.APPROVED) {
    return 'new';
  }
  if (statusId === ReportStatusEnum.VIEWED) {
    return 'completed';
  }
  if ([ReportStatusEnum.PENDING, ReportStatusEnum.SCHEDULED, ReportStatusEnum.SUBMITTED].includes(statusId)) {
    return 'ongoing';
  }
  return null;
}
