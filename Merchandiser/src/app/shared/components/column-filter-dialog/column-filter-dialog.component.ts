import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-column-filter-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule],
  templateUrl: './column-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnFilterDialogComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() title: string = 'Filter';
  @Input() hasActiveFilter: boolean = false;

  @Output() filterCleared = new EventEmitter<void>();
  @Output() dialogHide = new EventEmitter<void>();

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onHide(): void {
    this.dialogHide.emit();
  }

  onClear(event: MouseEvent): void {
    event.stopPropagation();
    this.filterCleared.emit();
  }
}
