import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'euDate',
  standalone: true,
})
export class EuDatePipe implements PipeTransform {
  transform(value: Date | string | null | undefined, format: 'short' | 'long' = 'short'): string {
    if (!value) return '-';

    let date: Date;
    if (typeof value === 'string') {
      date = new Date(value);
    } else {
      date = value;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '-';
    }

    if (format === 'short') {
      // DD.MM.YYYY format
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } else {
      // DD. Month YYYY format (e.g., "17. Januar 2025")
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
  }
}
