const fs = require('fs');
const file = 'HeadOffice/src/app/pages/filiale-suchen/filiale-suchen.component.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
const importStatement = "import { MobileFilterBottomSheetComponent, FilterOption } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';\n";
if (!content.includes('MobileFilterBottomSheetComponent')) {
  content = content.replace('import { Component,', importStatement + 'import { Component,');
  content = content.replace('imports: [TranslateModule,', 'imports: [MobileFilterBottomSheetComponent, TranslateModule,');
}

// 2. Add properties & methods
const propsPattern = /showColumnFilterModal = false;/;
const methodsToAdd = `
  showMobileFilialenFiltersSheet = false;
  filialenMobileColumns: Column[] = [];
  filialenMobileFilterValues: { [field: string]: string[] } = {};
  filialenMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  filialenMobileCanFilterMap: { [field: string]: boolean } = {};

  showMobileProjekteFiltersSheet = false;
  projekteMobileColumns: Column[] = [];
  projekteMobileFilterValues: { [field: string]: string[] } = {};
  projekteMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  projekteMobileCanFilterMap: { [field: string]: boolean } = {};
  mobileProjekteFilialeId: string | null = null;
  
  openFilialenMobileFilterSheet(): void {
    this.filialenMobileColumns = [
       ...(this.filialenVisibleColumns ? this.filialenOrderedColumns.filter(col => this.filialenVisibleColumns[col.field] && col.field !== 'favorite') : this.filialenOrderedColumns.filter(c => c.field !== 'favorite'))
    ];
    this.filialenMobileFilterValues = { ...this.filialenColumnFilterValues };
    this.filialenMobileColumns.forEach(col => {
       const f = col.field;
       this.filialenMobileColumnOptions[f] = this.getUniqueValuesForFilialenColumn(f) as FilterOption[];
       this.filialenMobileCanFilterMap[f] = this.hasFilialenColumnData(f);
    });
    this.showMobileFilialenFiltersSheet = true;
  }

  onFilialenMobileFilterChanged(event: { field: string; values: string[] }): void {
     this.filialenColumnFilterValues[event.field] = event.values;
     this.filialenMobileFilterValues = {...this.filialenColumnFilterValues};
     this.onFilialenColumnFilterChange();
  }

  onFilialenMobileFilterCleared(): void {
     this.filialenColumnFilterValues = {};
     this.filialenMobileFilterValues = {};
     this.onFilialenColumnFilterChange();
  }

  openProjekteMobileFilterSheet(filiale: any): void {
    this.mobileProjekteFilialeId = filiale.id;
    this.selectedFilialeForFilter = filiale;
    this.projekteMobileColumns = [
       ...(this.projekteVisibleColumns ? this.projekteOrderedColumns.filter(col => this.projekteVisibleColumns[col.field] && col.field !== 'status') : this.projekteOrderedColumns.filter(c => c.field !== 'status'))
    ];
    const statusCol = this.projekteOrderedColumns.find(c => c.field === 'status');
    if (statusCol && (this.projekteVisibleColumns['status'] !== false)) {
        this.projekteMobileColumns.unshift(statusCol);
    }
    
    this.projekteMobileFilterValues = { ...this.projekteColumnFilterValues };
    this.projekteMobileColumns.forEach(col => {
       const f = col.field;
       this.projekteMobileColumnOptions[f] = this.getUniqueValuesForProjekteColumn(f) as FilterOption[];
       this.projekteMobileCanFilterMap[f] = this.hasProjekteColumnData(f, filiale);
    });
    this.showMobileProjekteFiltersSheet = true;
  }

  onProjekteMobileFilterChanged(event: { field: string; values: string[] }): void {
     this.projekteColumnFilterValues[event.field] = event.values;
     this.projekteMobileFilterValues = {...this.projekteColumnFilterValues};
     this.onProjekteColumnFilterChange();
  }

  onProjekteMobileFilterCleared(): void {
     this.projekteColumnFilterValues = {};
     this.projekteMobileFilterValues = {};
     this.onProjekteColumnFilterChange();
  }
`;

if (!content.includes('openFilialenMobileFilterSheet()')) {
  content = content.replace('showColumnFilterModal = false;', 'showColumnFilterModal = false;' + methodsToAdd);
}

fs.writeFileSync(file, content, 'utf8');
