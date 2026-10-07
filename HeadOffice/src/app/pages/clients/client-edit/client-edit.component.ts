import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { ClientCompanyService, ClientCompany } from '@app/core/services/client-company.service';
import { User } from '@app/pages/users/services/users.service';
import { ImageItem } from '@app/shared/components/multi-image-upload/multi-image-upload.component';
import { ClientService } from '@app/@core/services/client.service';
import { EMPTY, Subject, throwError, timer, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, mergeMap, retry, switchMap, takeUntil } from 'rxjs/operators';
import { CLIENT_LOGO_MAX_FILE_SIZE_BYTES, CLIENT_LOGO_MAX_FILE_SIZE_LABEL, getLogoFileTooLargeMessage } from '@app/shared/constants/logo-upload.constants';

@Component({
  selector: 'app-client-edit',
  templateUrl: './client-edit.component.html',
  styleUrls: ['./client-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ClientEditComponent implements OnInit, OnDestroy {
  clientForm: FormGroup;
  managerControl = new FormControl('');
  selectedImages: ImageItem[] = [];
  isSubmitting = false;
  isLoading = true;
  logoPreview: string | null = null;
  fileName: string = '';
  selectedLogoFile: File | null = null;
  clientId: number | null = null;
  currentClientCompany: ClientCompany | null = null;

  filteredContacts: string[] = [];
  contactValue: string[] = [];
  allContacts: string[] = [];
  clientUsers: User[] = [];

  selectedManagers: string[] = [];
  filteredManagers: string[] = [];
  allManagers: string[] = [];
  akzenteUsers: User[] = [];

  selectedContactUserIds: number[] = [];
  selectedManagerUserIds: number[] = [];

  private logoChanged = false;
  private readonly destroy$ = new Subject<void>();

  private formatUserName(user: User | any): string {
    const firstName = (user?.firstName ?? '').toString().trim();
    const lastName = (user?.lastName ?? '').toString().trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      return fullName;
    }
    const email = (user?.email ?? '').toString().trim();
    if (email) {
      return email;
    }
    const id = user?.id ?? user?.user?.id ?? '';
    return id ? `User #${id}` : 'Unbekannter Benutzer';
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private clientCompanyService: ClientCompanyService,
    private clientService: ClientService,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initializeForm();

    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        // First emission can run before child route params are bound; debounce lets the router settle.
        debounceTime(0),
        map((pm) => this.resolveClientIdFromParamMap(pm)),
        filter((clientId): clientId is number => clientId !== null),
        distinctUntilChanged(),
        switchMap((clientId) => {
          this.clientId = clientId;
          this.resetStateForNewClientRoute();
          this.isLoading = true;

          return this.clientCompanyService.getClientCompanyWithRelationships(clientId).pipe(
            mergeMap((response) => {
              const normalized = this.normalizeDetailResponse(response);
              if (this.isUsableClientPayload(normalized, clientId)) {
                return of(normalized);
              }
              return throwError(() => Object.assign(new Error('Client company payload not ready'), { status: 404 }));
            }),
            retry({
              count: 10,
              delay: (_err, retryCount) => timer(250 + retryCount * 200),
            }),
            catchError((error) => {
              console.error('❌ Error loading client company:', error);
              this.toast.error('Fehler beim Laden der Kundendaten', {
                position: 'bottom-right',
                duration: 5000,
              });
              // Only leave the screen when the company truly does not exist — not on transient or client-side issues.
              const status = (error as any)?.status ?? (error as any)?.statusCode;
              if (status === 404) {
                const queryParams = this.route.snapshot.queryParams;
                void this.router.navigate(['/clients/list'], { queryParams });
              }
              return EMPTY;
            }),
            finalize(() => {
              this.isLoading = false;
            }),
          );
        }),
      )
      .subscribe({
        next: (result) => {
          const normalized = this.normalizeDetailResponse(result);
          if (!normalized?.clientCompany) {
            this.toast.error('Kundendaten konnten nicht geladen werden', {
              position: 'bottom-right',
              duration: 5000,
            });
            return;
          }
          try {
            this.currentClientCompany = normalized.clientCompany;
            this.prefillClientData(normalized.clientCompany);
            this.processUsersAndRelationships(normalized);
            this.cdr.markForCheck();
          } catch (e) {
            console.error('❌ Failed to bind client company to form:', e);
            this.toast.error('Fehler beim Anzeigen der Kundendaten', {
              position: 'bottom-right',
              duration: 5000,
            });
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resolveClientIdFromParamMap(pm: ParamMap): number | null {
    const tryMap = (m: ParamMap): number | null => {
      const keys = m.keys;
      const raw = m.get('clientId') ?? m.get('id') ?? (keys.length === 1 ? m.get(keys[0]) : null);

      if (!raw) {
        return null;
      }

      const n = Number(raw);
      return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
    };

    const fromLeaf = tryMap(pm);
    if (fromLeaf !== null) {
      return fromLeaf;
    }

    // Lazy-loaded setups sometimes expose matrix params on a parent snapshot first.
    let parent: ActivatedRoute | null = this.route.parent;
    while (parent) {
      const fromParent = tryMap(parent.snapshot.paramMap);
      if (fromParent !== null) {
        return fromParent;
      }
      parent = parent.parent;
    }

    return null;
  }

  /**
   * Some gateways or older clients wrap the payload; keep a single shape for the rest of the component.
   */
  private normalizeDetailResponse(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }
    if (body.clientCompany) {
      return body;
    }
    const inner = body.data;
    if (inner && typeof inner === 'object' && inner.clientCompany) {
      return {
        ...body,
        ...inner,
        clientCompany: inner.clientCompany,
        allUsers: inner.allUsers ?? body.allUsers,
        clientAssignments: inner.clientAssignments ?? body.clientAssignments,
        clientCompanyAssignedAkzente: inner.clientCompanyAssignedAkzente ?? body.clientCompanyAssignedAkzente,
      };
    }
    return body;
  }

  /** Accept payload when company exists and id matches route (loose number/string compare). */
  private isUsableClientPayload(response: any, expectedRouteId: number): boolean {
    const company = response?.clientCompany;
    if (!company || typeof company !== 'object') {
      return false;
    }
    const rid = company.id;
    if (rid === undefined || rid === null) {
      return typeof company.name === 'string';
    }
    return Number(rid) === Number(expectedRouteId) || String(rid) === String(expectedRouteId);
  }

  private resetStateForNewClientRoute(): void {
    this.currentClientCompany = null;
    this.logoPreview = null;
    this.fileName = '';
    this.selectedLogoFile = null;
    this.logoChanged = false;
    this.contactValue = [];
    this.selectedContactUserIds = [];
    this.selectedManagers = [];
    this.selectedManagerUserIds = [];
    this.clientUsers = [];
    this.akzenteUsers = [];
    this.allContacts = [];
    this.filteredContacts = [];
    this.allManagers = [];
    this.filteredManagers = [];
    this.initializeForm();
  }

  private initializeForm(): void {
    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      image: [''],
      contacts: [[]],
      managers: [[]],
    });
  }

  private reloadCurrentClient(): void {
    if (!this.clientId) {
      return;
    }

    this.isLoading = true;
    this.clientCompanyService
      .getClientCompanyWithRelationships(this.clientId)
      .pipe(
        mergeMap((response) => {
          const normalized = this.normalizeDetailResponse(response);
          if (this.isUsableClientPayload(normalized, this.clientId!)) {
            return of(normalized);
          }
          return throwError(() => Object.assign(new Error('Client company payload not ready'), { status: 404 }));
        }),
        retry({
          count: 10,
          delay: (_err, retryCount) => timer(250 + retryCount * 200),
        }),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (result) => {
          const normalized = this.normalizeDetailResponse(result);
          if (!normalized?.clientCompany) {
            return;
          }
          try {
            this.currentClientCompany = normalized.clientCompany;
            this.prefillClientData(normalized.clientCompany);
            this.processUsersAndRelationships(normalized);
            this.cdr.markForCheck();
          } catch (e) {
            console.error('❌ Failed to bind client company to form:', e);
          }
        },
        error: (error) => {
          console.error('❌ Error loading client company:', error);
          this.toast.error('Fehler beim Laden der Kundendaten', {
            position: 'bottom-right',
            duration: 5000,
          });
          const status = (error as any)?.status ?? (error as any)?.statusCode;
          if (status === 404) {
            const queryParams = this.route.snapshot.queryParams;
            void this.router.navigate(['/clients/list'], { queryParams });
          }
        },
      });
  }

  /** Backend returns `{ data: User[] }` or, in some paths, a bare array. */
  private userArrayFromAllUsers(allUsers: any, key: 'clientUsers' | 'akzenteUsers'): User[] {
    const bucket = allUsers?.[key];
    if (Array.isArray(bucket)) {
      return bucket as User[];
    }
    const data = bucket?.data;
    return Array.isArray(data) ? (data as User[]) : [];
  }

  private processUsersAndRelationships(result: any): void {
    const clientUsersData = this.userArrayFromAllUsers(result?.allUsers, 'clientUsers');
    const akzenteUsersData = this.userArrayFromAllUsers(result?.allUsers, 'akzenteUsers');

    this.clientUsers = clientUsersData;
    this.akzenteUsers = akzenteUsersData;

    this.allContacts = this.clientUsers.map((user) => this.formatUserName(user));
    this.filteredContacts = [...this.allContacts];
    this.allManagers = this.akzenteUsers.map((user) => this.formatUserName(user));
    this.filteredManagers = [...this.allManagers];

    this.populateExistingRelationships(result.clientAssignments, result.clientCompanyAssignedAkzente);
  }

  private populateExistingRelationships(clientAssignments: any[], clientCompanyAssignedAkzente: any[]): void {
    const assignments = Array.isArray(clientAssignments) ? clientAssignments : clientAssignments ? Object.values(clientAssignments) : [];
    const favorites = Array.isArray(clientCompanyAssignedAkzente) ? clientCompanyAssignedAkzente : clientCompanyAssignedAkzente ? Object.values(clientCompanyAssignedAkzente) : [];

    const contactsFromAssignments = assignments
      .map((assignment: any) => {
        const id = assignment?.client?.user?.id;
        if (typeof id !== 'number') {
          return null;
        }
        return { id, name: this.formatUserName(assignment?.client?.user) };
      })
      .filter((row): row is { id: number; name: string } => row !== null);
    this.selectedContactUserIds = contactsFromAssignments.map((c) => c.id);
    this.contactValue = contactsFromAssignments.map((c) => c.name);

    const managersFromFavorites = favorites
      .map((favorite: any) => {
        const id = favorite?.akzente?.user?.id;
        if (typeof id !== 'number') {
          return null;
        }
        return { id, name: this.formatUserName(favorite?.akzente?.user) };
      })
      .filter((row): row is { id: number; name: string } => row !== null);
    this.selectedManagerUserIds = managersFromFavorites.map((m) => m.id);
    this.selectedManagers = managersFromFavorites.map((m) => m.name);

    this.clientForm.patchValue({
      contacts: this.contactValue,
      managers: this.selectedManagers,
    });
  }

  private prefillClientData(clientCompany: ClientCompany): void {
    if (!clientCompany) {
      return;
    }
    this.clientForm.patchValue({
      name: clientCompany.name,
    });

    if (clientCompany.logo) {
      this.logoPreview = clientCompany.logo.path;
      this.fileName = 'Aktuelles Logo';
    }
  }

  onImageSelected(file: File): void {
    if (!this.isValidLogoFile(file)) {
      return;
    }

    this.selectedLogoFile = file;
    this.fileName = file.name;
    this.logoChanged = true;

    this.clientForm.patchValue({
      image: file,
    });

    this.toast.success(`Logo "${file.name}" ausgewählt`, {
      position: 'bottom-right',
      duration: 2000,
    });
  }

  onLogoFileRejected(message: string): void {
    this.toast.error(message, {
      position: 'bottom-right',
      duration: 5000,
    });
  }

  private isValidLogoFile(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      this.toast.error('Ungültiges Dateiformat. Nur Bilddateien sind für das Logo erlaubt.', {
        position: 'bottom-right',
        duration: 4500,
      });
      return false;
    }

    if (file.size > CLIENT_LOGO_MAX_FILE_SIZE_BYTES) {
      this.toast.error(getLogoFileTooLargeMessage(file.size), {
        position: 'bottom-right',
        duration: 5000,
      });
      return false;
    }

    return true;
  }

  onImageRemoved(): void {
    this.selectedLogoFile = null;
    this.logoPreview = null;
    this.fileName = '';
    this.logoChanged = true;

    this.clientForm.patchValue({
      image: '',
    });

    this.toast.info('Logo entfernt', {
      position: 'bottom-right',
      duration: 2000,
    });
  }

  onContactsChanged(): void {
    this.selectedContactUserIds = this.contactValue
      .map((contactName) => {
        const user = this.clientUsers.find((u) => this.formatUserName(u) === contactName);
        return user ? user.id : null;
      })
      .filter((id): id is number => id !== null);

    this.clientForm.patchValue({
      contacts: this.contactValue,
    });
  }

  onManagersChanged(): void {
    this.selectedManagerUserIds = this.selectedManagers
      .map((managerName) => {
        const user = this.akzenteUsers.find((u) => this.formatUserName(u) === managerName);
        return user ? user.id : null;
      })
      .filter((id): id is number => id !== null);

    this.clientForm.patchValue({
      managers: this.selectedManagers,
    });
  }

  onSubmit(): void {
    if (this.clientForm.invalid || this.isSubmitting || !this.clientId) {
      if (this.clientForm.invalid) {
        this.toast.error('Bitte füllen Sie alle erforderlichen Felder aus', {
          position: 'bottom-right',
          duration: 3000,
        });
      }
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    formData.append('name', this.clientForm.get('name')?.value);

    if (this.logoChanged && this.selectedLogoFile) {
      formData.append('logo', this.selectedLogoFile);
    }

    formData.append('contactIds', JSON.stringify(this.selectedContactUserIds));
    formData.append('managerIds', JSON.stringify(this.selectedManagerUserIds));

    this.clientCompanyService
      .updateClientCompanyWithRelationships(this.clientId, formData)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        }),
      )
      .subscribe({
        next: (updatedClient) => {
          this.clientService.updateClientSidebarEntry({
            id: this.clientId,
            name: this.clientForm.get('name')?.value ?? updatedClient?.name,
            logo: updatedClient?.logo,
          });
          this.toast.success('Kunde wurde erfolgreich aktualisiert!', {
            position: 'bottom-right',
            duration: 4000,
            icon: '✅',
          });
          this.logoChanged = false;
          this.reloadCurrentClient();
        },
        error: (error) => {
          console.error('❌ Error updating client company:', error);
          this.toast.error(this.getErrorMessage(error), {
            position: 'bottom-right',
            duration: 5000,
            icon: '❌',
          });
        },
      });
  }

  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.status === 400) {
      return 'Ungültige Eingabedaten. Bitte überprüfen Sie Ihre Eingaben.';
    }

    if (error?.status === 404) {
      return 'Kunde nicht gefunden.';
    }

    if (error?.status === 413) {
      return error?.error?.message || `Das Logo darf maximal ${CLIENT_LOGO_MAX_FILE_SIZE_LABEL} groß sein. Bitte wählen Sie eine kleinere Datei.`;
    }

    if (error?.status === 415) {
      return 'Ungültiges Dateiformat. Nur Bilddateien sind für das Logo erlaubt.';
    }

    if (error?.status === 500) {
      return 'Serverfehler. Bitte versuchen Sie es später erneut.';
    }

    return 'Ein unbekannter Fehler ist aufgetreten beim Aktualisieren des Kunden.';
  }

  cancel(): void {
    this.toast.info('Vorgang abgebrochen', {
      position: 'bottom-right',
      duration: 2000,
    });

    const referrer = this.route.snapshot.queryParamMap.get('referrer');
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['referrer'];

    if (referrer === 'dashboard') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/clients/list'], { queryParams });
    }
  }

  searchContacts(event: any) {
    const query = event.query.toLowerCase();
    this.filteredContacts = this.allContacts.filter((contact) => contact.toLowerCase().includes(query));
  }

  addCustomContact() {
    this.router.navigate(['users/contact/add', this.clientId]);
  }

  searchManagers(event: any) {
    const query = event.query.toLowerCase();
    this.filteredManagers = this.allManagers.filter((manager) => manager.toLowerCase().includes(query));
  }

  addCustomManager() {
    const managerName = this.managerControl.value?.trim();
    if (managerName && !this.selectedManagers.includes(managerName)) {
      this.selectedManagers.push(managerName);

      if (!this.allManagers.includes(managerName)) {
        this.allManagers.push(managerName);
      }

      this.clientForm.patchValue({
        managers: this.selectedManagers,
      });
      this.managerControl.setValue('');

      this.toast.success(`Projektleiter "${managerName}" hinzugefügt`, {
        position: 'bottom-right',
        duration: 2000,
      });
    }
  }

  removeManager(manager: string): void {
    this.selectedManagers = this.selectedManagers.filter((m) => m !== manager);
    this.clientForm.patchValue({
      managers: this.selectedManagers,
    });

    this.toast.info(`Projektleiter "${manager}" entfernt`, {
      position: 'bottom-right',
      duration: 2000,
    });
  }
}
