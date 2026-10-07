import { ReportStatusEnum } from './dto/status.enum';

export type ReportStatusUserType = 'akzente' | 'client' | 'merchandiser';

export function hasValidDateValue(
  dateValue?: Date | string | null,
): boolean {
  if (!dateValue) {
    return false;
  }

  if (typeof dateValue === 'string' && dateValue.trim() === '') {
    return false;
  }

  return true;
}

export function reportHasVisitDate(report: {
  visitDate?: Date | string | null;
  plannedOn?: Date | string | null;
}): boolean {
  return (
    hasValidDateValue(report.visitDate) || hasValidDateValue(report.plannedOn)
  );
}

/**
 * Accents / merchandiser: scheduled only when both VM and date are set.
 */
export function resolveSetupStatusId(
  hasMerchandiser: boolean,
  hasDate: boolean,
): ReportStatusEnum.PENDING | ReportStatusEnum.SCHEDULED {
  return hasMerchandiser && hasDate
    ? ReportStatusEnum.SCHEDULED
    : ReportStatusEnum.PENDING;
}

/**
 * Only pending/scheduled are recalculated when setup fields change.
 */
export function shouldRecalculateSetupStatus(
  currentStatusId?: number | null,
): boolean {
  if (!currentStatusId) {
    return true;
  }

  return currentStatusId <= ReportStatusEnum.SCHEDULED;
}

export function getClosedStatusIdsForUserType(
  userType: ReportStatusUserType,
): number[] {
  switch (userType) {
    case 'merchandiser':
      return [
        ReportStatusEnum.SUBMITTED,
        ReportStatusEnum.APPROVED,
        ReportStatusEnum.VIEWED,
      ];
    case 'akzente':
      return [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED];
    case 'client':
      return [ReportStatusEnum.VIEWED];
    default:
      return [];
  }
}

export function getNextStatusOnClose(
  userType: ReportStatusUserType,
  currentStatusId?: number,
): number {
  switch (userType) {
    case 'merchandiser':
      return ReportStatusEnum.SUBMITTED;
    case 'akzente':
      return ReportStatusEnum.APPROVED;
    case 'client':
      if (currentStatusId === ReportStatusEnum.APPROVED) {
        return ReportStatusEnum.VIEWED;
      }
      throw new Error(
        'Client can only mark reports as viewed after they are available',
      );
    default:
      throw new Error(`Unknown user type: ${userType}`);
  }
}

export function categorizeReportCount(
  statusId: number,
  userType: ReportStatusUserType = 'akzente',
): 'new' | 'ongoing' | 'completed' | null {
  if (userType === 'client') {
    if (statusId === ReportStatusEnum.APPROVED) {
      return 'new';
    }
    if (statusId === ReportStatusEnum.VIEWED) {
      return 'completed';
    }
    if (
      [
        ReportStatusEnum.PENDING,
        ReportStatusEnum.SCHEDULED,
        ReportStatusEnum.SUBMITTED,
      ].includes(statusId)
    ) {
      return 'ongoing';
    }
    return null;
  }

  if (statusId === ReportStatusEnum.PENDING) {
    return 'new';
  }
  if (
    [ReportStatusEnum.SCHEDULED, ReportStatusEnum.SUBMITTED].includes(statusId)
  ) {
    return 'ongoing';
  }
  if (
    [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(statusId)
  ) {
    return 'completed';
  }
  return null;
}

export function isCompletedReportStatus(statusId: number): boolean {
  return [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(
    statusId,
  );
}
