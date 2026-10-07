import { Component, ViewChild, ElementRef, Renderer2, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListboxModule } from 'primeng/listbox';
import { TranslateModule } from '@ngx-translate/core';
import { animate, style, transition, trigger } from '@angular/animations';

export interface FilterColumn {
  field: string;
  header: string;
}

export interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

@Component({
  selector: 'app-mobile-filter-bottom-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, ListboxModule, TranslateModule],
  templateUrl: './mobile-filter-bottom-sheet.component.html',
  styleUrl: './mobile-filter-bottom-sheet.component.scss',
  animations: [
    trigger('backdropAnim', [transition(':enter', [style({ opacity: 0 }), animate('200ms ease-out', style({ opacity: 1 }))]), transition(':leave', [animate('180ms ease-in', style({ opacity: 0 }))])]),
    trigger('sheetAnim', [
      transition(':enter', [style({ transform: 'translateY(100%)' }), animate('320ms cubic-bezier(0.32, 0.72, 0, 1)', style({ transform: 'translateY(0)' }))]),
      transition(':leave', [animate('260ms cubic-bezier(0.32, 0.72, 0, 1)', style({ transform: 'translateY(100%)' }))]),
    ]),
  ],
})
export class MobileFilterBottomSheetComponent implements OnChanges {
  @ViewChild('sheet') sheetElement!: ElementRef;
  startY = 0;
  currentY = 0;
  isDragging = false;

  constructor(private renderer: Renderer2) {}

  onTouchStart(event: TouchEvent) {
    this.startY = event.touches[0].clientY;
    this.currentY = this.startY;
    this.isDragging = true;
    if (this.sheetElement) {
      this.renderer.setStyle(this.sheetElement.nativeElement, 'transition', 'none');
    }
  }

  onTouchMove(event: TouchEvent) {
    if (!this.isDragging) return;
    this.currentY = event.touches[0].clientY;
    const deltaY = this.currentY - this.startY;

    if (deltaY > 0 && this.sheetElement) {
      // event.preventDefault() can throw passive event listener errors on some browsers when scrolling
      // event.preventDefault();
      this.renderer.setStyle(this.sheetElement.nativeElement, 'transform', `translateY(${deltaY}px)`);
    }
  }

  onTouchEnd(event: TouchEvent) {
    if (!this.isDragging) return;
    this.isDragging = false;
    const deltaY = this.currentY - this.startY;

    if (this.sheetElement) {
      this.renderer.setStyle(this.sheetElement.nativeElement, 'transition', 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)');
      this.renderer.removeStyle(this.sheetElement.nativeElement, 'transform');
    }

    if (deltaY > 75) {
      this.close();
    }
  }
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() title = 'Filter';
  @Input() columns: FilterColumn[] = [];
  @Input() filterValues: { [field: string]: string[] } = {};
  @Input() columnOptions: { [field: string]: FilterOption[] } = {};
  @Input() canFilterMap: { [field: string]: boolean } = {};
  @Input() customActiveFilterCount?: number;

  @Output() filtersChanged = new EventEmitter<{ field: string; values: string[] }>();
  @Output() allFiltersCleared = new EventEmitter<void>();
  @Output() sheetHide = new EventEmitter<void>();

  activeTab = '';
  localValues: string[] = [];

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

  get activeColumnHeader(): string {
    return this.columns.find((c) => c.field === this.activeTab)?.header || this.activeTab;
  }

  get activeOptions(): FilterOption[] {
    return this.columnOptions[this.activeTab] || [];
  }

  get totalActiveFilters(): number {
    if (this.customActiveFilterCount !== undefined) {
      return this.customActiveFilterCount;
    }
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
    this.filtersChanged.emit({ field: this.activeTab, values: [...this.localValues] });
  }

  clearActiveTab(): void {
    this.localValues = [];
    this.filtersChanged.emit({ field: this.activeTab, values: [] });
  }

  clearAll(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.localValues = [];
    this.allFiltersCleared.emit();
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.sheetHide.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  triggerSheetClose() {
    if (this.sheetElement) {
      this.renderer.setStyle(this.sheetElement.nativeElement, 'transition', 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)');
      this.renderer.setStyle(this.sheetElement.nativeElement, 'transform', 'translateY(100%)');
    }
    setTimeout(() => {
      this.close();
    }, 280);
  }
}
