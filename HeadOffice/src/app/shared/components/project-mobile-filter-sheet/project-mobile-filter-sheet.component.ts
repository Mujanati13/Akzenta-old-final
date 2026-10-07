import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, Renderer2, OnChanges, SimpleChanges } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ListboxModule } from 'primeng/listbox';
import { AppIconComponent } from '../../app-icon.component';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';

export interface ProjectFilterColumn {
  field: string;
  header: string;
}

export interface ProjectFilterOption {
  label: string;
  value: string;
  color?: string;
}

@Component({
  selector: 'app-project-mobile-filter-bottom-sheet',
  templateUrl: './project-mobile-filter-sheet.component.html',
  styleUrls: ['./project-mobile-filter-sheet.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ListboxModule, AppIconComponent, DateRangePickerComponent],
  animations: [
    trigger('backdropAnim', [transition(':enter', [style({ opacity: 0 }), animate('0.2s ease-out', style({ opacity: 1 }))]), transition(':leave', [animate('0.2s ease-in', style({ opacity: 0 }))])]),
    trigger('sheetAnim', [
      transition(':enter', [style({ transform: 'translateY(100%)' }), animate('0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', style({ transform: 'translateY(0)' }))]),
      transition(':leave', [animate('0.25s cubic-bezier(0.4, 0.0, 1, 1)', style({ transform: 'translateY(100%)' }))]),
    ]),
  ],
})
export class ProjectMobileFilterSheetComponent implements OnChanges {
  @Input() visible = false;
  @Input() title = 'Projekte Filter';
  @Input() clientId: string | number | undefined;
  @Input() projectSearchTerm = '';
  @Input() filialeSearchTerm = '';
  @Input() dateRange: any = { start: null, end: null };

  @Input() columns: ProjectFilterColumn[] = [];
  @Input() filterValues: { [field: string]: string[] } = {};
  @Input() columnOptions: { [field: string]: ProjectFilterOption[] } = {};
  @Input() canFilterMap: { [field: string]: boolean } = {};

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() projectSearchTermChange = new EventEmitter<string>();
  @Output() filialeSearchTermChange = new EventEmitter<string>();
  @Output() dateRangeChange = new EventEmitter<any>();
  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() createProjectClicked = new EventEmitter<void>();
  @Output() columnFilterChanged = new EventEmitter<{ field: string; values: string[] }>();
  @Output() allColumnFiltersCleared = new EventEmitter<void>();

  @ViewChild('sheet') sheetRef!: ElementRef;

  activeTab = '';
  localValues: string[] = [];

  private startY = 0;
  private currentY = 0;
  private isDragging = false;

  constructor(private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      if (!this.activeTab || !this.columns.find((c) => c.field === this.activeTab)) {
        this.activeTab = this.columns[0]?.field || '';
      }
      this.syncLocalValues();
    }
    if (changes['filterValues'] && this.activeTab) {
      this.syncLocalValues();
    }
    if (changes['columns']?.currentValue?.length && !this.activeTab) {
      this.activeTab = this.columns[0].field;
      this.syncLocalValues();
    }
  }

  syncLocalValues(): void {
    this.localValues = [...(this.filterValues[this.activeTab] || [])];
  }

  get activeOptions(): ProjectFilterOption[] {
    return this.columnOptions[this.activeTab] || [];
  }

  get totalColumnFilters(): number {
    return Object.values(this.filterValues).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }

  getFieldActiveCount(field: string): number {
    return this.filterValues[field]?.length || 0;
  }

  canFilter(field: string): boolean {
    return this.canFilterMap[field] !== false;
  }

  selectTab(field: string): void {
    if (!this.canFilter(field)) return;
    this.activeTab = field;
    this.syncLocalValues();
  }

  onSelectionChange(): void {
    this.columnFilterChanged.emit({ field: this.activeTab, values: [...this.localValues] });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
  }

  onBackdropClick(): void {
    this.close();
  }

  emitProjectSearch(): void {
    this.projectSearchTermChange.emit(this.projectSearchTerm);
  }

  clearProjectSearch(): void {
    this.projectSearchTerm = '';
    this.emitProjectSearch();
  }

  emitFilialeSearch(): void {
    this.filialeSearchTermChange.emit(this.filialeSearchTerm);
  }

  clearFilialeSearch(): void {
    this.filialeSearchTerm = '';
    this.emitFilialeSearch();
  }

  onRangeSelected(range: any): void {
    this.dateRange = range;
    this.dateRangeChange.emit(range);
  }

  clearFilters(): void {
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.dateRange = { start: null, end: null };
    this.projectSearchTermChange.emit(this.projectSearchTerm);
    this.filialeSearchTermChange.emit(this.filialeSearchTerm);
    this.dateRangeChange.emit(this.dateRange);
    this.localValues = [];
    this.allColumnFiltersCleared.emit();
    this.clear.emit();
  }

  get hasActiveFilters(): boolean {
    return !!(this.projectSearchTerm || this.filialeSearchTerm || this.dateRange?.start || this.dateRange?.end || this.totalColumnFilters > 0);
  }

  onCreateProject(): void {
    this.createProjectClicked.emit();
    this.close();
  }

  onTouchStart(e: TouchEvent): void {
    this.startY = e.touches[0].clientY;
    this.isDragging = true;
    this.renderer.setStyle(this.sheetRef.nativeElement, 'transition', 'none');
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.isDragging) return;
    this.currentY = e.touches[0].clientY;
    const deltaY = this.currentY - this.startY;
    if (deltaY > 0) {
      this.renderer.setStyle(this.sheetRef.nativeElement, 'transform', `translateY(${deltaY}px)`);
    } else {
      const slowDelta = deltaY * 0.3;
      this.renderer.setStyle(this.sheetRef.nativeElement, 'transform', `translateY(${slowDelta}px)`);
    }
  }

  onTouchEnd(e: TouchEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.renderer.removeStyle(this.sheetRef.nativeElement, 'transition');

    let deltaY = 0;
    if (e.changedTouches.length > 0) {
      deltaY = e.changedTouches[0].clientY - this.startY;
    } else {
      deltaY = this.currentY - this.startY;
    }

    if (deltaY > 75) {
      this.close();
    } else {
      this.renderer.setStyle(this.sheetRef.nativeElement, 'transform', 'translateY(0)');
    }
  }

  triggerSheetClose(): void {
    this.close();
  }
}
