import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CLIENT_LOGO_MAX_FILE_SIZE_BYTES, CLIENT_LOGO_MAX_FILE_SIZE_LABEL, getLogoFileTooLargeMessage } from '@app/shared/constants/logo-upload.constants';

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class ImageUploadComponent {
  @Input() label: string = 'Upload Image';
  @Input() imagePreview: string | null = null;
  @Input() fileName: string = '';
  @Input() containerWidth: string = 'w-[339px]';
  @Input() imageHeight: string = 'h-[72px]';
  @Input() thumbnailSize: string = 'w-[76px] h-[56px]';
  @Input() maxFileSizeBytes: number = CLIENT_LOGO_MAX_FILE_SIZE_BYTES;
  @Input() maxFileSizeHint: string = CLIENT_LOGO_MAX_FILE_SIZE_LABEL;

  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileRemoved = new EventEmitter<void>();
  @Output() fileRejected = new EventEmitter<string>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  validationError: string | null = null;

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.validationError = null;

    if (this.maxFileSizeBytes > 0 && file.size > this.maxFileSizeBytes) {
      const message = getLogoFileTooLargeMessage(file.size);
      this.validationError = message;
      this.fileRejected.emit(message);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.fileName = file.name;
      this.fileSelected.emit(file);
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.validationError = null;
    this.imagePreview = null;
    this.fileName = '';
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    this.fileRemoved.emit();
  }
}
