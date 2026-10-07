import { Component, Input, Output, EventEmitter, ViewChild, ChangeDetectorRef, ViewEncapsulation, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { MultiSelect } from 'primeng/multiselect';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { PopoverModule } from 'primeng/popover';
import { MultiSelectModule } from 'primeng/multiselect';
import { ListboxModule } from 'primeng/listbox';
import { TagModule } from 'primeng/tag';
import { RatingModule } from 'primeng/rating';
import { TooltipModule } from 'primeng/tooltip';
import { AppIconComponent } from '@app/shared/app-icon.component';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { SettingsButtonComponent } from '@app/components/settings-button/settings-button.component';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { ColumnFilterDialogComponent } from '@app/shared/components/column-filter-dialog/column-filter-dialog.component';
import { MobileFilterBottomSheetComponent, FilterOption } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

interface Column {
  field: string;
  header: string;
}

const COLUMN_FILTER_EMPTY_LABEL = '--';

@Component({
  selector: 'app-staff-table',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TableModule,
    PaginatorModule,
    DialogModule,
    PopoverModule,
    MultiSelectModule,
    ListboxModule,
    TagModule,
    RatingModule,
    TooltipModule,
    FormsModule,
    AppIconComponent,
    FavoriteToggleComponent,
    SettingsButtonComponent,
    ColumnFilterPopoverComponent,
    ColumnFilterDialogComponent,
    MobileFilterBottomSheetComponent,
  ],
  templateUrl: './staff-table.component.html',
  styleUrls: ['./staff-table.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class StaffTableComponent implements AfterViewInit, OnChanges {
  @Input() staffData: any[] = [];
  @Input() cols: any[] = [];
  @Input() selectedColumns: any[] = [];
  @Input() expandedRows: any = {};
  @Input() first: number = 0;
  @Input() totalRecords: number = 0;
  @Input() hasNextPage: boolean = false;
  @Input() rows: number = 8; // Default to 8 rows per page
  @Input() loading: boolean = false; // Loading state
  @Input() initialColumnFilters: { [key: string]: string[] } | null = null;

  // Computed total for pagination (reactive)
  get totalFilteredRecords(): number {
    return this.getFilteredStaffData().length;
  }

  get serverPaginationActive(): boolean {
    return false;
  }

  get paginatorTotalRecords(): number {
    return this.totalFilteredRecords;
  }

  get showPaginator(): boolean {
    return this.totalFilteredRecords > this.rows || this.first > 0;
  }

  // Add output event for favorite changes
  @Output() favoriteChange = new EventEmitter<{ newStatus: boolean; staff: any }>();

  // Output event for filter changes
  @Output() filterChange = new EventEmitter<void>();
  @Output() columnFiltersChange = new EventEmitter<{ [key: string]: string[] }>();

  // Emit pagination change event
  @Output() pageChange = new EventEmitter<{ first: number; rows: number }>();
  @Output() navigationRequested = new EventEmitter<void>();

  // Add these properties for sorting
  sortField: string = '';
  sortOrder: number = 1; // 1 for ascending, -1 for descending

  // Add these properties to track column order and visibility
  staffOrderedColumns: Column[] = [];
  staffVisibleColumns: { [key: string]: boolean } = {};

  // Column filter properties
  staffColumnFilters: { [key: string]: string[] } = {
    firstName: [],
    lastName: [],
    email: [],
    phone: [],
    address: [],
    city: [],
    distance: [],
    qualifications: [],
    status: [],
  };

  // Track current filter field for popovers
  currentStaffFilterField: string = '';
  currentStaffFilterOptions: { label: string; value: string }[] = [];
  showStaffMobileFilter = false;
  staffMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  staffCanFilterMap: { [field: string]: boolean } = {};

  showColumnFilterModal = false;

  @ViewChild('staffSettingsPopover') staffSettingsPopover: any;
  @ViewChild('staffColumnFilterPopover') staffColumnFilterPopover: any;
  @ViewChild('staffColumnsMultiSelect') staffColumnsMultiSelect?: MultiSelect;
  @ViewChild('paginator') paginator: any;
  @ViewChild(Table) table!: Table;
  private activeStaffColumnFilterPopover: any = null;
  private activeSettingsPopover: any = null;
  private columnFilterPopoverTimeout: any = null;
  private pendingFirstRestore: number | null = null;

  private normalizeColumnFilterValue(value: string | null | undefined): string {
    const normalized = (value ?? '').toString().trim();
    return normalized === '-' ? '' : normalized;
  }

  private getColumnFilterOptionLabel(value: string): string {
    return value ? value : COLUMN_FILTER_EMPTY_LABEL;
  }

  private sortColumnFilterValues(values: string[]): string[] {
    return [...values].sort((a, b) => {
      const aEmpty = a === '';
      const bEmpty = b === '';
      if (aEmpty !== bEmpty) {
        return aEmpty ? 1 : -1;
      }
      return a.localeCompare(b, 'de', { sensitivity: 'base', numeric: true });
    });
  }

  private appendSelectedFilterValues(values: Set<string>, selectedValues?: string[]): void {
    (selectedValues || []).forEach((selected) => values.add(selected));
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngAfterViewInit() {
    // Manually attach event listener to paginator since onPage can be unreliable
    // for this standalone paginator in our current PrimeNG setup.
    setTimeout(() => {
      if (this.paginator?.el) {
        const paginatorElement = this.paginator.el.nativeElement;
        paginatorElement.addEventListener('click', (e: any) => {
          const target = e.target.closest('button');
          if (
            target &&
            (target.classList.contains('p-paginator-page') ||
              target.classList.contains('p-paginator-first') ||
              target.classList.contains('p-paginator-prev') ||
              target.classList.contains('p-paginator-next') ||
              target.classList.contains('p-paginator-last') ||
              target.classList.contains('p-paginator-rpp-options'))
          ) {
            setTimeout(() => {
              const newFirst = this.paginator.first !== undefined ? this.paginator.first : this.first;
              const newRows = this.paginator.rows !== undefined ? this.paginator.rows : this.rows;
              if (newFirst !== this.first || newRows !== this.rows) {
                this.onPageChange({ first: newFirst, rows: newRows });
              }
            }, 50);
          }
        });
      }
    }, 100);

    setTimeout(() => {
      if (this.pendingFirstRestore !== null && this.paginator && typeof this.paginator.changePage === 'function') {
        const targetPage = Math.floor(this.pendingFirstRestore / this.rows);
        this.paginator.changePage(targetPage);
        this.pendingFirstRestore = null;
      }
    }, 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    // Initialize ordered columns when input properties change
    if (this.cols && this.cols.length > 0 && this.staffOrderedColumns.length === 0) {
      this.staffOrderedColumns = [...this.cols];
      this.initializeVisibleColumns();
    }

    // Sync first when parent updates it (for state synchronization)
    if (changes['first'] && changes['first'].currentValue !== undefined) {
      // Only update if it's different to avoid infinite loops
      if (this.first !== changes['first'].currentValue) {
        this.first = changes['first'].currentValue;
      }

      const targetPage = Math.floor(this.first / this.rows);
      if (this.paginator && typeof this.paginator.changePage === 'function') {
        this.paginator.changePage(targetPage);
      } else {
        this.pendingFirstRestore = this.first;
      }
    }

    // Sync rows when parent updates it
    if (changes['rows'] && changes['rows'].currentValue !== undefined) {
      if (this.rows !== changes['rows'].currentValue) {
        this.rows = changes['rows'].currentValue;
      }
    }

    // Sync column filters from parent cache
    if (changes['initialColumnFilters'] && changes['initialColumnFilters'].currentValue) {
      this.staffColumnFilters = { ...changes['initialColumnFilters'].currentValue };
    }

    // Log when totalRecords changes
    if (changes['totalRecords']) {
      // Force change detection to ensure PrimeNG table updates
      this.cdr.markForCheck();
    }

    if (changes['staffData']) {
      this.refreshCurrentStaffFilterOptions();
      this.refreshStaffMobileFilterOptions();
      this.cdr.markForCheck();
    }
  }

  // Initialize visible columns
  initializeVisibleColumns() {
    this.cols.forEach((col) => {
      this.staffVisibleColumns[col.field] = true;
    });
    // Explicitly set status to false by default
    this.staffVisibleColumns['status'] = false;
  }

  // Get visible columns in their current order
  getStaffVisibleColumns(): Column[] {
    return this.staffOrderedColumns.filter((col) => this.staffVisibleColumns[col.field]);
  }

  // Handle column reordering
  onColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      // Get the column that was moved
      const movedColumn = this.staffOrderedColumns[event.dragIndex];

      // Create a new array without the moved column
      const newOrderedColumns = [...this.staffOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);

      // Insert the moved column at the drop index
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      // Update the ordered columns with the new order
      this.staffOrderedColumns = newOrderedColumns;
    }
  }

  // Update visible columns when selection changes in multiselect
  onColumnsChange(selectedColumns: Column[]) {
    this.suppressScrollEvent();
    Object.keys(this.staffVisibleColumns).forEach((key) => {
      this.staffVisibleColumns[key] = false;
    });
    selectedColumns.forEach((col) => {
      this.staffVisibleColumns[col.field] = true;
    });
    this.selectedColumns = selectedColumns;
  }

  private suppressScrollEvent() {
    const scrollContainer = this.table?.el?.nativeElement?.querySelector('.p-datatable-scrollable');
    if (!scrollContainer) return;
    const handler = (e: Event) => e.stopImmediatePropagation();
    scrollContainer.addEventListener('scroll', handler, { capture: true, once: true });
  }

  // Existing methods...
  onFavoriteChanged(newStatus: boolean, staff: any): void {
    // Emit the event to parent component to handle the API call
    this.favoriteChange.emit({ newStatus, staff });
  }

  getSeverity(status: string): string {
    switch (status) {
      case 'Team':
        return 'success';
      case 'Out':
        return 'danger';
      case 'Neu':
        return 'info';
      default:
        return 'warning';
    }
  }

  // Add these methods for sorting functionality
  onSort(field: string, event?: Event): void {
    // Prevent event propagation to avoid triggering other handlers
    event?.stopPropagation();

    if (this.sortField === field) {
      // If clicking on the same field, toggle the sort order
      this.sortOrder = this.sortOrder * -1;
    } else {
      // New sort field, default to ascending
      this.sortField = field;
      this.sortOrder = 1;
    }

    // Apply sorting
    this.staffData = this.applyStaffSorting(this.staffData, field, this.sortOrder);
  }

  private applyStaffSorting(data: any[] = [], field: string, order: number): any[] {
    if (!field) {
      return [...data];
    }

    const sorted = [...data];
    sorted.sort((a, b) => {
      const valueA = this.getStaffSortValue(a, field);
      const valueB = this.getStaffSortValue(b, field);

      if (valueA === valueB) {
        return 0;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueA < valueB ? order * -1 : order;
      }

      const normalizedA = (valueA ?? '').toString().toLowerCase();
      const normalizedB = (valueB ?? '').toString().toLowerCase();
      return order * normalizedA.localeCompare(normalizedB, 'de', { sensitivity: 'base', numeric: true });
    });

    return sorted;
  }

  private getStaffSortValue(staff: any, field: string): string | number {
    if (field === 'qualifications') {
      return Array.isArray(staff.qualifications) ? staff.qualifications.join(', ') : '';
    }
    if (field === 'distance') {
      const dist = staff.distance;
      return typeof dist === 'number' ? dist : parseFloat(dist) || 0;
    }
    return staff?.[field] ?? '';
  }

  private getStaffField(staff: any, field: string): any {
    if (field === 'firstName') {
      return staff.firstName || '';
    }

    if (field === 'qualifications') {
      return staff.qualifications || [];
    }

    return staff[field] || '';
  }

  // Column filter methods
  getStaffFilterOptions(field: string): { label: string; value: string }[] {
    const values = new Set<string>();
    const filteredData = this.getFilteredStaffData(field);
    filteredData.forEach((staff) => {
      let value: string = '';
      switch (field) {
        case 'firstName':
          value = staff.firstName || '';
          break;
        case 'lastName':
          value = staff.lastName || '';
          break;
        case 'email':
          value = staff.email || '';
          break;
        case 'phone':
          value = staff.phone || '';
          break;
        case 'address':
          value = staff.address || '';
          break;
        case 'city':
          value = staff.city || '';
          break;
        case 'distance':
          value = staff.distance || '';
          break;
        case 'qualifications':
          value = Array.isArray(staff.qualifications) ? staff.qualifications.join(', ') : '';
          break;
        case 'status':
          value = staff.status || '';
          break;
      }
      values.add(this.normalizeColumnFilterValue(value));
    });
    this.appendSelectedFilterValues(values, this.staffColumnFilters[field]);
    return this.sortColumnFilterValues(Array.from(values)).map((val) => ({
      label: this.getColumnFilterOptionLabel(val),
      value: val,
    }));
  }

  canFilterStaffColumn(field: string): boolean {
    return this.getStaffFilterOptions(field).length > 0;
  }

  getStaffColumnFilterValue(field: string): string[] {
    return this.staffColumnFilters[field] || [];
  }

  /**
   * Open filter popover with proper positioning
   * This method handles the positioning and display of filter popovers
   */
  private showColumnFilterPopover(popoverRef: any, targetElement: HTMLElement, delay = 120): void {
    if (!popoverRef || !targetElement) {
      return;
    }

    if (this.columnFilterPopoverTimeout) {
      clearTimeout(this.columnFilterPopoverTimeout);
      this.columnFilterPopoverTimeout = null;
    }

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    popoverRef.hide();
    this.activeStaffColumnFilterPopover = null;
    this.cdr.detectChanges();

    this.columnFilterPopoverTimeout = setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeStaffColumnFilterPopover = popoverRef;

      // Immediately open the first dropdown/multiselect inside the popover so the user doesn't need a second click
      this.scheduleOpenFirstDropdown(popoverRef);

      this.cdr.detectChanges();
    }, delay);
  }

  private closeActiveColumnFilterPopover(except?: any): void {
    if (this.staffColumnFilterPopover && this.staffColumnFilterPopover !== except) {
      this.staffColumnFilterPopover.hide();
    }

    if (this.activeStaffColumnFilterPopover && this.activeStaffColumnFilterPopover !== except) {
      this.activeStaffColumnFilterPopover = null;
    }
  }

  private hideSettingsPopover(except?: any): void {
    if (this.staffSettingsPopover && this.staffSettingsPopover !== except) {
      this.staffSettingsPopover.hide();
    }

    if (!except || (this.activeSettingsPopover && this.activeSettingsPopover !== except)) {
      this.activeSettingsPopover = null;
    }
  }

  private closeFavoritePopover(): void {
    if (FavoriteToggleComponent.activePopover) {
      FavoriteToggleComponent.activePopover.hide();
      FavoriteToggleComponent.activePopover = null;
    }
  }

  closeAllFilterPopovers(): void {
    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopover();
    this.closeFavoritePopover();
  }

  onFavoriteClick(event: Event): void {
    event.stopPropagation();
    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopover();
  }

  rememberStaffStateBeforeNavigate(): void {
    this.navigationRequested.emit();
  }

  private scheduleOpenFirstDropdown(popoverRef: any): void {
    // Try a few times to catch the overlay once it is rendered
    [0, 50, 120].forEach((delay) => setTimeout(() => this.tryOpenFirstDropdown(popoverRef), delay));
  }

  private openSettingsColumnsSelector(): void {
    if (!this.staffColumnsMultiSelect || this.staffColumnsMultiSelect.overlayVisible) {
      return;
    }

    [0, 50, 120].forEach((delay) =>
      setTimeout(() => {
        if (!this.staffColumnsMultiSelect?.overlayVisible) {
          this.staffColumnsMultiSelect?.show();
        }
      }, delay),
    );
  }

  private closeSettingsColumnsSelector(): void {
    if (this.staffColumnsMultiSelect?.overlayVisible) {
      this.staffColumnsMultiSelect.hide();
    }
  }

  private tryOpenFirstDropdown(popoverRef: any): void {
    const overlay: HTMLElement | null = popoverRef?.overlay?.nativeElement ?? (document.querySelector('.p-popover') as HTMLElement | null);
    if (!overlay) return;

    const trigger = overlay.querySelector('.p-multiselect-trigger, .p-dropdown-trigger') as HTMLElement | null;
    if (trigger) {
      trigger.click();
      return;
    }

    // Fallback: click the first multiselect to open its panel
    const multi = overlay.querySelector('.p-multiselect') as HTMLElement | null;
    if (multi) {
      multi.click();
    }
  }

  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
    this.cdr.detectChanges();
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.cdr.detectChanges();
  }

  getColumnFilterModalTitle(): string {
    const col = this.cols?.find((c: Column) => c.field === this.currentStaffFilterField);
    return col ? col.header : this.currentStaffFilterField || 'Filter';
  }

  /**
   * Open staff column filter popover
   */
  openStaffColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    if (!this.canFilterStaffColumn(field)) {
      return;
    }

    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    // Close settings and favorite popovers
    this.hideSettingsPopover();
    this.closeFavoritePopover();

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentStaffFilterField === field;
      if (isSameField && this.showColumnFilterModal) {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.currentStaffFilterField = field;
      if (!this.staffColumnFilters[field]) {
        this.staffColumnFilters[field] = [];
      }
      this.currentStaffFilterOptions = this.getStaffFilterOptions(field);
      this.openColumnFilterModal();
      return;
    }

    // Check if the same field is already open
    const isSameField = this.currentStaffFilterField === field;
    const isPopoverOpen = this.activeStaffColumnFilterPopover === this.staffColumnFilterPopover;

    // If clicking on the same field that's already open, just close it
    if (isSameField && isPopoverOpen) {
      this.closeActiveColumnFilterPopover();
      return;
    }

    this.closeActiveColumnFilterPopover();

    this.currentStaffFilterField = field;
    // Initialize filter values if not exists
    if (!this.staffColumnFilters[field]) {
      this.staffColumnFilters[field] = [];
    }

    this.currentStaffFilterOptions = this.getStaffFilterOptions(field);

    this.showColumnFilterPopover(this.staffColumnFilterPopover, targetElement, 120);
  }

  toggleStaffSettingsPopover(event: Event): void {
    this.toggleSettingsPopover(this.staffSettingsPopover, event);
  }

  onStaffSettingsPopoverClose(event?: Event): void {
    event?.stopPropagation();
    this.hideSettingsPopover();
  }

  onStaffColumnFilterPopoverClose(): void {
    if (this.staffColumnFilterPopover) {
      this.staffColumnFilterPopover.hide();
    }
    if (this.activeStaffColumnFilterPopover === this.staffColumnFilterPopover) {
      this.activeStaffColumnFilterPopover = null;
    }
  }

  private toggleSettingsPopover(popoverRef: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popoverRef || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popoverRef) {
      this.closeSettingsColumnsSelector();
      popoverRef.hide();
      this.activeSettingsPopover = null;
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.closeFavoritePopover();
    this.hideSettingsPopover(popoverRef);

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    popoverRef.hide();

    setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeSettingsPopover = popoverRef;
      // Immediately open the first dropdown/multiselect inside the popover so the user doesn't need a second click
      this.scheduleOpenFirstDropdown(popoverRef);
      this.openSettingsColumnsSelector();
    }, 120);
  }

  getFilteredStaffData(excludeField?: string): any[] {
    // Apply column filters to all staff data
    return this.staffData.filter((staff) => {
      // Filter by firstName
      if (excludeField !== 'firstName' && this.staffColumnFilters['firstName'].length > 0 && !this.staffColumnFilters['firstName'].includes(this.normalizeColumnFilterValue(staff.firstName))) {
        return false;
      }
      // Filter by lastName
      if (excludeField !== 'lastName' && this.staffColumnFilters['lastName'].length > 0 && !this.staffColumnFilters['lastName'].includes(this.normalizeColumnFilterValue(staff.lastName))) {
        return false;
      }
      // Filter by email
      if (excludeField !== 'email' && this.staffColumnFilters['email'].length > 0 && !this.staffColumnFilters['email'].includes(this.normalizeColumnFilterValue(staff.email))) {
        return false;
      }
      // Filter by phone
      if (excludeField !== 'phone' && this.staffColumnFilters['phone'].length > 0 && !this.staffColumnFilters['phone'].includes(this.normalizeColumnFilterValue(staff.phone))) {
        return false;
      }
      // Filter by address
      if (excludeField !== 'address' && this.staffColumnFilters['address'].length > 0 && !this.staffColumnFilters['address'].includes(this.normalizeColumnFilterValue(staff.address))) {
        return false;
      }
      // Filter by city
      if (excludeField !== 'city' && this.staffColumnFilters['city'].length > 0 && !this.staffColumnFilters['city'].includes(this.normalizeColumnFilterValue(staff.city))) {
        return false;
      }
      // Filter by distance
      if (excludeField !== 'distance' && this.staffColumnFilters['distance'].length > 0 && !this.staffColumnFilters['distance'].includes(this.normalizeColumnFilterValue(staff.distance))) {
        return false;
      }
      // Filter by qualifications
      if (excludeField !== 'qualifications' && this.staffColumnFilters['qualifications'].length > 0) {
        const staffQualifications = this.normalizeColumnFilterValue(Array.isArray(staff.qualifications) ? staff.qualifications.join(', ') : '');
        if (!this.staffColumnFilters['qualifications'].includes(staffQualifications)) {
          return false;
        }
      }
      // Filter by status
      if (excludeField !== 'status' && this.staffColumnFilters['status'].length > 0 && !this.staffColumnFilters['status'].includes(this.normalizeColumnFilterValue(staff.status))) {
        return false;
      }
      return true;
    });
  }

  // Get paginated staff data (filtered + paginated)
  getPaginatedStaffData(): any[] {
    const filtered = this.getFilteredStaffData();
    const startIndex = this.first;
    const endIndex = this.first + this.rows;
    return filtered.slice(startIndex, endIndex);
  }

  // Handle pagination event
  onPageChange(event: any): void {
    // Update internal pagination state for tracking
    this.first = event.first;
    this.rows = event.rows;

    // Force change detection to update the table
    this.cdr.markForCheck();

    // Also emit to parent for state synchronization (parent won't make API calls)
    this.pageChange.emit({ first: event.first, rows: event.rows });
  }

  // Handle filter change
  onFilterChange(): void {
    // When column filters change, reset to first page
    this.first = 0;

    // Explicitly reset table pagination
    if (this.table) {
      this.table.first = 0;
      // Also reset the first property of the paginator if it exists internally
      if (this.table.paginator) {
        // This helps ensure the UI updates correctly
      }
    }

    // Force change detection to update pagination
    this.cdr.markForCheck();
    this.pageChange.emit({ first: 0, rows: this.rows });
    this.filterChange.emit();
    this.columnFiltersChange.emit({ ...this.staffColumnFilters });
  }

  /**
   * Clear filter for a specific column
   */
  onStaffColumnFilterCleared(): void {
    if (this.currentStaffFilterField) {
      this.staffColumnFilters[this.currentStaffFilterField] = [];
    }
    this.onFilterChange();
  }

  /**
   * Check if any column filters are active
   */
  hasStaffColumnFilters(): boolean {
    return Object.values(this.staffColumnFilters).some((filters) => filters && Array.isArray(filters) && filters.length > 0);
  }

  // Get column header for a field
  getColumnHeader(field: string): string {
    if (field === 'firstName') {
      return 'Vorname';
    }
    const col = this.cols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  // Get tooltip value for a field
  getTooltipValue(staff: any, field: string): string {
    switch (field) {
      case 'qualifications':
        return staff.qualifications?.join(', ') || '-';
      case 'status':
        return staff.status || '-';
      default:
        return staff[field] || '-';
    }
  }

  // Get placeholder text for filter
  getFilterPlaceholder(field: string): string {
    const header = this.getColumnHeader(field);
    return `Alle ${header}`;
  }

  // Clear all column filters
  clearColumnFilters(): void {
    this.staffColumnFilters = {
      firstName: [],
      lastName: [],
      email: [],
      phone: [],
      address: [],
      city: [],
      distance: [],
      qualifications: [],
      status: [],
    };
    // Reset to first page when clearing filters
    this.first = 0;

    // Explicitly reset table pagination
    if (this.table) {
      this.table.first = 0;
    }

    this.pageChange.emit({ first: 0, rows: this.rows });
    this.columnFiltersChange.emit({ ...this.staffColumnFilters });
  }

  openStaffMobileFilterSheet(): void {
    this.refreshStaffMobileFilterOptions();
    this.showStaffMobileFilter = true;
  }

  private refreshCurrentStaffFilterOptions(): void {
    if (!this.currentStaffFilterField) {
      return;
    }

    this.currentStaffFilterOptions = this.getStaffFilterOptions(this.currentStaffFilterField);
  }

  private refreshStaffMobileFilterOptions(): void {
    const nextOptions: { [field: string]: FilterOption[] } = {};
    const nextCanFilterMap: { [field: string]: boolean } = {};

    const columns = this.getStaffMobileFilterColumns();
    columns.forEach((col) => {
      const canFilter = this.canFilterStaffColumn(col.field);
      nextCanFilterMap[col.field] = canFilter;
      if (canFilter) {
        nextOptions[col.field] = this.getStaffFilterOptions(col.field);
      }
    });

    this.staffCanFilterMap = nextCanFilterMap;
    this.staffMobileColumnOptions = nextOptions;
  }

  onStaffMobileFilterChanged(event: { field: string; values: string[] }): void {
    this.staffColumnFilters[event.field] = event.values;
    this.onFilterChange();
  }

  onStaffMobileFilterCleared(): void {
    this.staffColumnFilters = {
      firstName: [],
      lastName: [],
      email: [],
      phone: [],
      address: [],
      city: [],
      distance: [],
      qualifications: [],
      status: [],
    };
    this.onFilterChange();
  }

  getTotalStaffActiveFilters(): number {
    return Object.values(this.staffColumnFilters).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }

  getStaffMobileFilterColumns(): { field: string; header: string }[] {
    const columns: { field: string; header: string }[] = [{ field: 'firstName', header: 'Vorname' }];

    this.getStaffVisibleColumns().forEach((col) => {
      if (!columns.some((existing) => existing.field === col.field)) {
        columns.push({ field: col.field, header: col.header });
      }
    });

    return columns;
  }
}
