import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AppIconComponent } from '../../app-icon.component';
import { compressImageForUpload } from '@app/@core/utils/image-compress.util';
import { formatFileSize } from '../../constants/logo-upload.constants';

export interface ImageItem {
  id: number;
  file?: File;
  preview?: string;
  fileName: string;
  label?: string;
  isImage?: boolean; // New field to track if file is an image
  fileId?: number; // Add fileId for backend-stored files
  beforeAfterType?: 'before' | 'after';
  order?: number;
}

@Component({
  selector: 'app-multi-image-upload',
  templateUrl: './multi-image-upload.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, AppIconComponent],
})
export class MultiImageUploadComponent implements OnInit, OnChanges {
  @Input() count: number = 1;
  @Input() label: string = '';
  @Input() containerWidth: string = 'w-[416px]';
  @Input() containerHeight: string = 'h-auto';
  @Input() imageLabels: string[] = [];
  @Input() acceptFileTypes: string = 'image/*'; // New input property with default value
  @Input() prePopulatedImages: ImageItem[] = []; // New input for pre-populated images
  @Input() dropListId: string = '';
  @Input() connectedDropLists: string[] = [];
  @Input() listType: 'before' | 'after' | 'single' = 'single';
  /** Max file size in bytes; 0 disables client-side size check. */
  @Input() maxFileSizeBytes: number = 0;

  @Output() imagesChanged = new EventEmitter<ImageItem[]>();
  @Output() fileRejected = new EventEmitter<string>();
  @Output() fileDeleted = new EventEmitter<{ fileId: number; index: number }>();
  @Output() crossListDropped = new EventEmitter<{
    event: CdkDragDrop<ImageItem[]>;
    listType: 'before' | 'after' | 'single';
    dropListId: string;
  }>();

  imageRows: ImageItem[] = [];
  private baseLabels: string[] = [];
  private readonly processingIndices = new Set<number>();

