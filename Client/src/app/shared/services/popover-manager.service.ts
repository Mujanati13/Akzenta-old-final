import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PopoverManagerService {
  private closePopoverSubject = new Subject<string>();
  closePopover$ = this.closePopoverSubject.asObservable();

  closeAllPopovers(): void {
    this.closePopoverSubject.next('close-all');
  }
}
