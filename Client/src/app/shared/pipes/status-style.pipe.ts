import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusStyle',
})
export class StatusStylePipe implements PipeTransform {
  transform(status: string): { bg: string; text: string } {
    let style = { bg: '', text: '' };

    switch (status) {
      case 'available':
        style.bg = 'bg-green-500';
        style.text = 'Available';
        break;
      case 'out_of_stock':
        style.bg = 'bg-red-500';
        style.text = 'Out of Stock';
        break;
      case 'pending':
        style.bg = 'bg-yellow-500';
        style.text = 'Pending';
        break;
      default:
        style.bg = 'bg-gray-500';
        style.text = 'Unknown Status';
        break;
    }

    return style;
  }
}
