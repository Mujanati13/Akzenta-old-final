import { Pipe, PipeTransform } from '@angular/core';
import { Report } from './client-detail.component';

export function formatLocalizedCountryName(name?: string | { de?: string }): string {
  if (!name) {
    return '';
  }
  if (typeof name === 'string') {
    return name.trim();
  }
  return (name.de || '').trim();
}

export function formatReportAddress(report: Report): string {
  const street = (report.street || report.branch?.street || '').trim();
  const zip = (report.zipCode || report.branch?.zipCode || '').trim();

  let city = '';
  if (report.branch?.city?.name) {
    city = report.branch.city.name.trim();
  }

  let country = '';
  if (report.branch?.city?.country) {
    country = formatLocalizedCountryName(report.branch.city.country.name);
  }

  const parts = [street, zip, city, country].filter(Boolean);
  return parts.join(', ');
}

@Pipe({ name: 'reportAddress' })
export class ReportAddressPipe implements PipeTransform {
  transform(report: Report): string {
    return formatReportAddress(report);
  }
}

@Pipe({ name: 'merchandiserName' })
export class MerchandiserNamePipe implements PipeTransform {
  transform(report: Report): string {
    if (report.merchandiser && report.merchandiser.user) {
      const user = report.merchandiser.user;
      return [user.firstName, user.lastName].filter(Boolean).join(' ');
    }
    return '';
  }
}

@Pipe({ name: 'isReportNew' })
export class IsReportNewPipe implements PipeTransform {
  transform(report: Report): boolean {
    return report.status?.name?.toUpperCase() === 'NEW' || report.status?.id === 1;
  }
}

@Pipe({ name: 'reportNavigationParams' })
export class ReportNavigationParamsPipe implements PipeTransform {
  transform(report: Report): Record<string, any> {
    const overrides: Record<string, any> = {
      referrer: 'client-detail',
    };
    // Simple query params build
    return overrides;
  }
}
