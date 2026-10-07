import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ImageItem {
  id: number;
  file?: File;
  preview?: string;
  fileName: string;
  label?: string; // New field for the label/name
}

@Component({
  selector: 'app-multi-image-upload',
  templateUrl: './multi-image-upload.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class MultiImageUploadComponent implements OnInit {
  @Input() count: number = 1; // Number of image upload rows
  @Input() label: string = '';
  @Input() containerWidth: string = 'w-[416px]';
  @Input() containerHeight: string = 'h-auto';
  @Input() imageLabels: string[] = []; // New input for predefined image names

  @Output() imagesChanged = new EventEmitter<ImageItem[]>();

  imageRows: ImageItem[] = [];

  ngOnInit() {
    // Initialize the requested number of image rows
    this.imageRows = Array(this.count)
      .fill(null)
      .map((_, i) => ({
        id: i,
        fileName: '',
        preview: null,
        label: this.imageLabels && this.imageLabels.length > i ? this.imageLabels[i] : `Bezeichnung ${i + 1}`,
      }));
  }

  onFileChange(event: any, index: number): void {
    const file = event.target.files[0];
    if (file) {
      // Update the specific row with the selected image
      const reader = new FileReader();
      reader.onload = () => {
        this.imageRows[index] = {
          ...this.imageRows[index],
          file: file,
          preview: reader.result as string,
          fileName: file.name,
        };
        this.emitChange();
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    // Clear the specific row but keep the label
    const currentLabel = this.imageRows[index].label;
    this.imageRows[index] = {
      ...this.imageRows[index],
      file: undefined,
      preview: null,
      fileName: '',
      label: currentLabel,
    };

    this.emitChange();
  }

  private emitChange(): void {
    // Emit all non-empty image rows
    this.imagesChanged.emit(this.imageRows.filter((row) => row.file));
  }
}
