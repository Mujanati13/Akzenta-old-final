// date-range-picker.component.ts
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppIconComponent } from '../../app-icon.component';
import { EuDatePipe } from '../../pipes/eu-date.pipe';

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, EuDatePipe],
  templateUrl: './date-range-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush, // Add OnPush strategy
})
export class DateRangePickerComponent {
  @Input() selectedRange: { start: Date | null; end: Date | null } = { start: null, end: null };
  @Input() position: 'left' | 'right' = 'right'; // New input parameter
  @Input() height: string = 'h-[54px]'; // Default height
  /** When true, the calendar opens centered in the viewport (for programmatic triggers). */
  @Input() useViewportOverlay = false;
  /** When true, hides the input trigger (picker is opened programmatically via togglePicker()). */
  @Input() hideTrigger = false;
  @Output() rangeSelected = new EventEmitter<{ start: Date | null; end: Date | null }>();
  today: Date = new Date();

  constructor(
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
  ) {
    // Full year range for calendar navigation (past and future; avoids huge option lists)
    const minYear = 1900;
    const maxYear = 2100;
    for (let y = minYear; y <= maxYear; y++) {
      this.years.push(y);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showPicker && this.elementRef.nativeElement && !this.elementRef.nativeElement.contains(event.target)) {
      this.closePicker();
    }
  }
  currentMonth: Date = new Date();
  nextMonth: Date = new Date(new Date().setMonth(new Date().getMonth() + 1));
  showPicker = false;
  hoverDate: Date | null = null;
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
  presets = [
    { label: 'Heute', range: this.getTodayRange() },
    { label: 'Gestern', range: this.getYesterdayRange() },
    { label: 'Last 7 Days', range: this.getLast7DaysRange() },
    { label: 'Last 30 Days', range: this.getLast30DaysRange() },
    { label: 'This Month', range: this.getThisMonthRange() },
    { label: 'Last Month', range: this.getLastMonthRange() },
    { label: 'Last 3 Months', range: this.getLast3MonthsRange() },
    { label: 'Custom Range', range: { start: null, end: null } },
  ];

  // Add ViewChild to access the dropdown element
  @ViewChild('pickerDropdown') pickerDropdown: ElementRef;

  // Add property to track positioning
  shouldPositionLeft = false;

  // Add host listener to check window size on resize
  @HostListener('window:resize')
  onResize() {
    if (this.showPicker) {
      this.checkPosition();
    }
  }

  togglePicker() {
    this.showPicker = !this.showPicker;

    if (this.showPicker) {
      // Use setTimeout to allow DOM to update before checking position
      setTimeout(() => {
        this.checkPosition();
      }, 0);
    }
    this.cdr.markForCheck();
  }

  closePicker(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showPicker = false;
    this.cdr.markForCheck();
  }

  // Method to check available space and set position
  private checkPosition() {
    if (!this.pickerDropdown?.nativeElement) return;

    const element = this.pickerDropdown.nativeElement;
    const rect = element.getBoundingClientRect();
    const rightSpace = window.innerWidth - rect.right;

    // If there's not enough space on the right, position to the left
    this.shouldPositionLeft = rightSpace < 50;
    this.cdr.markForCheck();
  }

