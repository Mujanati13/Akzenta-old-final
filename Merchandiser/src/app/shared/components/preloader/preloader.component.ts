import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-preloader',
  template: `
    <div class="preloader-container">
      <div class="spinner"></div>
      <div *ngIf="message" class="message">{{ message }}</div>
    </div>
  `,
  styles: [
    `
      .preloader-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }
      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        border-top-color: #3498db;
        animation: spin 1s ease-in-out infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .message {
        margin-top: 1rem;
        font-size: 16px;
        color: #333;
      }
    `,
  ],
  standalone: true,
  imports: [CommonModule],
})
export class PreloaderComponent {
  @Input() message: string = 'Loading...';
}
