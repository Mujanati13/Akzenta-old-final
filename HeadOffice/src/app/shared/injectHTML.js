const fs = require('fs');
const file = 'HeadOffice/src/app/pages/filiale-suchen/filiale-suchen.component.html';
const content = fs.readFileSync(file, 'utf8');

let newContent = content.replace(
  '(click)="openColumnFilterMobile(\\'name\\', $event)"',
  '(click)="openFilialenMobileFilterSheet()"'
);
newContent = newContent.replace(
  '(click)="openColumnFilterMobile(col.field, $event)"',
  '(click)="openFilialenMobileFilterSheet()"'
);

newContent = newContent.replace(
  '(click)="openProjekteColumnFilterMobile(\\'name\\', filiale, $event)"',
  '(click)="openProjekteMobileFilterSheet(filiale)"'
);
newContent = newContent.replace(
  '(click)="openProjekteColumnFilterMobile(col.field, filiale, $event)"',
  '(click)="openProjekteMobileFilterSheet(filiale)"'
);

// We should append the components at the end
if (!newContent.includes('app-mobile-filter-bottom-sheet')) {
  newContent += `
<app-mobile-filter-bottom-sheet
  [(visible)]="showMobileFilialenFiltersSheet"
  title="{{ 'FILIALE_SUCHEN.FILTERS_TITLE' | translate | default: 'Filialen Filter' }}"
  [columns]="filialenMobileColumns"
  [filterValues]="filialenMobileFilterValues"
  [columnOptions]="filialenMobileColumnOptions"
  [canFilterMap]="filialenMobileCanFilterMap"
  (filtersChanged)="onFilialenMobileFilterChanged($event)"
  (allFiltersCleared)="onFilialenMobileFilterCleared()"
>
</app-mobile-filter-bottom-sheet>

<app-mobile-filter-bottom-sheet
  [(visible)]="showMobileProjekteFiltersSheet"
  title="{{ 'FILIALE_SUCHEN.PROJEKT_FILTERS_TITLE' | translate | default: 'Projekt-Filter' }}"
  [columns]="projekteMobileColumns"
  [filterValues]="projekteMobileFilterValues"
  [columnOptions]="projekteMobileColumnOptions"
  [canFilterMap]="projekteMobileCanFilterMap"
  (filtersChanged)="onProjekteMobileFilterChanged($event)"
  (allFiltersCleared)="onProjekteMobileFilterCleared()"
>
</app-mobile-filter-bottom-sheet>
`;
}
fs.writeFileSync(file, newContent, 'utf8');
