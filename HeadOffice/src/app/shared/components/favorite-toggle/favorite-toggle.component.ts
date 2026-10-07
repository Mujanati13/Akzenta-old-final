import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../app-icon.component';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-favorite-toggle',
  standalone: true,
  imports: [CommonModule, AppIconComponent, PopoverModule, ButtonModule],
  template: `
    <span #iconWrapper>
      <app-icon [name]="isFavorite ? 'favorite_filled' : 'favorite'" [class]="iconSize + ' cursor-pointer'" [ngClass]="getColorClass()" (click)="toggleFavorite($event)" />
      <p-popover #popover appendTo="body" [style]="{ width: '280px', 'max-width': 'calc(100vw - 2rem)' }">
        <div class="overflow-hidden rounded-xl bg-white">
          <div class="px-3 pt-3 pb-2 border-b border-gray-100">
            <div class="flex items-start gap-3">
              <div class="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white inline-flex items-center justify-center shadow-sm">
                <i class="pi pi-exclamation-triangle text-sm"></i>
              </div>
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-500">Bestätigung</p>
                <p class="text-xs font-semibold text-gray-900 leading-tight mt-0.5">Favorit entfernen?</p>
              </div>
            </div>
          </div>
          <div class="px-3 py-2">
            <p class="text-xs text-gray-600 leading-relaxed">Sind Sie sicher, dass Sie diesen Favoriten entfernen möchten?</p>
          </div>
          <div class="px-3 py-2 border-t border-gray-100 bg-gray-50/70 flex justify-end gap-2">
            <button
              type="button"
              class="px-2.5 py-1 text-[11px] font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
              (click)="popover.hide()"
            >
              Abbrechen
            </button>
            <button type="button" class="px-2.5 py-1 text-[11px] font-semibold bg-red-500 text-white rounded-md hover:bg-red-600 cursor-pointer transition-colors shadow-sm" (click)="confirmRemove()">
              Entfernen
            </button>
          </div>
        </div>
      </p-popover>
    </span>
  `,
})
export class FavoriteToggleComponent {
  static activePopover: any = null;

  @Input() isFavorite: boolean = false;
  @Input() activeColor: string = 'yellow-400'; // Default is yellow
  @Input() inactiveColor: string = 'primary-500'; // Default is primary-500
  @Input() iconSize: string = 'h-5 w-5'; // Default size
  @Output() favoriteChange = new EventEmitter<boolean>();

  @ViewChild('iconWrapper', { static: true }) iconWrapperRef!: ElementRef;
  @ViewChild('popover') popover: any;

  // This method ensures proper class application based on status
  getColorClass(): any {
    // Create an object that will be directly used by ngClass
    const classObj: any = {};

    if (this.isFavorite) {
      // Explicitly set the class to ensure Tailwind doesn't purge it
      classObj[`text-${this.activeColor}`] = true;

      // Safeguard for default yellow in case it's still not applied
      if (this.activeColor === 'yellow-400') {
        classObj['text-yellow-400'] = true;
      }
    } else {
      classObj[`text-${this.inactiveColor}`] = true;

      // Safeguard for primary color
      if (this.inactiveColor === 'primary-500') {
        classObj['text-primary-500'] = true;
      }
    }

    return classObj;
  }

  toggleFavorite(event: Event): void {
    if (this.isFavorite) {
      if (FavoriteToggleComponent.activePopover && FavoriteToggleComponent.activePopover !== this.popover) {
        FavoriteToggleComponent.activePopover.hide();
      }

      // Show popover for confirmation when trying to remove a favorite
      this.popover.toggle(event);
      FavoriteToggleComponent.activePopover = this.popover;
    } else {
      // Add to favorites directly without confirmation
      this.isFavorite = true;
      this.favoriteChange.emit(this.isFavorite);
    }
  }

  confirmRemove(): void {
    // Handle the confirmation action
    this.isFavorite = false;
    this.favoriteChange.emit(this.isFavorite);
    this.popover.hide(); // Hide the popover after action
    FavoriteToggleComponent.activePopover = null;
  }
}
