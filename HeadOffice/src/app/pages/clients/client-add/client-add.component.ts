import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { ClientCompanyService, CreateClientCompanyFormData } from '@app/core/services/client-company.service';
import { User } from '@app/pages/users/services/users.service';
import { ImageItem } from '@app/shared/components/multi-image-upload/multi-image-upload.component';
import { finalize } from 'rxjs';
import { ClientAddStateService } from './client-add-state.service';
import { ClientService } from '@app/@core/services/client.service';
import { ClientsStateService, CardItem } from '../list/clients-state.service';
import { CLIENT_LOGO_MAX_FILE_SIZE_BYTES, CLIENT_LOGO_MAX_FILE_SIZE_LABEL, getLogoFileTooLargeMessage } from '@app/shared/constants/logo-upload.constants';

@Component({
  selector: 'app-client-add',
  templateUrl: './client-add.component.html',
  styleUrls: ['./client-add.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ClientAddComponent implements OnInit {
  clientForm: FormGroup;
  managerControl = new FormControl('');
  selectedImages: ImageItem[] = [];
  isSubmitting = false;
  isLoading = true;
  logoPreview: string | null = null;
  fileName: string = '';
  selectedLogoFile: File | null = null;

  // For autocomplete - populated from API
  filteredContacts: string[] = [];
  contactValue: string[] = [];
  allContacts: string[] = [];
  clientUsers: User[] = []; // Store full user objects

  selectedManagers: string[] = [];
  filteredManagers: string[] = [];
  allManagers: string[] = [];
  akzenteUsers: User[] = []; // Store full user objects

  // Store user IDs for relationships
  selectedContactUserIds: number[] = [];
  selectedManagerUserIds: number[] = [];
  private navigationState: any = null;

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
    private clientAddStateService: ClientAddStateService,
    private clientService: ClientService,
    private clientsStateService: ClientsStateService,
    private toast: HotToastService,
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.navigationState = navigation.extras.state;
    }
  }

  ngOnInit(): void {
    this.initializeForm();

    // Try to restore from cache first
    const cachedState = this.clientAddStateService.getState();

    if (cachedState && this.clientAddStateService.isCacheValid()) {
      // Restore users from cache
      this.clientUsers = cachedState.clientUsers;
      this.akzenteUsers = cachedState.akzenteUsers;

      // Format user names for dropdowns
      this.allContacts = this.clientUsers.map((user) => this.formatUserName(user));
      this.filteredContacts = [...this.allContacts];
      this.allManagers = this.akzenteUsers.map((user) => this.formatUserName(user));
      this.filteredManagers = [...this.allManagers];

      this.isLoading = false;

      // Restore form state after users are loaded
      this.restoreFormState();

      // Apply restored state (including new contact selection)
      this.restoreFormStateAfterUsersLoad();
    } else {
      // No valid cache, load from API
      this.loadAllUsers();
      this.restoreFormState();
    }
  }

  /**
   * Restore form state if returning from contact creation
   */
  private restoreFormState(): void {
    // Check both navigation state and history state
    let state: any = this.navigationState;

    if (!state && (window.history as any).state) {
      // Fallback to history state
      state = (window.history as any).state;
    }

    if (state?.formState) {
      const formState = state.formState;

      // Restore form values
      if (formState.name) {
        this.clientForm.patchValue({ name: formState.name });
      }

      // Restore logo if it was a data URL (we can't restore File objects)
      if (formState.logoPreview && formState.logoPreview.startsWith('data:')) {
        this.logoPreview = formState.logoPreview;
        this.fileName = formState.fileName || '';

        // Convert data URL back to File object
        if (formState.logoFileType) {
          this.dataURLtoFile(formState.logoPreview, formState.fileName, formState.logoFileType).then((file) => {
            this.selectedLogoFile = file;
            this.clientForm.patchValue({ image: file });
          });
        }
      }

      // Restore contacts and managers (will be set after users load)
      if (formState.contactValue && formState.contactValue.length > 0) {
        // Store to restore after users are loaded
        this.pendingContactValue = formState.contactValue;
        this.pendingContactUserIds = formState.selectedContactUserIds || [];
      }

      if (formState.selectedManagers && formState.selectedManagers.length > 0) {
        // Store to restore after users are loaded
        this.pendingManagerValue = formState.selectedManagers;
        this.pendingManagerUserIds = formState.selectedManagerUserIds || [];
      }

      // Check if a new contact was created (by email)
      if (state.newContactEmail) {
        this.pendingNewContactEmail = state.newContactEmail;
      }
    } else if (state?.newContactEmail) {
      // Handle case where formState is missing but newContactEmail is present
      this.pendingNewContactEmail = state.newContactEmail;
    }
  }

  // Properties to store pending values while users are loading
  private pendingContactValue: string[] = [];
  private pendingContactUserIds: number[] = [];
  private pendingManagerValue: string[] = [];
  private pendingManagerUserIds: number[] = [];
  private pendingNewContactEmail: string | null = null;

  private initializeForm(): void {
    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      image: [''],
      contacts: [[]],
      managers: [[], Validators.required],
    });
  }

  /**
   * Load all users for assignment dropdowns
   */
  private loadAllUsers(): void {
    this.clientCompanyService.getAllUsers().subscribe({
      next: (allUsers) => {
        this.clientUsers = allUsers.clientUsers?.data || [];
        this.akzenteUsers = allUsers.akzenteUsers?.data || [];

        // Store user arrays
        this.clientUsers = allUsers.clientUsers?.data || [];
        this.akzenteUsers = allUsers.akzenteUsers?.data || [];

        // Format user names for dropdowns
        this.allContacts = this.clientUsers.map((user) => this.formatUserName(user));
        this.filteredContacts = [...this.allContacts];

        this.allManagers = this.akzenteUsers.map((user) => this.formatUserName(user));
        this.filteredManagers = [...this.allManagers];

        this.isLoading = false;

        // Save users to cache
        this.clientAddStateService.saveUsersData(this.clientUsers, this.akzenteUsers);

        // Restore form state after users are loaded
        this.restoreFormStateAfterUsersLoad();
      },
      error: (error) => {
        console.error('❌ Error loading users:', error);
        this.toast.error('Fehler beim Laden der Benutzerdaten', {
          position: 'bottom-right',
          duration: 3000,
        });
        this.isLoading = false;
      },
    });
  }

  /**
   * Handle image selection
   */
  onImageSelected(file: File): void {
    if (!this.isValidLogoFile(file)) {
      return;
    }

    this.selectedLogoFile = file;
    this.logoPreview = URL.createObjectURL(file);
    this.fileName = file.name;

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

  /**
   * Handle image removal
   */
  onImageRemoved(): void {
    this.selectedLogoFile = null;
    this.logoPreview = null;
    this.fileName = '';

    this.clientForm.patchValue({
      image: '',
    });

    // Show info toast for file removal
    this.toast.info('Logo entfernt', {
      position: 'bottom-right',
      duration: 2000,
    });
  }

  /**
   * Handle contact selection changes
   */
  onContactsChanged(): void {
    // Update the selected user IDs based on contact names
    this.selectedContactUserIds = this.contactValue
      .map((contactName) => {
        const user = this.clientUsers.find((user) => this.formatUserName(user) === contactName);
        return user ? user.id : null;
      })
      .filter((id) => id !== null);

    this.clientForm.patchValue({
      contacts: this.contactValue,
    });
  }

  /**
   * Handle manager selection changes
   */
  onManagersChanged(): void {
    // Update the selected user IDs based on manager names
    this.selectedManagerUserIds = this.selectedManagers
      .map((managerName) => {
        const user = this.akzenteUsers.find((user) => this.formatUserName(user) === managerName);
        return user ? user.id : null;
      })
      .filter((id) => id !== null);

    this.clientForm.patchValue({
      managers: this.selectedManagers,
    });
    this.clientForm.get('managers')?.markAsTouched();
    this.clientForm.get('managers')?.updateValueAndValidity();
  }

  /**
   * Filter contact suggestions
   */
  filterContactSuggestions(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredContacts = this.allContacts.filter((contact) => contact.toLowerCase().includes(query));
  }

  /**
   * Filter manager suggestions
   */
  filterManagerSuggestions(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredManagers = this.allManagers.filter((manager) => manager.toLowerCase().includes(query));
  }

  /**
   * Navigate to create new contact
   */
  createNewContact(): void {
    // If there's a logo file, convert it to data URL first
    if (this.selectedLogoFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;

        // Save current form state before navigating
        const formState = {
          name: this.clientForm.get('name')?.value || '',
          contactValue: [...this.contactValue],
          selectedContactUserIds: [...this.selectedContactUserIds],
          selectedManagers: [...this.selectedManagers],
          selectedManagerUserIds: [...this.selectedManagerUserIds],
          logoPreview: dataUrl, // Use data URL
          fileName: this.fileName,
          logoFileType: this.selectedLogoFile?.type || '',
        };

        // Navigate to contact person add page with form state
        this.router.navigate(['users/contact/add'], {
          state: {
            returnTo: '/clients/add',
            formState: formState,
          },
        });
      };
      reader.readAsDataURL(this.selectedLogoFile);
    } else {
      // No logo, just navigate with other state
      const formState = {
        name: this.clientForm.get('name')?.value || '',
        contactValue: [...this.contactValue],
        selectedContactUserIds: [...this.selectedContactUserIds],
        selectedManagers: [...this.selectedManagers],
        selectedManagerUserIds: [...this.selectedManagerUserIds],
        logoPreview: null,
        fileName: '',
        logoFileType: '',
      };

      // Navigate to contact person add page with form state
      this.router.navigate(['users/contact/add'], {
        state: {
          returnTo: '/clients/add',
          formState: formState,
        },
      });
    }
  }

  /**
   * Submit form and create client company
   */
  onSubmit(): void {
    if (this.clientForm.invalid || this.isSubmitting) {
      // Show validation error toast
      if (this.clientForm.invalid) {
        this.toast.error('Bitte füllen Sie alle erforderlichen Felder aus', {
          position: 'bottom-right',
          duration: 3000,
        });
      }
      return;
    }

    this.isSubmitting = true;

    // Show loading toast
    const loadingToast = this.toast.loading('Erstelle Kunde...', {
      position: 'bottom-right',
      duration: 2000,
    });

    // Prepare FormData
    const formData = new FormData();
    formData.append('name', this.clientForm.get('name')?.value);

    // Add logo if selected
    if (this.selectedLogoFile) {
      formData.append('logo', this.selectedLogoFile);
    }

    // Add contact IDs as JSON string
    if (this.selectedContactUserIds.length > 0) {
      formData.append('contactIds', JSON.stringify(this.selectedContactUserIds));
    }

    // Add manager IDs as JSON string
    if (this.selectedManagerUserIds.length > 0) {
      formData.append('managerIds', JSON.stringify(this.selectedManagerUserIds));
    }

    // Submit the form using the updated service
    this.clientCompanyService
      .createClientCompanyWithRelationships(formData)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          loadingToast.close(); // Close loading toast
        }),
      )
      .subscribe({
        next: (response) => {
          // Clear form state from cache after successful creation
          this.clientAddStateService.clearFormState();

          // Refresh sidebar to include the new client
          this.clientCompanyService.getClientCompanies(1, 100).subscribe({
            next: (clientsResponse) => {
              this.clientService.updateSidebarClients(clientsResponse.data);

              // Update Clients List Cache so the new client appears immediately
              const cardItems = this.transformToCardItems(clientsResponse.data);
              this.clientsStateService.saveState({
                allCards: cardItems,
                // We keep other state properties as is, they will be merged in saveState
              });
            },
            error: (err) => {
              console.warn('⚠️ Could not update sidebar:', err);
            },
          });

          // Show success toast
          this.toast.success('Kunde wurde erfolgreich erstellt!', {
            position: 'bottom-right',
            duration: 4000,
            icon: '✅',
          });

          // Navigate back to clients list after a short delay, preserving filter state
          setTimeout(() => {
            const queryParams = { ...this.route.snapshot.queryParams, highlightId: response.id };
            this.router.navigate(['/clients/list'], { queryParams });
          }, 1000);
        },
        error: (error) => {
          console.error('❌ Error creating client company:', error);

          // Show error toast with specific error message
          const errorMessage = this.getErrorMessage(error);
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

    if (error?.status === 413) {
      return error?.error?.message || `Das Logo darf maximal ${CLIENT_LOGO_MAX_FILE_SIZE_LABEL} groß sein. Bitte wählen Sie eine kleinere Datei.`;
    }

    if (error?.status === 415) {
      return 'Ungültiges Dateiformat. Nur Bilddateien sind für das Logo erlaubt.';
    }

    if (error?.status === 500) {
      return 'Serverfehler. Bitte versuchen Sie es später erneut.';
    }

    return 'Ein unbekannter Fehler ist aufgetreten beim Erstellen des Kunden.';
  }

  /**
   * Restore form state after users are loaded
   */
  private restoreFormStateAfterUsersLoad(): void {
    // Restore contacts
    if (this.pendingContactValue.length > 0 || this.pendingNewContactEmail) {
      // If we have a new contact email, find it and add it
      if (this.pendingNewContactEmail) {
        const normalizedPendingEmail = this.pendingNewContactEmail.trim().toLowerCase();
        const newContact = this.clientUsers.find((user) => (user.email || '').trim().toLowerCase() === normalizedPendingEmail);

        if (newContact) {
          const newContactName = this.formatUserName(newContact);
          // Add to contact value if not already present
          if (!this.pendingContactValue.includes(newContactName)) {
            this.pendingContactValue.push(newContactName);
          }
          if (!this.pendingContactUserIds.includes(newContact.id)) {
            this.pendingContactUserIds.push(newContact.id);
          }
        } else {
          console.warn('⚠️ New contact not found in users list, email:', this.pendingNewContactEmail);
          // Reload users to get the newly created contact
          this.reloadUsersAndSelectNewContact();
        }
      }

      // Restore all pending contacts
      this.contactValue = [...this.pendingContactValue];
      this.selectedContactUserIds = [...this.pendingContactUserIds];
      this.onContactsChanged();
    }

    // Restore managers
    if (this.pendingManagerValue.length > 0) {
      this.selectedManagers = [...this.pendingManagerValue];
      this.selectedManagerUserIds = [...this.pendingManagerUserIds];
      this.onManagersChanged();
    }

    // Clear pending values
    this.pendingContactValue = [];
    this.pendingContactUserIds = [];
    this.pendingManagerValue = [];
    this.pendingManagerUserIds = [];
    this.pendingNewContactEmail = null;
  }

  /**
   * Reload users and select the newly created contact
   */
  private reloadUsersAndSelectNewContact(): void {
    if (!this.pendingNewContactEmail) return;

    const normalizedPendingEmail = this.pendingNewContactEmail.trim().toLowerCase();

    this.clientCompanyService.getAllUsers().subscribe({
      next: (allUsers) => {
        this.clientUsers = allUsers.clientUsers?.data || [];
        this.akzenteUsers = allUsers.akzenteUsers?.data || []; // Update akzente users too just in case

        // Update dropdown lists
        this.allContacts = this.clientUsers.map((user) => this.formatUserName(user));
        this.filteredContacts = [...this.allContacts];

        // Update cache with new users
        this.clientAddStateService.saveUsersData(this.clientUsers, this.akzenteUsers);

        // Find and select the new contact
        const newContact = this.clientUsers.find((user) => (user.email || '').trim().toLowerCase() === normalizedPendingEmail);

        if (newContact) {
          const newContactName = this.formatUserName(newContact);

          // Use spread operator to create new array reference to trigger change detection
          if (!this.contactValue.includes(newContactName)) {
            this.contactValue = [...this.contactValue, newContactName];
          }

          if (!this.selectedContactUserIds.includes(newContact.id)) {
            this.selectedContactUserIds = [...this.selectedContactUserIds, newContact.id];
          }

          this.onContactsChanged();
        } else {
          console.warn('⚠️ New contact STILL not found after reload:', this.pendingNewContactEmail);
        }

        this.pendingNewContactEmail = null;
      },
      error: (error) => {
        console.error('❌ Error reloading users:', error);
        this.pendingNewContactEmail = null;
      },
    });
  }

  /**
   * Transform ClientCompany data to CardItem format (duplicated from ClientsComponent)
   */
  private transformToCardItems(companies: any[]): CardItem[] {
    return companies.map((company) => {
      const cities = (company as any).cities || [];
      const primaryCity = cities.length > 0 ? cities[0].name : 'Unknown';

      return {
        id: company.id,
        isFavorite: company.isFavorite || false,
        isMyClient: (company as any).isMyClient ?? false,
        name: company.name,
        city: primaryCity,
        cities: cities,
        image: company.logo?.path || '/images/projects/default-company.png',
        logo: company.logo,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        reportCounts: (company as any).reportCounts,
      };
    });
  }

  /**
   * Cancel and navigate back
   */
  cancel(): void {
    // Clear form state from cache when canceling
    this.clientAddStateService.clearFormState();

    // Show info toast for cancellation
    this.toast.info('Vorgang abgebrochen', {
      position: 'bottom-right',
      duration: 2000,
    });

    // Preserve filter state when navigating back
    const queryParams = this.route.snapshot.queryParams;
    this.router.navigate(['/clients/list'], { queryParams });
  }

  /**
   * Convert data URL to File object
   */
  private async dataURLtoFile(dataUrl: string, fileName: string, fileType: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: fileType });
  }
}
