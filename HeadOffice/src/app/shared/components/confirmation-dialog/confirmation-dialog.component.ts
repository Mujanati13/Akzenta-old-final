import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ImportsModule } from '@app/shared/imports';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, ImportsModule],
  templateUrl: './confirmation-dialog.component.html',
})
export class ConfirmationDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() title = 'Bestätigung';
  @Input() subtitle = 'Bestätigung';
  @Input() message = '';
  @Input() confirmLabel = 'Bestätigen';
  @Input() cancelLabel = 'Abbrechen';
  @Input() loading = false;
  @Input() danger = false;
  @Input() width = 'min(92vw, 520px)';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onDialogVisibilityChange(isVisible: boolean): void {
    this.visible = isVisible;
    this.visibleChange.emit(isVisible);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
