const fs = require('fs');

const html = `
<ng-container *ngIf="visible">
  <!-- Backdrop -->
  <div class="mobile-filter-sheet-backdrop" (click)="onBackdropClick()" @backdropAnim></div>

  <!-- Sheet -->
  <div class="mobile-filter-sheet" @sheetAnim #sheet>
    <div class="mobile-filter-sheet__handle-bar cursor-pointer" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)" (click)="triggerSheetClose()"></div>
    
    <!-- Header -->
    <div class="mobile-filter-sheet__header mt-1 cursor-pointer" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)" (click)="triggerSheetClose()">
      <div class="flex items-center gap-3">
        <div class="relative inline-flex">
          <span class="mobile-filter-sheet__header-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M6 12h12M8 18h8" />
            </svg>
          </span>
          <span
            *ngIf="hasActiveFilters"
            class="absolute -top-1 -right-1 w-3 h-3 bg-[#00839b] border-2 border-white rounded-full z-10"
          ></span>
        </div>
        <div>
          <p class="mobile-filter-sheet__label">Filter</p>
          <p class="mobile-filter-sheet__title">{{ title }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button *ngIf="hasActiveFilters" type="button" class="filter-modal-clear shrink-0" (click)="clearFilters(); $event.stopPropagation()" aria-label="Filter zurücksetzen">
          <svg class="filter-modal-clear__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Clear</span>
        </button>
        <button type="button" (click)="close(); $event.stopPropagation()" class="mobile-filter-sheet__icon-btn" aria-label="Schließen">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="mobile-filter-sheet__content bg-white p-5 flex flex-col gap-6 pb-12" style="height: auto; max-height: calc(90vh - 120px); overflow-y: auto;">
      
      <!-- Search Input 1 (Project) -->
      <div class="relative w-full">
        <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Projekt Name</label>
        <input
          type="text"
          placeholder="Projekt Suchen..."
          [(ngModel)]="projectSearchTerm"
          (input)="emitProjectSearch()"
          class="h-[48px] px-4 pr-10 border text-gray-700 border-gray-200 rounded-[12px] font-dm text-[15px] w-full focus:outline-none focus:ring-0 focus:border-primary-500 bg-gray-50/50 shadow-sm transition-all focus:bg-white"
        />
        <app-icon *ngIf="!projectSearchTerm || projectSearchTerm.length === 0" name="search" class="absolute right-4 top-[32px] transform w-[18px] h-[18px] text-gray-400" />
        <button
          *ngIf="projectSearchTerm && projectSearchTerm.length > 0"
          type="button"
          (click)="clearProjectSearch()"
          class="absolute right-4 top-[32px] text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Search Input 2 (Filiale) -->
      <div class="relative w-full">
        <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Filiale Name</label>
        <input
          type="text"
          placeholder="Filiale Suchen..."
          [(ngModel)]="filialeSearchTerm"
          (input)="emitFilialeSearch()"
          class="h-[48px] px-4 pr-10 border text-gray-700 border-gray-200 rounded-[12px] font-dm text-[15px] w-full focus:outline-none focus:ring-0 focus:border-primary-500 bg-gray-50/50 shadow-sm transition-all focus:bg-white"
        />
        <app-icon *ngIf="!filialeSearchTerm || filialeSearchTerm.length === 0" name="search" class="absolute right-4 top-[32px] transform w-[18px] h-[18px] text-gray-400" />
        <button
          *ngIf="filialeSearchTerm && filialeSearchTerm.length > 0"
          type="button"
          (click)="clearFilialeSearch()"
          class="absolute right-4 top-[32px] text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Date Range Picker -->
      <div class="relative w-full z-20">
        <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Datum Filter</label>
        <app-date-range-picker [(selectedRange)]="dateRange" (rangeSelected)="onRangeSelected($event)" position="center" class="w-full"> </app-date-range-picker>
      </div>
      
      <!-- Create New Project Section -->
      <div class="mt-2 pt-5 border-t border-gray-200 flex justify-center" *ngIf="clientId">
        <a
          class="h-[52px] w-full font-dm text-white bg-primary-500 rounded-[12px] shadow-md flex space-x-[12px] items-center justify-center text-[15px] cursor-pointer hover:bg-primary-600 active:scale-95 transition-all shadow-primary-500/20"
          [routerLink]="['/clients', clientId, 'projects', 'create']"
          (click)="triggerSheetClose()"
        >
          <app-icon name="plus" class="w-[16px] h-[16px] text-white" />
          <span class="font-bold tracking-wide">Neues Projekt anlegen</span>
        </a>
      </div>
    </div>

  </div>
</ng-container>
`;

fs.writeFileSync('src/app/shared/components/project-mobile-filter-sheet/project-mobile-filter-sheet.component.html', html, 'utf8');

const scss = `
@import '../mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component.scss';
`;

fs.writeFileSync('src/app/shared/components/project-mobile-filter-sheet/project-mobile-filter-sheet.component.scss', scss, 'utf8');
