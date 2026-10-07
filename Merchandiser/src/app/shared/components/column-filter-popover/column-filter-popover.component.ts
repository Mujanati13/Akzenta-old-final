import { Component, Input, Output, EventEmitter, ViewChild, ContentChild, TemplateRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Popover, PopoverModule } from 'primeng/popover';
import { ListboxModule } from 'primeng/listbox';

export interface FilterOption {
  label: string;
  value: any;
  color?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-column-filter-popover',
  standalone: true,
  imports: [CommonModule, FormsModule, PopoverModule, ListboxModule],
  templateUrl: './column-filter-popover.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnFilterPopoverComponent {
  @ViewChild('popover') popover!: Popover;
  @ContentChild('itemTemplate') itemTemplate!: TemplateRef<any>;

  @Input() title: string = 'Filter';
  @Input() options: any[] = [];
  @Input() selectedValues: any[] = [];
  @Input() optionLabel: string = 'label';
  @Input() optionValue: string | undefined = 'value';

  @Output() selectedValuesChange = new EventEmitter<any[]>();
  @Output() filterChange = new EventEmitter<any[]>();
  @Output() popoverHide = new EventEmitter<void>();

  show(event: Event): void {
    this.popover.show(event);
  }

  toggle(event: Event): void {
    this.popover.toggle(event);
  }

  hide(): void {
    this.popover.hide();
  }

  onListboxChange(): void {
    this.selectedValuesChange.emit(this.selectedValues);
    this.filterChange.emit(this.selectedValues);
  }

  clearFilter(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedValues = [];
    this.selectedValuesChange.emit(this.selectedValues);
    this.filterChange.emit(this.selectedValues);
  }
}
