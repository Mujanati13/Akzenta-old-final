import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppIconComponent } from '@app/shared/app-icon.component';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div class="flex items-center justify-center min-h-[80vh] p-6">
      <div class="w-full max-w-lg p-10 bg-white rounded-xl border border-gray-100 shadow-md relative overflow-hidden">
        <!-- Subtle decorative elements -->
        <div class="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
        <div class="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-red-600/5"></div>
        <div class="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-red-600/5"></div>

        <div class="mb-8 relative">
          <div class="absolute inset-0 bg-red-600/10 rounded-full transform scale-150 blur-xl"></div>
        </div>

        <h1 class="mb-6 text-3xl font-bold text-gray-800 text-center">Zugriff verweigert</h1>
        <div class="w-16 h-1 mx-auto mb-8 rounded-full bg-red-600 opacity-80"></div>

        <p class="mb-10 text-gray-600 text-lg text-center">Sie haben nicht die erforderlichen Berechtigungen, um auf diese Seite zuzugreifen.</p>

        <div class="flex justify-center">
          <button
            (click)="goBack()"
            class="px-8 py-3 font-medium text-white rounded-lg bg-red-600 hover:bg-red-600/90 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transform transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg cursor-pointer"
          >
            <span class="flex items-center justify-center gap-2">
              <app-icon name="dashboard" class="w-5 h-5"></app-icon>
              Zurück zum Dashboard
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
  imports: [AppIconComponent],
  standalone: true,
})
export class UnauthorizedComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