  // Add these new methods for year/month selection
  changeCurrentMonth(month: number) {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), month, 1);
    this.nextMonth = new Date(this.currentMonth);
    this.nextMonth.setMonth(this.nextMonth.getMonth() + 1);
  }

  changeCurrentYear(year: number) {
    this.currentMonth = new Date(year, this.currentMonth.getMonth(), 1);
    this.nextMonth = new Date(this.currentMonth);
    this.nextMonth.setMonth(this.nextMonth.getMonth() + 1);
  }

  changeNextMonth(month: number) {
    this.nextMonth = new Date(this.nextMonth.getFullYear(), month, 1);
    // Ensure next month is always after current month
    if (this.nextMonth <= this.currentMonth) {
      this.currentMonth = new Date(this.nextMonth);
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    }
  }

  changeNextYear(year: number) {
    this.nextMonth = new Date(year, this.nextMonth.getMonth(), 1);
    // Ensure next month is always after current month
    if (this.nextMonth <= this.currentMonth) {
      this.currentMonth = new Date(this.nextMonth);
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    }
  }
  selectPreset(range: { start: Date | null; end: Date | null }) {
    // Create proper copies of dates
    let start = range.start ? new Date(range.start.getTime()) : null;
    let end = range.end ? new Date(range.end.getTime()) : null;

    this.selectedRange = { start, end };

    // Update calendar views to show the selected date range
    if (start) {
      // Set current month to the start date's month
      this.currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);

      // If end date exists and is in a different month, show it in the second calendar
      if (end && (end.getMonth() !== start.getMonth() || end.getFullYear() !== start.getFullYear())) {
        this.nextMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      } else {
        // Otherwise, just show the next month
        this.nextMonth = new Date(this.currentMonth);
        this.nextMonth.setMonth(this.nextMonth.getMonth() + 1);
      }
    }

    if (start && end) {
      this.rangeSelected.emit({ ...this.selectedRange });
      // Don't close automatically - let user close with X or click outside
    }

    // Force change detection
    this.cdr.markForCheck();
  }

  isDateInRange(date: Date): boolean {
    if (!this.selectedRange.start || !this.selectedRange.end) return false;
    return date >= this.selectedRange.start && date <= this.selectedRange.end;
  }

  isDateStart(date: Date): boolean {
    return this.selectedRange.start ? this.isSameDay(date, this.selectedRange.start) : false;
  }

  isDateEnd(date: Date): boolean {
    return this.selectedRange.end ? this.isSameDay(date, this.selectedRange.end) : false;
  }

  isToday(date: Date): boolean {
    return this.isSameDay(date, this.today);
  }

  isHoveredInRange(date: Date): boolean {
    if (!this.hoverDate || !this.selectedRange.start || this.selectedRange.end) return false;

    const hoverTime = this.hoverDate.getTime();
    const startTime = this.selectedRange.start.getTime();
    const dateTime = date.getTime();

    return (dateTime > startTime && dateTime < hoverTime) || (dateTime < startTime && dateTime > hoverTime);
  }

  // Update handleDateClick to be more responsive
  handleDateClick(date: Date): void {
    // Create a copy of the date with time set to noon to avoid timezone issues
    const selectedDate = new Date(date.getTime());
    selectedDate.setHours(12, 0, 0, 0);

    // Case 1: No start date selected or both dates already selected (start fresh)
    if (!this.selectedRange.start || (this.selectedRange.start && this.selectedRange.end)) {
      this.selectedRange = {
        start: selectedDate,
        end: null,
      };
    }
    // Case 2: Only start date is selected, now selecting end date
    else if (this.selectedRange.start && !this.selectedRange.end) {
      // If clicked date is before start date, swap them
      if (selectedDate < this.selectedRange.start) {
        this.selectedRange = {
          start: selectedDate,
          end: new Date(this.selectedRange.start.getTime()),
        };
      } else {
        // Normal range selection
        this.selectedRange = {
          start: new Date(this.selectedRange.start.getTime()),
          end: selectedDate,
        };
      }

      // Emit the complete range immediately but don't close - let user close with X or click outside
      if (this.selectedRange.start && this.selectedRange.end) {
        this.rangeSelected.emit({ ...this.selectedRange });
        // Don't close automatically - let user close with X or click outside
      }
    }

    // Force change detection
    this.cdr.markForCheck();
  }

  navigateMonth(calendar: 'current' | 'next', direction: number) {
    if (calendar === 'current') {
      this.currentMonth = new Date(this.currentMonth.setMonth(this.currentMonth.getMonth() + direction));
    } else {
      this.nextMonth = new Date(this.nextMonth.setMonth(this.nextMonth.getMonth() + direction));
    }
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

  getWeeksForMonth(year: number, month: number): Date[][] {
    const days = this.getDaysInMonth(year, month);
    const weeks: Date[][] = [];
    let week: Date[] = [];

    // Add nulls for days before the first of the month
    const firstDay = days[0].getDay();
    for (let i = 0; i < firstDay; i++) {
      week.push(null as any);
    }

    days.forEach((day) => {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    });

    // Add nulls for days after the last of the month
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null as any);
      }
      weeks.push(week);
    }

    return weeks;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
  }

  private getTodayRange() {
    const today = new Date();
    return { start: today, end: today };
  }

  private getYesterdayRange() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: yesterday, end: yesterday };
  }

  private getLast7DaysRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return { start, end };
  }

  private getLast30DaysRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return { start, end };
  }

  private getThisMonthRange() {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date();
    return { start, end };
  }

  private getLastMonthRange() {
    const start = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const end = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
    return { start, end };
  }

  private getLast3MonthsRange() {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 2);
    start.setDate(1);
    return { start, end };
  }

  isPresetActive(preset: { label: string; range: { start: Date | null; end: Date | null } }): boolean {
    if (!preset.range.start || !preset.range.end || !this.selectedRange.start || !this.selectedRange.end) {
      return false;
    }

    return this.isSameDay(this.selectedRange.start, preset.range.start) && this.isSameDay(this.selectedRange.end, preset.range.end);
  }

  applySelection() {
    if (this.selectedRange.start && this.selectedRange.end) {
      this.rangeSelected.emit(this.selectedRange);
      // Don't close automatically - let user close with X or click outside
    }
  }

  clearRange(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedRange = { start: null, end: null };
    this.rangeSelected.emit({ start: null, end: null });
    this.cdr.markForCheck();
  }

  // Add trackBy functions to prevent unnecessary re-renders
  trackByWeekIndex(index: number): number {
    return index;
  }

  trackByDayIndex(index: number): number {
    return index;
  }
}
