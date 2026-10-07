import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class IconService {
  private iconCache = new Map<string, Observable<SafeHtml>>();

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
  ) {}

  getIcon(name: string): Observable<SafeHtml> {
    if (this.iconCache.has(name)) {
      return this.iconCache.get(name)!;
    }

    const icon$ = this.http.get(`/icons/${name}.svg`, { responseType: 'text' }).pipe(
      map((svg) => this.sanitizer.bypassSecurityTrustHtml(svg)),
      shareReplay(1),
      catchError(() => of(this.sanitizer.bypassSecurityTrustHtml(''))),
    );

    this.iconCache.set(name, icon$);
    return icon$;
  }
}
