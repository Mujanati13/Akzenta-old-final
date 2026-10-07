import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { ClientService } from '@core/services/client.service';
import { filter, map, mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false,
})
export class HeaderComponent implements OnInit {
  @Output() sidebarToggle = new EventEmitter<void>();

  currentClient: any = null;
  clientLogo: string | null = null;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private clientService: ClientService,
  ) {}

  ngOnInit(): void {
    // Subscribe to router events to detect client routes
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.getClientSlugFromRoute(this.activatedRoute.root)),
      )
      .subscribe((clientSlug) => {
        if (clientSlug) {
          // Get client data from the service
          this.currentClient = this.clientService.getClientBySlug(clientSlug);
          this.clientLogo = this.currentClient?.image || null;
        } else {
          this.currentClient = null;
          this.clientLogo = null;
        }
      });
  }

  // Helper method to find clientSlug in the route tree
  private getClientSlugFromRoute(route: ActivatedRoute): string | null {
    if (route.firstChild) {
      return this.getClientSlugFromRoute(route.firstChild);
    }

    if (route.snapshot.paramMap.has('clientSlug')) {
      return route.snapshot.paramMap.get('clientSlug');
    }

    return null;
  }

  toggleSidebar(): void {
    this.sidebarToggle.emit();
  }
}
