import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FilterResetService {
  private resetSubject = new Subject<void>();
  reset$ = this.resetSubject.asObservable();

  reset() {
    this.resetSubject.next();
  }
}
