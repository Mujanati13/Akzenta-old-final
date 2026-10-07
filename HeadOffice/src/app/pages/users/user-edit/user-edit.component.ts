import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { HotToastService } from '@ngxpert/hot-toast';
import { ClientCompanyService, ClientCompany, InfinityPaginationResponse } from '@app/core/services/client-company.service';
import { UsersService, User } from '@app/pages/users/services/users.service';
import { UsersListStateService } from '@app/pages/users/list/users-list-state.service';
import { Observable, forkJoin, of, timer, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, map, retry, switchMap, takeUntil, tap } from 'rxjs/operators';

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class UserEditComponent implements OnInit, OnDestroy {
  userForm: FormGroup;
  isSubmitting = false;
  userId: string;
  currentUser: User | null = null;
  userType: 'akzente' | 'client' | null = null;
  isLoading = true;
  selectedTab: number = 0; // Add this property

  // Gender options
  salutationOptions = [
    { code: 'male', name: 'Herr' },
    { code: 'female', name: 'Frau' },
    { code: 'other', name: 'Divers' },
  ];

  // Client Companies for assignment/favorites
  allClientCompanies: ClientCompany[] = [];
  isLoadingCompanies = false;
  userCompanies: number[] = []; // IDs of companies assigned to this user

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private usersService: UsersService,
    private clientCompanyService: ClientCompanyService,
    private toast: HotToastService,
    private usersListStateService: UsersListStateService,
  ) {}

  ngOnInit(): void {
    this.initializeForm();

    // Re-fetch whenever :id changes and cancel in-flight loads (same component instance is reused).
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        map((pm) => pm.get('id') ?? ''),
        distinctUntilChanged(),
        tap((id) => {
          if (!id) {
            this.toast.error('Benutzer-ID nicht gefunden');
            const queryParams = this.route.snapshot.queryParams;
            void this.router.navigate(['/users'], { queryParams });
          }
        }),
        filter((id) => !!id),
        switchMap((id) => {
          this.userId = id;
          return this.fetchUserAndCompanies$();
        }),
      )
      .subscribe({
        next: ({ user, companies }) => {
          if (user) {
            this.currentUser = user;
            this.determineUserType(user);
            this.populateForm(user);

            this.allClientCompanies = companies.data;
            this.loadUserCompanies(user);
            this.setupDynamicForm();
          } else {
            this.toast.error('Benutzer nicht gefunden');
            const queryParams = this.route.snapshot.queryParams;
            void this.router.navigate(['/users'], { queryParams });
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize the reactive form
   */
  private initializeForm(): void {
    this.userForm = this.fb.group({
      salutation: ['', Validators.required],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.minLength(8), Validators.maxLength(20)]],
      email: ['', [Validators.required, Validators.email]],
      isSales: [false],

      // Dynamic company assignments/favorites
      companies: this.fb.group({}),
    });
  }

  /**
   * Load user data and client companies (parallel). Used from route param stream.
   */
  private fetchUserAndCompanies$(): Observable<{
    user: User | null;
    companies: InfinityPaginationResponse<ClientCompany>;
  }> {
    this.isLoading = true;

    const userRequest$ = this.usersService.getUserById(this.userId).pipe(
      retry({
        count: 5,
        delay: (_error, retryCount) => timer(200 + retryCount * 250),
      }),
      catchError((error) => {
        console.error('❌ Error loading user data:', error);
        return of(null);
      }),
    );

    const companiesRequest$ = this.clientCompanyService.getAllClientCompaniesBasic().pipe(
      map((companies) => ({ data: companies, hasNextPage: false }) as InfinityPaginationResponse<ClientCompany>),
      catchError((error) => {
        console.error('❌ Error loading client companies:', error);
        return of({ data: [], hasNextPage: false } as InfinityPaginationResponse<ClientCompany>);
      }),
    );

    return forkJoin({
      user: userRequest$,
      companies: companiesRequest$,
    }).pipe(
      finalize(() => {
        this.isLoading = false;
      }),
    );
  }

  /**
   * Determine user type and set selected tab
   */
  private determineUserType(user: User): void {
    if (user.type?.name) {
      const typeName = user.type.name.toLowerCase();
      if (typeName === 'akzente') {
        this.userType = 'akzente';
        this.selectedTab = 0; // Set to Akzente tab
      } else if (typeName === 'client') {
        this.userType = 'client';
        this.selectedTab = 1; // Set to Client tab
      }
    }
  }

  /**
   * Handle tab change (optional - you might want to disable this for edit mode)
   */
  onTabChange(event: any): void {
    // In edit mode, you might want to prevent tab switching
    // since the user type is already determined
  }

  /**
   * Populate form with user data
   */
  private populateForm(user: User): void {
    this.userForm.patchValue({
      salutation: user.gender || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      email: user.email || '',
      isSales: user.isSales === true || user.isSale === true,
    });
  }

  /**
   * Load user's assigned companies based on user type
   */
  private loadUserCompanies(user: User): void {
    this.userCompanies = [];

    if (this.userType === 'client' && user.clientCompanies) {
      // Load client assignments from the user data
      this.userCompanies = user.clientCompanies.map((company) => company.id);
    } else if (this.userType === 'akzente' && user.clientCompanies) {
      // Load favorite companies from the user data
      this.userCompanies = user.clientCompanies.map((company) => company.id);
    }
  }

  /**
   * Setup form controls dynamically based on loaded companies
   */
  private setupDynamicForm(): void {
    const companiesGroup = this.userForm.get('companies') as FormGroup;

    // Clear existing controls
    Object.keys(companiesGroup.controls).forEach((key) => {
      companiesGroup.removeControl(key);
    });

    // Add controls for each company and set initial values
    this.allClientCompanies.forEach((company) => {
      const controlName = this.getControlName(company);
      const isAssigned = this.userCompanies.includes(company.id);
      companiesGroup.addControl(controlName, new FormControl(isAssigned));
    });
  }

  /**
   * Convert company name to a valid form control name
   */
  getControlName(company: ClientCompany): string {
    return `company_${company.id}`;
  }

  /**
   * Get company by control name
   */
  getCompanyByControlName(controlName: string): ClientCompany | undefined {
    return this.allClientCompanies.find((company) => this.getControlName(company) === controlName);
  }

  /**
   * Toggle company selection
   */
  toggleCompanySelection(controlName: string): void {
    const companyControl = this.userForm.get(`companies.${controlName}`);
    if (companyControl) {
      companyControl.setValue(!companyControl.value);
    }
  }

  /**
   * Check if company is selected
   */
  isCompanySelected(controlName: string): boolean {
    return this.userForm.get(`companies.${controlName}`)?.value || false;
  }

  /**
   * Get fallback image for companies without logos
   */
  getFallbackImage(): string {
    return 'images/placeholder.png';
  }

  /**
   * TrackBy function for client companies
   */
  trackByCompanyId(index: number, company: ClientCompany): number {
    return company.id;
  }

  /**
   * Get the companies section title based on user type
   */
  getCompaniesTitle(): string {
    return this.userType === 'akzente' ? 'Favoritisierte Kunden' : 'Zuordnung Kunden';
  }

  /**
   * Get the companies label based on user type
   */
  getCompaniesLabel(): string {
    return this.userType === 'akzente' ? 'favorisiertes Kundenunternehmen' : 'Kundenunternehmen';
  }

  /**
   * Check if form is valid for submission
   */
  isFormValidForSubmission(): boolean {
    const formValues = this.userForm.value;

    // Check if basic form is valid
    if (!this.userForm.valid) {
      return false;
    }

    // Check if at least one field has changed
    if (this.currentUser) {
      const hasChanges =
        formValues.firstName !== this.currentUser.firstName ||
        formValues.lastName !== this.currentUser.lastName ||
        formValues.email !== this.currentUser.email ||
        formValues.phone !== this.currentUser.phone ||
        formValues.gender !== this.currentUser.gender ||
        this.hasCompanyChanges();

      if (!hasChanges) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if company assignments have changed
   */
  private hasCompanyChanges(): boolean {
    const selectedCompanyIds = this.getSelectedCompanyIds();

    // Compare with current user's companies
    const currentCompanyIds = this.userCompanies.sort();
    const newCompanyIds = selectedCompanyIds.sort();

    return JSON.stringify(currentCompanyIds) !== JSON.stringify(newCompanyIds);
  }

  /**
   * Get selected company IDs
   */
  private getSelectedCompanyIds(): number[] {
    const selectedIds: number[] = [];
    const companies = this.userForm.get('companies')?.value || {};

    Object.keys(companies).forEach((controlName) => {
      if (companies[controlName]) {
        const company = this.getCompanyByControlName(controlName);
        if (company) {
          selectedIds.push(company.id);
        }
      }
    });

    return selectedIds;
  }

  /** Generate and email new password for this user (server-side generation, edit mode only). */
  generateNewPassword(): void {
    if (!this.currentUser) return;
    this.toast.info('Neues Passwort wird generiert und versendet...', {
      position: 'bottom-right',
      duration: 3000,
    });
    this.usersService.sendGeneratedPassword(this.currentUser.id).subscribe({
      next: () => {
        this.toast.success('Ein neues Passwort wurde generiert und per E-Mail an den Benutzer gesendet.');
      },
      error: (error) => {
        this.toast.error(this.getPasswordEmailErrorMessage(error));
      },
    });
  }

  /**
   * Submit form and update user
   */
  onSubmit(): void {
    if (!this.isFormValidForSubmission() || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    const formValues = this.userForm.value;

    // Create update payload - only include changed fields
    const updatePayload: any = {
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      phone: formValues.phone,
      gender: formValues.salutation, // Fix: use salutation instead of gender
    };

    // Only include email if it has changed
    if (formValues.email !== this.currentUser?.email) {
      updatePayload.email = formValues.email;
    }

    if (this.userType === 'client') {
      updatePayload.isSales = formValues.isSales || false;
    }

    // Include company assignments based on user type
    const selectedCompanyIds = this.getSelectedCompanyIds();
    if (this.hasCompanyChanges()) {
      if (this.userType === 'akzente') {
        updatePayload.clientCompanies = selectedCompanyIds.map((id) => ({ id }));
      } else if (this.userType === 'client') {
        updatePayload.clientCompanies = selectedCompanyIds.map((id) => ({ id }));
      }
    }

    const loadingToast = this.toast.loading('Benutzer wird aktualisiert...');

    this.usersService.updateUser(this.userId, updatePayload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        loadingToast.close();
        this.toast.success('Benutzer wurde erfolgreich aktualisiert');

        const updatedUser = response as User;
        this.usersListStateService.prefetchUsersData(this.usersService);

        // Update the user companies list for future comparisons
        this.userCompanies = selectedCompanyIds;

        // Update currentUser with the response to reflect changes
        if (updatedUser) {
          this.currentUser = updatedUser;
          this.populateForm(updatedUser);
        }

        // User stays on the current page - they can navigate back using the back icon
      },
      error: (error) => {
        this.isSubmitting = false;
        loadingToast.close();
        const errorMessage = this.getErrorMessage(error);
        this.toast.error(errorMessage);
      },
    });
  }

  /**
   * Update company assignments based on user type
   */
  private updateCompanyAssignments(selectedCompanyIds: number[]): void {
    if (this.userType === 'client') {
      // TODO: Update client assignments
      // this.clientAssignmentService.updateClientAssignments(userId, selectedCompanyIds)
    } else if (this.userType === 'akzente') {
      // TODO: Update favorite companies
      // this.favoriteClientCompaniesService.updateFavorites(userId, selectedCompanyIds)
    }
  }

  private getPasswordEmailErrorMessage(error: any): string {
    if (error?.status === 401) {
      return 'Sie haben keine Berechtigung, Passwörter zurückzusetzen.';
    }

    const userError = error?.data?.errors?.user || error?.error?.errors?.user;
    if (userError === 'unauthorizedUserType') {
      return 'Nur Akzente-Benutzer können Passwörter zurücksetzen.';
    }

    const emailError = error?.data?.errors?.email || error?.error?.errors?.email;
    if (emailError === 'emailDeliveryFailed') {
      return 'Das neue Passwort konnte nicht per E-Mail versendet werden. Bitte prüfen Sie die Mail-Einstellungen (MAIL_HOST, MAIL_PORT) oder versuchen Sie es später erneut.';
    }
    if (emailError === 'emailMissing') {
      return 'Für diesen Benutzer ist keine E-Mail-Adresse hinterlegt. Das Passwort konnte nicht versendet werden.';
    }
    return 'Fehler beim Versenden des neuen Passworts.';
  }

  /**
   * Extract user-friendly error message from error response
   */
  private getErrorMessage(error: any): string {
    const errors = error?.data?.errors || error?.error?.errors;
    if (error?.status === 422 && errors) {
      if (errors.email === 'emailAlreadyExists') {
        return 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet.';
      }

      // Handle other validation errors
      const errorMessages: string[] = [];
      for (const field in errors) {
        if (errors.hasOwnProperty(field)) {
          switch (errors[field]) {
            case 'emailAlreadyExists':
              errorMessages.push('Diese E-Mail-Adresse wird bereits verwendet.');
              break;
            case 'isEmail':
              errorMessages.push('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
              break;
            case 'minLength':
              errorMessages.push('Das Passwort muss mindestens 6 Zeichen lang sein.');
              break;
            case 'emailDeliveryFailed':
              errorMessages.push('Das neue Passwort konnte nicht versendet werden. Die angegebene E-Mail-Adresse existiert nicht oder ist nicht erreichbar.');
              break;
            case 'emailMissing':
              errorMessages.push('Für diesen Benutzer ist keine E-Mail-Adresse hinterlegt. Das Passwort konnte nicht versendet werden.');
              break;
            default:
              errorMessages.push(`${field}: ${errors[field]}`);
          }
        }
      }

      return errorMessages.join(' ');
    }

    // Default error handling
    if (error?.data?.message) {
      return error.data.message;
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.message) {
      return error.message;
    }

    return 'Ein Fehler ist beim Aktualisieren des Benutzers aufgetreten. Bitte versuchen Sie es erneut.';
  }

  /**
   * Cancel and navigate back
   */
  cancel(): void {
    // Preserve filter state when navigating back
    const queryParams = this.route.snapshot.queryParams;
    this.router.navigate(['/users'], { queryParams });
  }

  /**
   * Check if form field has error
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get field error message
   */
  getFieldError(fieldName: string): string {
    const control = this.userForm.get(fieldName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return 'Dieses Feld ist erforderlich';
      }
      if (control.errors['email']) {
        return 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
      }
      if (control.errors['minlength']) {
        return `Mindestens ${control.errors['minlength'].requiredLength} Zeichen erforderlich`;
      }
    }

    return '';
  }
}
