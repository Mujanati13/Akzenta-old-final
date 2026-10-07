import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayModule, ConnectionPositionPair } from '@angular/cdk/overlay';
import { AppIconComponent } from '../../app-icon.component';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, AppIconComponent],
  templateUrl: './date-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePickerComponent implements OnInit, OnChanges {
  @Input() selectedDate: Date | string | null = null;
  @Input() placeholder: string = 'TT.MM.JJJJ';
  /** Smaller control for dense tables / inline edits */
  @Input() compact = false;
  @Input() disabled = false;
  @Output() dateSelected = new EventEmitter<Date | null>();

  /** Current text in the input (for manual entry). Synced with selectedDate when it changes from outside. */
  inputValue = '';

  today: Date = new Date();
  currentMonth: Date = new Date();
  weeks: Date[][] = []; // Cache weeks
  showPicker = false;

  // Helper for template usage
  Math = Math;

  positions: ConnectionPositionPair[] = [
    new ConnectionPositionPair({ originX: 'start', originY: 'bottom' }, { overlayX: 'start', overlayY: 'top' }),
    new ConnectionPositionPair({ originX: 'start', originY: 'top' }, { overlayX: 'start', overlayY: 'bottom' }),
  ];

  years: number[] = [];
  months = [
    { value: 0, name: 'January' },
    { value: 1, name: 'February' },
    { value: 2, name: 'March' },
    { value: 3, name: 'April' },
    { value: 4, name: 'May' },
    { value: 5, name: 'June' },
    { value: 6, name: 'July' },
    { value: 7, name: 'August' },
    { value: 8, name: 'September' },
    { value: 9, name: 'October' },
    { value: 10, name: 'November' },
    { value: 11, name: 'December' },
  ];
  presets = [
    { label: 'Today', date: this.getToday() },
    { label: 'Yesterday', date: this.getYesterday() },
    { label: 'First of Month', date: this.getFirstOfMonth() },
    { label: 'Last Month', date: this.getFirstOfLastMonth() },
  ];

  constructor(private cdr: ChangeDetectorRef) {
    // Full year range for calendar navigation (past and future; avoids huge option lists)
    const minYear = 1900;
    const maxYear = 2100;
    for (let y = minYear; y <= maxYear; y++) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.syncInputFromSelectedDate();
    const coerced = this.coerceToDate(this.selectedDate);
    if (coerced) {
      this.currentMonth = new Date(coerced);
    }
    this.generateWeeks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate']) {
      this.syncInputFromSelectedDate();
      const coerced = this.coerceToDate(this.selectedDate);
      if (coerced) {
        this.currentMonth = new Date(coerced);
        this.generateWeeks();
      }
    }
  }

  /** Accept Date instances, ISO/date-only strings, and DD.MM.YYYY from parent forms. */
  private coerceToDate(value: Date | string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      const dotFormatMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (dotFormatMatch) {
        const [, day, month, year] = dotFormatMatch;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /** Sync the input text from selectedDate (e.g. when parent sets it or after picking from calendar). */
  private syncInputFromSelectedDate(): void {
    const coerced = this.coerceToDate(this.selectedDate);
    if (coerced) {
      this.selectedDate = coerced;
      this.inputValue = this.formatDateForInput(coerced);
    } else {
      this.inputValue = '';
    }
    this.cdr.markForCheck();
  }

  /** Format date as DD.MM.YYYY for the input. */
  private formatDateForInput(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  /**
   * Strip non-digits, keep up to 8 (DDMMYYYY), insert dots so typing "0102" → "01.02", "01022026" → "01.02.2026".
   */
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

  /** Parse DD.MM.YYYY (or D.M.YYYY) string to Date, or null if invalid. */
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

  togglePicker() {
    this.showPicker = !this.showPicker;
    if (this.showPicker) {
      this.generateWeeks();
    }
    this.cdr.markForCheck();
  }

  closePicker() {
    this.showPicker = false;
    this.cdr.markForCheck();
  }

  changeCurrentMonth(month: number) {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), month, 1);
    this.generateWeeks();
  }

  changeCurrentYear(year: number) {
    this.currentMonth = new Date(year, this.currentMonth.getMonth(), 1);
    this.generateWeeks();
  }

  selectPreset(date: Date | null) {
    if (date) {
      this.selectedDate = new Date(date.getTime());
      this.inputValue = this.formatDateForInput(this.selectedDate);
      this.dateSelected.emit(this.selectedDate);
      this.closePicker();
    }
  }

  isSelectedDate(date: Date): boolean {
    const coerced = this.coerceToDate(this.selectedDate);
    return coerced ? this.isSameDay(date, coerced) : false;
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
    const days = [];
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

    // Adjust for Monday start (Monday=1...Sunday=7)
    let firstDayIndex = days[0].getDay();
    if (firstDayIndex === 0) firstDayIndex = 7;
    const padding = firstDayIndex - 1;

    for (let i = 0; i < padding; i++) {
      currentWeek.push(null as any);
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
        currentWeek.push(null as any);
      }
      newWeeks.push(currentWeek);
    }

    this.weeks = newWeeks;
    this.cdr.markForCheck();
  }

  clearDate(event: MouseEvent) {
    event.stopPropagation(); // Prevent opening the picker
    if (this.disabled) {
      return;
    }
    this.selectedDate = null;
    this.inputValue = '';
    this.dateSelected.emit(null);
    this.cdr.markForCheck();
  }

  openPicker(event: MouseEvent): void {
    if (this.disabled) {
      return;
    }
    (event.target as HTMLElement).closest('.relative')?.querySelector('input')?.blur();
    this.togglePicker();
  }

  private isSameDay(date1: any, date2: any): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  }

  private getToday(): Date {
    return new Date();
  }

  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  private getFirstOfMonth(): Date {
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }

  private getFirstOfLastMonth(): Date {
    return new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  }

  isPresetActive(preset: { label: string; date: Date }): boolean {
    const coerced = this.coerceToDate(this.selectedDate);
    if (!preset.date || !coerced) {
      return false;
    }

    return this.isSameDay(coerced, preset.date);
  }

  isToday(date: Date): boolean {
    return this.isSameDay(date, this.today);
  }
}
