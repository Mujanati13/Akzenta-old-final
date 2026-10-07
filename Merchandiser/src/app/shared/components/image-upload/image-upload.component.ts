import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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

  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileRemoved = new EventEmitter<void>();

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
        this.fileName = file.name;
        this.fileSelected.emit(file);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.imagePreview = null;
    this.fileName = '';
    this.fileRemoved.emit();
  }
}
