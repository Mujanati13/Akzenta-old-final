import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '@env/environment';

export const devOnlyGuard: CanActivateFn = () => {
  if (environment.production) {
    inject(Router).navigate(['/dashboard']);
    return false;
  }

  return true;
};
