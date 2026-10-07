import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { AppIconComponent } from '@app/shared/app-icon.component';

/**
 * Inline planned-date editor for client-detail reports only.
 * Layout and icons are self-contained (no app-icon) to avoid overlap/glitches in dense tables.
 */
@Component({
  selector: 'app-client-detail-planned-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, AppIconComponent],
  templateUrl: './client-detail-planned-date-picker.component.html',
  styleUrl: './client-detail-planned-date-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailPlannedDatePickerComponent implements OnInit, OnChanges {
  @Input() selectedDate: Date | null = null;
  @Input() placeholder = 'TT.MM.JJJJ';
  @Input() disabled = false;
  @Output() dateSelected = new EventEmitter<Date | null>();

  inputValue = '';
  today: Date = new Date();
  currentMonth: Date = new Date();
  weeks: Date[][] = [];
  showPicker = false;

  positions: ConnectionPositionPair[] = [
    new ConnectionPositionPair({ originX: 'start', originY: 'bottom' }, { overlayX: 'start', overlayY: 'top' }),
    new ConnectionPositionPair({ originX: 'start', originY: 'top' }, { overlayX: 'start', overlayY: 'bottom' }),
  ];

  years: number[] = [];
  months = [
    { value: 0, name: 'Januar' },
    { value: 1, name: 'Februar' },
    { value: 2, name: 'März' },
    { value: 3, name: 'April' },
    { value: 4, name: 'Mai' },
    { value: 5, name: 'Juni' },
    { value: 6, name: 'Juli' },
    { value: 7, name: 'August' },
    { value: 8, name: 'September' },
    { value: 9, name: 'Oktober' },
    { value: 10, name: 'November' },
    { value: 11, name: 'Dezember' },
  ];

  constructor(private cdr: ChangeDetectorRef) {
    for (let y = 1900; y <= 2100; y++) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.syncInputFromSelectedDate();
    if (this.selectedDate) {
      this.currentMonth = new Date(this.selectedDate);
    }
    this.generateWeeks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate']) {
      this.syncInputFromSelectedDate();
    }
  }

  private syncInputFromSelectedDate(): void {
    if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
      this.inputValue = this.formatDateForInput(this.selectedDate);
    } else {
      this.inputValue = '';
    }
    this.cdr.markForCheck();
  }

  private formatDateForInput(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  /** Digits only → DD.MM.JJJJ with dots inserted while typing. */
  private formatGermanDateWhileTyping(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  }

  onInputValueChange(value: string): void {
    this.inputValue = this.formatGermanDateWhileTyping(value ?? '');
    this.cdr.markForCheck();
  }

  parseDateInput(value: string): Date | null {
    if (!value || !value.trim()) return null;
    const trimmed = value.trim();
    const parts = trimmed
      .split(/[.\-/]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map((p) => parseInt(p, 10));
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    const year = y < 100 ? 2000 + y : y;
    const month = m - 1;
    if (month < 0 || month > 11) return null;
    const date = new Date(year, month, d);
    if (date.getDate() !== d || date.getMonth() !== month || date.getFullYear() !== year) return null;
    return date;
  }

  onInputBlur(): void {
    this.inputValue = this.formatGermanDateWhileTyping(this.inputValue);
    const parsed = this.parseDateInput(this.inputValue);
    if (parsed) {
      parsed.setHours(12, 0, 0, 0);
      this.selectedDate = parsed;
      this.dateSelected.emit(this.selectedDate);
      this.inputValue = this.formatDateForInput(parsed);
      this.currentMonth = new Date(parsed);
      this.generateWeeks();
    } else {
      this.syncInputFromSelectedDate();
    }
    this.cdr.markForCheck();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      (event.target as HTMLInputElement).blur();
    }
  }

  togglePicker(): void {
    this.showPicker = !this.showPicker;
    if (this.showPicker) {
      this.generateWeeks();
    }
    this.cdr.markForCheck();
  }

  closePicker(): void {
    this.showPicker = false;
    this.cdr.markForCheck();
  }

  changeCurrentMonth(month: number): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), month, 1);
    this.generateWeeks();
  }

  changeCurrentYear(year: number): void {
    this.currentMonth = new Date(year, this.currentMonth.getMonth(), 1);
    this.generateWeeks();
  }

  isSelectedDate(date: Date): boolean {
    return this.selectedDate ? this.isSameDay(date, this.selectedDate) : false;
  }

  handleDateClick(date: Date): void {
    const selectedDate = new Date(date.getTime());
    selectedDate.setHours(12, 0, 0, 0);
    this.selectedDate = selectedDate;
    this.inputValue = this.formatDateForInput(selectedDate);
    this.dateSelected.emit(this.selectedDate);
  }

  onDone(): void {
    this.closePicker();
  }

  getDaysInMonth(year: number, month: number): Date[] {
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }

  generateWeeks(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const days = this.getDaysInMonth(year, month);
    if (days.length === 0) return;

    const newWeeks: Date[][] = [];
    let currentWeek: Date[] = [];
    let firstDayIndex = days[0].getDay();
    if (firstDayIndex === 0) firstDayIndex = 7;
    const padding = firstDayIndex - 1;
    for (let i = 0; i < padding; i++) {
      currentWeek.push(null as unknown as Date);
    }
    days.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        newWeeks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null as unknown as Date);
      }
      newWeeks.push(currentWeek);
    }
    this.weeks = newWeeks;
    this.cdr.markForCheck();
  }

  clearDate(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.selectedDate = null;
    this.inputValue = '';
    this.dateSelected.emit(null);
    this.cdr.markForCheck();
  }

  openPicker(event: MouseEvent): void {
    if (this.disabled) return;
    (event.target as HTMLElement).closest('.relative')?.querySelector('input')?.blur();
    this.togglePicker();
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  }

  isToday(date: Date): boolean {
    return this.isSameDay(date, this.today);
  }
}
