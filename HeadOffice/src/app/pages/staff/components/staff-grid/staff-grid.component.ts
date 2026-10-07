import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppIconComponent } from '@app/shared/app-icon.component';
import { FormsModule } from '@angular/forms';
import { EuDatePipe } from '@app/shared/pipes/eu-date.pipe';
import { PaginatorModule } from 'primeng/paginator';

@Component({
  selector: 'app-staff-grid',
  standalone: true,
  imports: [CommonModule, RouterModule, AppIconComponent, FormsModule, EuDatePipe, PaginatorModule],
  templateUrl: './staff-grid.component.html',
})
export class StaffGridComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() staffData: any[] = [];
  @Input() rows: number = 8; // Default to 8 rows per page
  @Input() hasNextPage: boolean = false;
  @Input() totalItems: number = 0;
  @Input() loading: boolean = false; // Loading state
  @Input() first: number = 0; // allow parent to restore pagination position
  @Input() initialFilters: {
    firstName: string;
    lastName: string;
    address: string;
    country: string;
    distance: string;
    qualifications: Record<string, boolean>;
    status: Record<string, boolean>;
  } | null = null;

  @Output() pageChange = new EventEmitter<{ first: number; rows: number }>();
  @Output() favoriteChange = new EventEmitter<{ newStatus: boolean; staff: any }>();

  @ViewChild('paginator') paginator: any;

  filteredStaffData: any[] = [];
  paginatedData: any[] = [];
  totalRecords: number = 0;
  private pendingFirstRestore: number | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.syncStaffData();
    this.debug('init', {
      staffDataLength: this.staffData.length,
      rows: this.rows,
      first: this.first,
    });
  }

  ngAfterViewInit() {
    // Manually attach event listener to paginator since onPage event doesn't fire reliably
    setTimeout(() => {
      if (this.paginator && this.paginator.el) {
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
            // Small delay to let PrimeNG update its internal state
            setTimeout(() => {
              const newFirst = this.paginator.first !== undefined ? this.paginator.first : this.first;
              const newRows = this.paginator.rows !== undefined ? this.paginator.rows : this.rows;
              if (newFirst !== this.first || newRows !== this.rows) {
                this.onPageChange({ first: newFirst, rows: newRows });
              }
            }, 50);
          }
        });
        this.debug('afterViewInit', { paginatorFound: !!this.paginator });
      }
    }, 100);

    // If parent provided a first value before paginator was ready, apply it now
    setTimeout(() => {
      if (this.pendingFirstRestore !== null && this.paginator && typeof this.paginator.changePage === 'function') {
        const targetPage = Math.floor(this.pendingFirstRestore / this.rows);
        this.paginator.changePage(targetPage);
        this.pendingFirstRestore = null;
      }
    }, 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['staffData']) {
      this.syncStaffData();
      this.debug('staffData changed', {
        newLength: this.staffData.length,
        first: this.first,
        rows: this.rows,
      });
    }
    if (changes['rows']) {
      this.updatePaginatedData();
    }

    if (changes['first'] && typeof changes['first'].currentValue === 'number') {
      this.first = changes['first'].currentValue;
      const targetPage = Math.floor(this.first / this.rows);
      if (this.paginator && typeof this.paginator.changePage === 'function') {
        this.paginator.changePage(targetPage);
      } else {
        this.pendingFirstRestore = this.first;
        this.updatePaginatedData();
      }
    }
  }

  private syncStaffData(): void {
    this.filteredStaffData = [...this.staffData];
    this.updatePaginatedData();
  }

  get serverPaginationActive(): boolean {
    return false;
  }

  get shouldShowPaginator(): boolean {
    return this.totalRecords > this.rows;
  }

  updatePaginatedData() {
    this.paginatedData = this.filteredStaffData.slice(this.first, this.first + this.rows);
    this.totalRecords = this.totalItems || this.filteredStaffData.length;

    this.debug('pagination updated', {
      rows: this.rows,
      filteredTotal: this.totalRecords,
      pageLength: this.paginatedData.length,
      paginatedDataIds: this.paginatedData.map((s) => s.id),
    });
    this.cdr.markForCheck();
  }

  onPageChange(event: any): void {
    this.debug('onPageChange called', { event });

    this.first = event.first;
    this.rows = event.rows;

    this.updatePaginatedData();

    this.debug('page change event', {
      event,
      newFirst: this.first,
      newRows: this.rows,
      paginatedDataLength: this.paginatedData.length,
    });

    this.pageChange.emit({ first: this.first, rows: this.rows });
  }

  private debug(label: string, payload?: any) {
    if (typeof window === 'undefined') {
      return;
    }
    const storeKey = '__staffGridDebug';
    const entry = {
      label,
      payload,
      timestamp: new Date().toISOString(),
    };
    (window as any)[storeKey] = (window as any)[storeKey] || [];
    (window as any)[storeKey].push(entry);
  }

  onFavoriteChanged(newStatus: boolean, staff: any): void {
    staff.isFavorite = newStatus;
    this.favoriteChange.emit({ newStatus, staff });
  }
}
