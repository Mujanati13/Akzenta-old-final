import { Component, EventEmitter, OnInit, Output, OnDestroy } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { ClientService } from '@core/services/client.service';
import { filter, map, mergeMap, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false,
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() sidebarToggle = new EventEmitter<void>();

  currentClient: any = null;
  clientLogo: string | null = null;
  private clientSub: Subscription;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private clientService: ClientService,
  ) {}

  ngOnInit(): void {
    // Subscribe to client changes
    this.clientSub = this.clientService.getSelectedClient().subscribe((client) => {
      this.currentClient = client;
      this.clientLogo = client?.image || client?.logo?.path || null;
    });

    // On navigation, trigger fetch
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.getClientIdFromRoute(this.activatedRoute.root)),
      )
      .subscribe((clientId) => {
        if (clientId) {
          // Try to get from store, else fetch from backend
          const found = this.clientService.getClientById(clientId);
          if (!found) {
            this.clientService.fetchClientById(clientId).pipe(take(1)).subscribe();
          } else {
            // Ensure selected client is set
            this.clientService.getClientById(clientId);
          }
        } else {
          this.currentClient = null;
          this.clientLogo = null;
        }
      });
  }

  ngOnDestroy(): void {
    this.clientSub?.unsubscribe();
  }

  // Helper method to find clientId in the route tree
  private getClientIdFromRoute(route: ActivatedRoute): string | null {
    if (route.firstChild) {
      return this.getClientIdFromRoute(route.firstChild);
    }

    // Look for 'id' parameter (assuming your route is /clients/:id)
    if (route.snapshot.paramMap.has('id')) {
      return route.snapshot.paramMap.get('id');
    }

    // If you're using a different parameter name, update this accordingly
    if (route.snapshot.paramMap.has('clientId')) {
      return route.snapshot.paramMap.get('clientId');
    }

    return null;
  }

  private updateCurrentClient(clientId: string): void {
    this.currentClient = this.clientService.getClientById(clientId);
  }

  toggleSidebar(): void {
    this.sidebarToggle.emit();
  }
}