  ngOnInit() {
    this.captureBaseLabels();
    this.initializeImageRows();
    this.applyLabelsToRows(false);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['imageLabels']) {
      this.captureBaseLabels();
    }
    if (changes['prePopulatedImages'] && !changes['prePopulatedImages'].isFirstChange()) {
      const prev = (changes['prePopulatedImages'].previousValue as ImageItem[]) || [];
      const curr = (changes['prePopulatedImages'].currentValue as ImageItem[]) || [];
      if (this.arePrePopulatedImagesEquivalent(prev, curr)) {
        return;
      }
      this.initializeImageRows();
    }
  }

  private arePrePopulatedImagesEquivalent(prev: ImageItem[], curr: ImageItem[]): boolean {
    if (prev.length !== curr.length) {
      return false;
    }

    return prev.every((item, index) => {
      const other = curr[index];
      return item.fileId === other.fileId && item.fileName === other.fileName && item.label === other.label && item.order === other.order && item.preview === other.preview && item.file === other.file;
    });
  }

  private isEmptyRow(row: ImageItem | undefined): boolean {
    return !row?.file && !row?.fileName && !row?.preview;
  }

  private initializeImageRows() {
    const previousRows = this.imageRows.map((row) => ({ ...row }));

    this.imageRows = Array(this.count)
      .fill(null)
      .map((_, i) => ({
        id: i,
        fileName: '',
        preview: null,
        label: this.imageLabels && this.imageLabels.length > i ? this.imageLabels[i] : `Bezeichnung ${i + 1}`,
        order: i,
      }));

    if (this.prePopulatedImages && this.prePopulatedImages.length > 0) {
      this.prePopulatedImages.forEach((image) => {
        let targetIndex = typeof image.order === 'number' ? image.order : -1;
        if (typeof image.fileId === 'number' && previousRows.length) {
          const previousIndex = previousRows.findIndex((row) => row.fileId === image.fileId);
          if (previousIndex >= 0 && previousIndex < this.count) {
            targetIndex = previousIndex;
          }
        }

        if (targetIndex < 0 || targetIndex >= this.count) {
          if (image.label) {
            targetIndex = this.imageRows.findIndex((row) => row.label === image.label && this.isEmptyRow(row));
          }
        }

        if (targetIndex < 0 || targetIndex >= this.count) {
          targetIndex = this.imageRows.findIndex((row) => this.isEmptyRow(row));
        }

        if (targetIndex >= 0 && targetIndex < this.count) {
          if (!this.isEmptyRow(this.imageRows[targetIndex])) {
            const freeFromPreferred = this.imageRows.findIndex((row, i) => i >= targetIndex && this.isEmptyRow(row));
            if (freeFromPreferred >= 0) {
              targetIndex = freeFromPreferred;
            } else {
              const anyFree = this.imageRows.findIndex((row) => this.isEmptyRow(row));
              if (anyFree < 0) {
                return;
              }
              targetIndex = anyFree;
            }
          }

          const labelToUse = image.label || this.imageRows[targetIndex].label;
          this.imageRows[targetIndex] = {
            ...image,
            label: labelToUse,
            order: targetIndex,
          };
        }
      });
    }

    this.restoreLocalInProgressRows(previousRows);
    this.normalizeEmptySlotLabels(previousRows);
  }

  private restoreLocalInProgressRows(previousRows: ImageItem[]): void {
    previousRows.forEach((row, index) => {
      if (index >= this.count) {
        return;
      }

      const isProcessing = this.processingIndices.has(index);
      const hasLocalUpload = !!row.file;
      if (!isProcessing && !hasLocalUpload) {
        return;
      }

      const current = this.imageRows[index];
      const currentHasContent = !this.isEmptyRow(current);
      if (isProcessing || !currentHasContent || (hasLocalUpload && !current.file)) {
        this.imageRows[index] = {
          ...row,
          label: row.label || current.label,
          order: index,
        };
      }
    });
  }

  private normalizeEmptySlotLabels(previousRows: ImageItem[]): void {
    const configuredLabels = Array.isArray(this.imageLabels) ? this.imageLabels : [];
    const usedLabels = new Set(
      this.imageRows
        .filter((row) => !!row.file || !!row.fileName)
        .map((row) => row.label)
        .filter((label): label is string => !!label),
    );

    this.imageRows.forEach((row, index) => {
      const isEmpty = this.isEmptyRow(row);
      if (!isEmpty) {
        return;
      }

      const previousLabelAtIndex = previousRows[index]?.label;
      if (previousLabelAtIndex && !usedLabels.has(previousLabelAtIndex)) {
        row.label = previousLabelAtIndex;
        usedLabels.add(previousLabelAtIndex);
      }
    });

    const missingConfiguredLabels = configuredLabels.filter((label) => !usedLabels.has(label));

    this.imageRows.forEach((row, index) => {
      const isEmpty = this.isEmptyRow(row);
      if (!isEmpty) {
        return;
      }

      if (missingConfiguredLabels.length) {
        row.label = missingConfiguredLabels.shift() || row.label;
        return;
      }

      row.label = row.label || configuredLabels[index] || `Bezeichnung ${index + 1}`;
    });
  }

  private captureBaseLabels(): void {
    this.baseLabels = Array.isArray(this.imageLabels) ? [...this.imageLabels] : [];
  }

  private applyLabelsToRows(emitChange: boolean): void {
    if (!this.baseLabels.length && Array.isArray(this.imageLabels) && this.imageLabels.length) {
      this.baseLabels = [...this.imageLabels];
    }

    this.imageRows.forEach((row, index) => {
      if (!row.label) {
        const newLabel = this.baseLabels[index] ?? `Bezeichnung ${index + 1}`;
        row.label = newLabel;
      }
      row.order = index;
    });

    if (emitChange) {
      this.emitChange();
    }
  }

  isProcessing(index: number): boolean {
    return this.processingIndices.has(index);
  }

  async onFileChange(event: Event, index: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (this.maxFileSizeBytes > 0 && file.size > this.maxFileSizeBytes) {
      const message = `Die Datei ist zu groß (${formatFileSize(file.size)}). Maximal ${formatFileSize(this.maxFileSizeBytes)} erlaubt.`;
      this.fileRejected.emit(message);
      input.value = '';
      return;
    }

    this.processingIndices.add(index);
    try {
      const processedFile = file.type.startsWith('image/') ? await compressImageForUpload(file) : file;
      const isImage = processedFile.type.startsWith('image/');

      const applyRow = (preview: string | null) => {
        this.imageRows[index] = {
          ...this.imageRows[index],
          file: processedFile,
          preview,
          fileName: processedFile.name,
          isImage,
          order: index,
        };
        this.emitChange();
      };

      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => applyRow(reader.result as string);
        reader.onerror = () => {
          this.fileRejected.emit('Die Datei konnte nicht gelesen werden. Bitte versuchen Sie es erneut.');
        };
        reader.readAsDataURL(processedFile);
      } else {
        applyRow(null);
      }
    } catch {
      this.fileRejected.emit('Die Datei konnte nicht verarbeitet werden. Bitte wählen Sie ein anderes Bild.');
    } finally {
      this.processingIndices.delete(index);
      input.value = '';
    }
  }

  removeImage(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const currentRow = this.imageRows[index];

    if (currentRow.fileId) {
      this.fileDeleted.emit({ fileId: currentRow.fileId, index });
      this.resetImageRow(index, false);
      return;
    }

    this.resetImageRow(index, true);
  }

  clearImageRow(index: number): void {
    this.resetImageRow(index, true);
  }

  private resetImageRow(index: number, emitChange: boolean): void {
    const currentLabel = this.imageRows[index].label;
    this.imageRows[index] = {
      ...this.imageRows[index],
      file: undefined,
      preview: null,
      fileName: '',
      label: currentLabel,
      isImage: undefined,
      fileId: undefined,
    };

    if (emitChange) {
      this.emitChange();
    }
  }

  onDrop(event: CdkDragDrop<ImageItem[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(this.imageRows, event.previousIndex, event.currentIndex);

      this.imageRows.forEach((row, index) => {
        row.order = index;
      });

      this.emitChange();
    } else {
      this.crossListDropped.emit({ event, listType: this.listType, dropListId: this.dropListId });
    }
  }

  trackByImageRow(index: number, row: ImageItem): string {
    if (typeof row?.fileId === 'number') {
      return `uploaded-${row.fileId}`;
    }
    if (row?.file) {
      return `local-${row.file.name}-${row.file.lastModified}-${index}`;
    }
    return `slot-${index}-${row?.label ?? ''}`;
  }

  private emitChange(): void {
    const toEmit = this.imageRows.filter((row) => row.file || row.fileName);
    this.imagesChanged.emit(toEmit);
  }
}
