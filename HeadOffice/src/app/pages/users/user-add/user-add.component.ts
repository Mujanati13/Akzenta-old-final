import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { ClientCompanyService, ClientCompany, InfinityPaginationResponse } from '@app/core/services/client-company.service';
import { ClientService, CreateClientDto, CreateAkzenteDto } from '@app/core/services/client.service';
import { finalize, catchError, of } from 'rxjs';

@Component({
  selector: 'app-user-add',
  templateUrl: './user-add.component.html',
  styleUrls: ['./user-add.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class UserAddComponent implements OnInit {
  userForm: FormGroup;
  isSubmitting = false;
  selectedTab: number = 0; // Track which tab is selected

  // Gender options
  genderOptions = [
    { code: 'male', name: 'Herr' },
    { code: 'female', name: 'Frau' },
    { code: 'other', name: 'Divers' },
  ];

  // Client Companies for assignment/favorites
  allClientCompanies: ClientCompany[] = [];
  isLoadingCompanies = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private clientCompanyService: ClientCompanyService,
    private clientService: ClientService,
    private toast: HotToastService,
  ) {}

  // Store returnTo path for navigation after creation
  private returnToPath: string | null = null;
  mailFailureMessage: string | null = null;

  // Sales mode - when true, Kunde tab is disabled and specific company is pre-selected
  isSalesMode = false;
  preSelectedClientCompanyId: number | null = null;
  preSelectedClientCompanyName: string | null = null;

  ngOnInit(): void {
    this.initializeForm();
    this.loadClientCompanies();
    this.handleQueryParams();
  }

  private isEmailSendFailure(error: any): boolean {
    const errors = error?.data?.errors || error?.error?.errors || {};
    if (errors.email === 'emailDeliveryFailed') {
      return true;
    }

    const message = (error?.data?.message || error?.message || '').toString().toLowerCase();
    const host = (error?.hostname || '').toString().toLowerCase();
    const code = (error?.code || '').toString().toLowerCase();

    const mailKeywords = ['smtp', 'mailer', 'econnrefused'];
    const dnsKeywords = ['enotfound', 'edns'];

    return mailKeywords.some((kw) => message.includes(kw)) || host.includes('maildev') || dnsKeywords.some((kw) => code.includes(kw));
  }

  private handleEmailSendFailureAkzente(formValues: any, newSalesContactName: string): void {
    this.toast.warning(
      'Akzente Benutzer wurde erstellt, aber die Zugangsdaten-E-Mail konnte nicht versendet werden. Bitte nutzen Sie in der Bearbeitungsansicht „Neues Passwort generieren und verschicken“.',
      {
        position: 'bottom-right',
        duration: 8000,
        icon: '✉️',
      },
    );

    // Navigate back to caller (e.g., project-create) and preselect the new sales contact
    setTimeout(() => {
      if (this.returnToPath) {
        this.router.navigate([this.returnToPath], {
          state: {
            newSalesContactName,
            newSalesContactEmail: formValues.email,
          },
        });
      } else {
        const queryParams = this.route.snapshot.queryParams;
        this.router.navigate(['/users'], { queryParams });
      }
    }, 300);
  }

  private handleEmailSendFailureClient(formValues: any): void {
    this.toast.warning('Client wurde erstellt, aber die Zugangsdaten-E-Mail konnte nicht versendet werden. Bitte nutzen Sie in der Bearbeitungsansicht „Neues Passwort generieren und verschicken“.', {
      position: 'bottom-right',
      duration: 8000,
      icon: '✉️',
    });

    setTimeout(() => {
      if (this.returnToPath) {
        this.router.navigateByUrl(this.returnToPath);
      } else {
        const queryParams = this.route.snapshot.queryParams;
        this.router.navigate(['/users'], { queryParams });
      }
    }, 300);
  }

  /**
   * Handle query params for pre-setting form values
   */
  private handleQueryParams(): void {
    this.route.queryParams.subscribe((params) => {
      // Check if in sales mode (from project-create)
      if (params['salesMode'] === 'true') {
        this.isSalesMode = true;
      }

      // Pre-select isSales if passed in query params
      if (params['isSales'] === 'true') {
        this.userForm.patchValue({ isSales: true });
        // Ensure Kunde tab is selected for sales users
        this.selectedTab = 1;
      }

      // Store returnTo path for navigation after creation
      if (params['returnTo']) {
        this.returnToPath = params['returnTo'];
      }

      // Store client company to pre-select after companies are loaded
      if (params['clientCompanyId']) {
        this.preSelectedClientCompanyId = Number(params['clientCompanyId']);
      }

      if (params['clientCompanyName']) {
        this.preSelectedClientCompanyName = params['clientCompanyName'];
      }
    });
  }

  /**
   * Initialize the reactive form
   */
  private initializeForm(): void {
    this.userForm = this.fb.group({
      // Main form fields
      gender: ['', Validators.required],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.minLength(8), Validators.maxLength(20)]],
      email: ['', [Validators.required, Validators.email]],
      isSales: [false], // Default to false - used for Client/Kunde users with sales role

      // Dynamic customer assignments/favorites - will be created after loading companies
      customers: this.fb.group({}),
    });
  }

  /**
   * Load all client companies for assignment/favorites
   */
  private loadClientCompanies(): void {
    this.isLoadingCompanies = true;

    this.clientCompanyService
      .getAllClientCompaniesBasic()
      .pipe(
        finalize(() => {
          this.isLoadingCompanies = false;
        }),
        catchError((error) => {
          console.error('❌ Error loading client companies:', error);

          this.toast.error('Fehler beim Laden der Kundenunternehmen', {
            position: 'bottom-right',
            duration: 4000,
          });

          return of([] as ClientCompany[]);
        }),
      )
      .subscribe({
        next: (companies: ClientCompany[]) => {
          this.allClientCompanies = companies;
          this.setupDynamicForm();
        },
      });
  }

  /**
   * Setup form controls dynamically based on loaded companies
   */
  private setupDynamicForm(): void {
    const customersGroup = this.userForm.get('customers') as FormGroup;

    // Clear existing controls
    Object.keys(customersGroup.controls).forEach((key) => {
      customersGroup.removeControl(key);
    });

    // Add controls for each company from the database
    this.displayClientCompanies.forEach((company) => {
      const controlName = this.getControlName(company);
      const isPreSelected = this.preSelectedClientCompanyId && company.id === this.preSelectedClientCompanyId;
      customersGroup.addControl(controlName, new FormControl(isPreSelected));
    });

    if (this.preSelectedClientCompanyId) {
    }
  }

  /**
   * Handle tab change - more explicit approach
   */
  onTabChange(event: any): void {
    let newTab = 0;

    // Handle different event structures from PrimeNG
    if (typeof event === 'number') {
      newTab = event;
    } else if (event && event.index !== undefined) {
      newTab = event.index;
    } else if (event && event.originalEvent) {
      // Sometimes PrimeNG passes nested events
      newTab = event.index || 0;
    }

    // Prevent switching to Akzente tab if in sales mode
    if (this.isSalesMode && newTab === 0) {
      // Force keep it on Kunde tab (1)
      setTimeout(() => {
        this.selectedTab = 1;
      });
      return;
    }

    this.selectedTab = newTab;
  }

  /**
   * Manually set tab - for direct click handlers
   */
  setTab(tabIndex: number): void {
    this.selectedTab = tabIndex;
  }

  /**
   * Companies shown in the assignment UI (DB-backed; sales mode shows only pre-selected customer).
   */
  get displayClientCompanies(): ClientCompany[] {
    if (this.isSalesMode && this.preSelectedClientCompanyId) {
      const match = this.allClientCompanies.filter((company) => company.id === this.preSelectedClientCompanyId);
      if (match.length > 0) {
        return match;
      }
    }

    return this.allClientCompanies;
  }

  /**
   * Convert company to a stable form control name (based on database id).
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
   * Toggle customer selection
   */
  toggleCustomerSelection(controlName: string): void {
    const customerControl = this.userForm.get(`customers.${controlName}`);
    if (customerControl) {
      customerControl.setValue(!customerControl.value);
    }
  }

  /**
   * Check if customer is selected
   */
  isCustomerSelected(controlName: string): boolean {
    return this.userForm.get(`customers.${controlName}`)?.value || false;
  }

  /**
   * Get fallback image for companies without logos
   */
  getFallbackImage(): string {
    return 'images/placeholder.png';
  }

  /**
   * TrackBy function for client companies to improve performance
   * Made public for template access
   */
  trackByCompanyId(index: number, company: ClientCompany): number {
    return company.id;
  }

  /**
   * Check if form is valid for submission
   */
  isFormValidForSubmission(): boolean {
    const formValid = this.userForm.valid;
    // Remove the requirement for selected companies - make it optional
    return formValid;
  }

  /**
   * Check if at least one company is selected
   */
  private hasSelectedCompanies(): boolean {
    const customers = this.userForm.get('customers')?.value || {};
    return Object.values(customers).some((value) => value === true);
  }

  /**
   * Get form errors for debugging
   */
  private getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.userForm.controls).forEach((key) => {
      const control = this.userForm.get(key);
      if (control?.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  /**
   * Get the current user type based on selected tab
   */
  private getUserType(): 'akzente' | 'client' {
    return this.selectedTab === 0 ? 'akzente' : 'client';
  }

  /**
   * Get the appropriate endpoint name based on user type
   */
  private getEndpointType(): string {
    return this.getUserType() === 'akzente' ? 'Akzente Benutzer' : 'Client';
  }

  /**
   * Get the appropriate companies label based on user type
   */
  getCompaniesLabel(): string {
    return this.getUserType() === 'akzente' ? 'favorisiertes Kundenunternehmen' : 'Kundenunternehmen';
  }

  /**
   * Submit form and create user (Akzente or Client)
   */
  onSubmit(): void {
    if (!this.isFormValidForSubmission() || this.isSubmitting) {
      this.userForm.markAllAsTouched();

      if (!this.userForm.valid) {
        this.toast.error('Bitte füllen Sie alle erforderlichen Felder korrekt aus', {
          position: 'bottom-right',
          duration: 3000,
        });
      }
      // Remove the error message for companies since it's now optional
      return;
    }

    this.isSubmitting = true;

    const userType = this.getUserType();

    // Clear any previous mail failure banners
    this.mailFailureMessage = null;

    const formValues = this.userForm.value;

    // Get selected client companies from dynamic checkboxes (can be empty array now)
    const selectedCompanyIds: number[] = [];
    const customers = formValues.customers;

    Object.keys(customers).forEach((controlName) => {
      if (customers[controlName]) {
        const company = this.getCompanyByControlName(controlName);
        if (company) {
          selectedCompanyIds.push(company.id);
        }
      }
    });

    // Show loading toast
    const loadingToast = this.toast.loading(`Erstelle ${this.getEndpointType()}...`, {
      position: 'bottom-right',
      duration: 2000,
    });

    // Call the appropriate service method based on user type
    if (userType === 'akzente') {
      this.createAkzenteUser(formValues, selectedCompanyIds, loadingToast);
    } else {
      this.createClientUser(formValues, selectedCompanyIds, loadingToast);
    }
  }

  /**
   * Create Akzente user
   */
  private createAkzenteUser(formValues: any, selectedCompanyIds: number[], loadingToast: any): void {
    const createAkzenteData: CreateAkzenteDto = {
      email: formValues.email,
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      gender: formValues.gender,
      phone: formValues.phone,
      clientCompanies: selectedCompanyIds.map((id) => ({ id })),
    };

    this.clientService
      .createAkzente(createAkzenteData)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          loadingToast.close();
        }),
      )
      .subscribe({
        next: () => {
          this.mailFailureMessage = null;

          // Build the full name for the new sales contact
          const newSalesContactName = `${formValues.firstName} ${formValues.lastName}`;

          this.toast.success('Akzente Benutzer wurde erfolgreich erstellt! Das Passwort wurde per E-Mail versendet.', {
            position: 'bottom-right',
            duration: 5000,
            icon: '✅',
          });

          setTimeout(() => {
            // Navigate to returnToPath if set (e.g., from project-create)
            if (this.returnToPath) {
              // Pass the new sales contact name in navigation state
              this.router.navigate([this.returnToPath], {
                state: {
                  newSalesContactName: newSalesContactName,
                  newSalesContactEmail: formValues.email,
                },
              });
            } else {
              // Preserve filter state when navigating back
              const queryParams = this.route.snapshot.queryParams;
              this.router.navigate(['/users'], { queryParams });
            }
          }, 1000);
        },
        error: (error) => {
          console.error('❌ Error creating Akzente user:', error);

          if (this.isEmailSendFailure(error)) {
            const newSalesContactName = `${formValues.firstName} ${formValues.lastName}`;
            this.mailFailureMessage = `E-Mail-Versand fehlgeschlagen. Benutzer erstellt: ${newSalesContactName} (${formValues.email}). Bitte in der Bearbeitungsansicht „Neues Passwort generieren und verschicken“ nutzen.`;
            this.handleEmailSendFailureAkzente(formValues, newSalesContactName);
            return;
          }

          const errorMessage = this.getErrorMessage(error, 'akzente');
          this.toast.error(errorMessage, {
            position: 'bottom-right',
            duration: 5000,
            icon: '❌',
          });
        },
      });
  }

  /**
   * Create Client user
   */
  private createClientUser(formValues: any, selectedCompanyIds: number[], loadingToast: any): void {
    const createClientData: CreateClientDto = {
      email: formValues.email,
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      gender: formValues.gender,
      phone: formValues.phone,
      isSales: formValues.isSales || false, // Include isSales field for client users
      clientCompanies: selectedCompanyIds.map((id) => ({ id })),
    };

    this.clientService
      .createClient(createClientData)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          loadingToast.close();
        }),
      )
      .subscribe({
        next: () => {
          this.mailFailureMessage = null;

          this.toast.success('Client wurde erfolgreich erstellt! Das Passwort wurde per E-Mail versendet.', {
            position: 'bottom-right',
            duration: 5000,
            icon: '✅',
          });

          setTimeout(() => {
            // Navigate to returnToPath if set (e.g., from project-create)
            if (this.returnToPath) {
              const newClientContactName = `${formValues.firstName} ${formValues.lastName}`;
              this.router.navigate([this.returnToPath], {
                state: {
                  newClientContactEmail: formValues.email,
                  newClientContactName: newClientContactName,
                  newClientContactIsSales: formValues.isSales || false,
                },
              });
            } else {
              // Preserve filter state when navigating back
              const queryParams = this.route.snapshot.queryParams;
              this.router.navigate(['/users'], { queryParams });
            }
          }, 1000);
        },
        error: (error) => {
          console.error('❌ Error creating client:', error);

          if (this.isEmailSendFailure(error)) {
            this.mailFailureMessage = `E-Mail-Versand fehlgeschlagen. Benutzer erstellt: ${formValues.firstName} ${formValues.lastName} (${formValues.email}). Bitte in der Bearbeitungsansicht „Neues Passwort generieren und verschicken“ nutzen.`;
            this.handleEmailSendFailureClient(formValues);
            return;
          }

          const errorMessage = this.getErrorMessage(error, 'client');
          this.toast.error(errorMessage, {
            position: 'bottom-right',
            duration: 5000,
            icon: '❌',
          });
        },
      });
  }

  /**
   * Extract user-friendly error message from error response
   */
  private getErrorMessage(error: any, userType: 'akzente' | 'client'): string {
    if (error?.data?.errors) {
      const errors = error.data.errors;

      if (errors.email) {
        return 'Diese E-Mail-Adresse wird bereits verwendet.';
      }

      if (errors.clientCompanies) {
        return 'Einige der ausgewählten Kundenunternehmen wurden nicht gefunden.';
      }

      if (errors.user === 'unauthorizedUserType') {
        return userType === 'client'
          ? 'Sie haben keine Berechtigung, Clients zu erstellen. Nur Akzente-Benutzer können Clients anlegen.'
          : 'Sie haben keine Berechtigung, Akzente-Benutzer zu erstellen.';
      }

      if (errors.user === 'unauthorizedUserRole') {
        return 'Sie haben keine Berechtigung, Akzente-Benutzer zu erstellen. Nur Administratoren können Akzente-Benutzer anlegen.';
      }

      const firstError = Object.values(errors)[0];
      return typeof firstError === 'string' ? firstError : 'Validierungsfehler in den Eingabedaten.';
    }

    if (error?.data?.message) {
      return error.data.message;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.status === 401) {
      return userType === 'client' ? 'Unauthorized: Sie müssen als Akzente-Benutzer angemeldet sein.' : 'Unauthorized: Sie müssen als Administrator angemeldet sein.';
    }

    if (error?.status === 422) {
      return 'Ungültige Eingabedaten. Bitte überprüfen Sie Ihre Eingaben.';
    }

    if (error?.status === 500) {
      return 'Serverfehler. Bitte versuchen Sie es später erneut.';
    }

    const entityName = userType === 'client' ? 'Clients' : 'Akzente-Benutzers';
    return `Ein unbekannter Fehler ist aufgetreten beim Erstellen des ${entityName}.`;
  }

  /**
   * Cancel and navigate back
   */
  cancel(): void {
    this.toast.info('Vorgang abgebrochen', {
      position: 'bottom-right',
      duration: 2000,
    });

    // Navigate to returnToPath if set (e.g., from project-create)
    if (this.returnToPath) {
      this.router.navigateByUrl(this.returnToPath);
    } else {
      // Preserve filter state when navigating back
      const queryParams = this.route.snapshot.queryParams;
      this.router.navigate(['/users'], { queryParams });
    }
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
    const field = this.userForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return `${fieldName} ist erforderlich`;
    if (field.errors['email']) return 'Ungültige E-Mail-Adresse';
    if (field.errors['minlength']) return `Mindestens ${field.errors['minlength'].requiredLength} Zeichen erforderlich`;
    if (field.errors['pattern']) return 'Ungültiges Format';

    return 'Ungültige Eingabe';
  }
}
