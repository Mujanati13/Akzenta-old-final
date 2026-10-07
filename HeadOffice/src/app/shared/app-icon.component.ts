import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconService } from '../@core/services/icon.service';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-icon',
  template: ` <span [innerHTML]="svgIcon" [ngClass]="class || 'w-6 h-6'"></span> `,
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      span {
        display: inline-flex !important;
        line-height: 0;
      }
      :host ::ng-deep svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class AppIconComponent implements OnInit, OnChanges {
  @Input() name!: string;
  @Input() alt = 'icon';
  @Input() class = 'w-6 h-6';

  svgIcon: SafeHtml = '';

  constructor(
    private iconService: IconService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadIcon();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['name'] && !changes['name'].firstChange) {
      this.loadIcon();
    }
  }

  private loadIcon() {
    if (this.name) {
      this.iconService.getIcon(this.name).subscribe((icon) => {
        this.svgIcon = icon;
        this.cdr.markForCheck(); // Ensure view updates
      });
    }
  }
}
