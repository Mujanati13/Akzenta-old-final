import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';

// Import PrimeNG components
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { FloatLabelModule } from 'primeng/floatlabel';
import { Location } from '@angular/common';

// Import shared components
import { AppIconComponent } from '@app/shared/app-icon.component';
import { ImportsModule } from '@app/shared/imports';
import { DateRangePickerComponent } from '../../../shared/components/date-range-picker/date-range-picker.component';

// Import services
import { ClientCompanyService } from '@app/core/services/client-company.service';
import { User } from '@app/pages/users/services/users.service';
import { finalize } from 'rxjs';
import { ProjectService } from '@app/core/services/project.service';
import { ProjectCreateStateService } from './project-create-state.service';
import { isEmptyQuestionOptionText } from '@app/@core/utils/project-question.util';
// Add Excel generation capability with styling support
import * as XLSX from 'xlsx-js-style';
import { buildPersistedPhotoLabels } from '@app/@core/utils/advanced-photo.util';

export enum AnswerTypeEnum {
  TEXT = 1,
  SELECT = 2,
  MULTISELECT = 3,
  BOOLEAN = 4,
}

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccordionModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    RouterModule,
    InputSwitchModule,
    InputTextModule,
    RadioButtonModule,
    FloatLabelModule,
    AppIconComponent,
    ImportsModule,
    DateRangePickerComponent,
  ],
  templateUrl: './project-create.component.html',
  styleUrl: './project-create.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ProjectCreateComponent implements OnInit {
  projectForm: FormGroup;
  newContactForm: FormGroup;
  contactDialogVisible = false;
  isSubmitting = false;
  isLoading = true;
  dateRange2 = { start: null, end: null };

  // User data from API
  clientUsers: User[] = [];
  akzenteUsers: User[] = [];
  nonSalesUsers: User[] = []; // Filtered non-sales users from backend
  salesUsers: User[] = []; // Filtered sales users from backend

  // For autocomplete
  filteredClientContacts: string[] = [];
  filteredSalesContacts: string[] = [];
  allClientContacts: string[] = [];
  allSalesContacts: string[] = [];

  // Selected values
  clientContactValue: string[] = [];
  salesContactValue: string[] = [];

  // Store user IDs for relationships
  selectedClientUserIds: number[] = [];
  selectedSalesUserIds: number[] = [];

  answerTypes = [
    { label: 'Text', value: AnswerTypeEnum.TEXT },
    { label: 'Mehrfachauswahl', value: AnswerTypeEnum.MULTISELECT },
    { label: 'Einzelauswahl', value: AnswerTypeEnum.SELECT },
    { label: 'Ja/Nein', value: AnswerTypeEnum.BOOLEAN },
  ];

  selectedClient: string;
  clientId: number | null = null;
  private previousClientId: number | null = null;
  clientCompanyName: string = '';

  successModalVisible: boolean = false;
  projectName: string = '';

  // Accordion active value - set all panels open by default (PrimeNG v19 uses value instead of activeIndex)
  activeAccordionValue: string[] = ['0', '1', '2', '3'];

  AnswerTypeEnum = AnswerTypeEnum;

  constructor(
    private fb: FormBuilder,
    private _location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private clientCompanyService: ClientCompanyService,
    private projectService: ProjectService,
    private projectCreateStateService: ProjectCreateStateService,
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadData();
    this.checkForNewContact();
  }

  private checkForNewContact(): void {
    // Check if we're returning from contact creation
    // Use window.history.state as it persists after navigation
    const state = (window.history as any).state;

    if (state?.newContactEmail) {
      // Wait for users to load, then select the new contact
      // The checkForNewContactAfterUsersLoad will handle this after users are loaded
    }

    if (state?.newClientContactEmail) {
      // New client contact was created - will be added to selection after users load
    }

    if (state?.newSalesContactName) {
      // New sales contact was created - will be added to selection after users load
      // Store for later use after users are loaded
      (this as any).pendingNewSalesContact = state.newSalesContactName;
    }
  }

  private restoreFormState(): void {
    const savedState = this.projectCreateStateService.getState();
    if (!savedState || !this.projectCreateStateService.isCacheValidForClient(this.clientId)) {
      return;
    }

    // Restore basic form values
    if (savedState.projectName) {
      this.projectForm.patchValue({ projectName: savedState.projectName });
    }
    if (savedState.startDate) {
      this.projectForm.patchValue({ startDate: savedState.startDate });
    }
    if (savedState.endDate) {
      this.projectForm.patchValue({ endDate: savedState.endDate });
    }
    if (savedState.dateRange2) {
      this.dateRange2 = savedState.dateRange2;
    }

    // Restore contact values (will be set after users load)
    if (savedState.clientContactValue && savedState.clientContactValue.length > 0) {
      this.clientContactValue = [...savedState.clientContactValue];
      this.selectedClientUserIds = [...(savedState.selectedClientUserIds || [])];
    }
    if (savedState.salesContactValue && savedState.salesContactValue.length > 0) {
      this.salesContactValue = [...savedState.salesContactValue];
      this.selectedSalesUserIds = [...(savedState.selectedSalesUserIds || [])];
    }

    // Restore questions
    if (savedState.questions && savedState.questions.length > 0) {
      // Clear existing questions
      while (this.questions.length > 0) {
        this.questions.removeAt(0);
      }
      // Restore questions (skip empty rows)
      savedState.questions
        .filter((question: any) => {
          const text = (question.text || '').trim();
          const answerType = question.answerType;
          return text || answerType;
        })
        .forEach((question: any) => {
          const questionGroup = this.createQuestionGroup();
          questionGroup.patchValue({
            text: question.text || '',
            answerType: question.answerType || null,
            required: question.required !== undefined ? question.required : true,
            visibleToClient: question.visibleToClient !== undefined ? question.visibleToClient : true,
            showInOverview: question.showInOverview !== undefined ? question.showInOverview : false,
          });
          // Restore options if they exist
          if (question.options && Array.isArray(question.options)) {
            const optionsArray = questionGroup.get('options') as FormArray;
            question.options
              .map((option: any) => option.text || option || '')
              .filter((text: string) => !isEmptyQuestionOptionText(text))
              .forEach((text: string) => {
                optionsArray.push(this.fb.control(text));
              });
          }
          this.questions.push(questionGroup);
        });
      if (this.questions.length === 0) {
        this.questions.push(this.createQuestionGroup());
      }
    }

    // Restore photo settings
    if (savedState.photosConfigEnabled !== undefined) {
      this.projectForm.patchValue({ photosConfigEnabled: savedState.photosConfigEnabled });
    }
    if (savedState.photosVisibleInReport !== undefined) {
      this.projectForm.patchValue({ photosVisibleInReport: savedState.photosVisibleInReport });
    }
    if (savedState.photoStyle !== undefined) {
      this.projectForm.patchValue({ photoStyle: savedState.photoStyle });
    }
    if (savedState.beforeImageCount !== undefined) {
      this.projectForm.patchValue({ beforeImageCount: savedState.beforeImageCount });
    }
    if (savedState.afterImageCount !== undefined) {
      this.projectForm.patchValue({ afterImageCount: savedState.afterImageCount });
    }
    if (savedState.beforeImagesUnlimited !== undefined) {
      this.projectForm.patchValue({ beforeImagesUnlimited: savedState.beforeImagesUnlimited });
    }
    if (savedState.afterImagesUnlimited !== undefined) {
      this.projectForm.patchValue({ afterImagesUnlimited: savedState.afterImagesUnlimited });
    }
    if (savedState.photoImageNamePattern !== undefined) {
      this.projectForm.patchValue({ photoImageNamePattern: savedState.photoImageNamePattern });
    }
    if (savedState.extendedPhotosVisibleInReport !== undefined) {
      this.projectForm.patchValue({ extendedPhotosVisibleInReport: savedState.extendedPhotosVisibleInReport });
    }
    this.applyMainPhotoStyleCounts(this.projectForm.get('photoStyle')?.value || '');

    // Restore photo sections
    if (savedState.photoSections && savedState.photoSections.length > 0) {
      // Clear existing photo sections
      while (this.photoSections.length > 0) {
        this.photoSections.removeAt(0);
      }
      // Restore photo sections
      savedState.photoSections.forEach((section: any) => {
        const sectionGroup = this.createPhotoSectionGroup();
        sectionGroup.patchValue({
          photoType: section.photoType ?? '',
          beforeImageCount: section.beforeImageCount ?? 1,
          afterImageCount: section.afterImageCount ?? 1,
          beforeImagesUnlimited: section.beforeImagesUnlimited ?? false,
          afterImagesUnlimited: section.afterImagesUnlimited ?? false,
        });
        // Restore descriptions
        if (section.descriptions && Array.isArray(section.descriptions)) {
          const descriptionsArray = sectionGroup.get('descriptions') as FormArray;
          // Clear default description
          while (descriptionsArray.length > 0) {
            descriptionsArray.removeAt(0);
          }
          section.descriptions.forEach((desc: string) => {
            descriptionsArray.push(this.fb.control(desc || ''));
          });
        }
        this.applyPhotoSectionCounts(sectionGroup, sectionGroup.get('photoType')?.value || '');
        this.photoSections.push(sectionGroup);
      });
    }

    // Restore accordion state
    if (savedState.activeAccordionValue) {
      this.activeAccordionValue = [...savedState.activeAccordionValue];
    }
  }

  private checkForNewContactAfterUsersLoad(): void {
    // Check if we're returning from contact creation
    // Use window.history.state as it persists after navigation
    const state = (window.history as any).state;

    if (state?.newContactEmail) {
      this.selectNewContact(state.newContactEmail);
      // Clear the state after using it
      if (window.history && (window.history as any).replaceState) {
        (window.history as any).replaceState({ ...state, newContactEmail: undefined }, '');
      }
    }

    // Handle new client contact by email (from contact-person-add component)
    if (state?.newClientContactEmail) {
      this.selectNewClientContactByEmail(state.newClientContactEmail);
      // Clear the state after using it
      if (window.history && (window.history as any).replaceState) {
        (window.history as any).replaceState({ ...state, newClientContactEmail: undefined }, '');
      }
    }

    // Handle new sales contact by name (from user-add component)
    if (state?.newSalesContactName) {
      this.selectNewSalesContactByName(state.newSalesContactName);
      // Clear the state after using it
      if (window.history && (window.history as any).replaceState) {
        (window.history as any).replaceState({ ...state, newSalesContactName: undefined }, '');
      }
    }
  }

  private selectNewSalesContactByName(contactName: string): void {
    // Add to sales contacts if not already present
    if (!this.salesContactValue.includes(contactName)) {
      // Check if the contact exists in allSalesContacts
      if (this.allSalesContacts.includes(contactName)) {
        this.salesContactValue = [...this.salesContactValue, contactName];
        this.onSalesContactsChanged();
      } else {
        // The user was just created and might not be in the list yet
        // Add it to allSalesContacts and select it
        this.allSalesContacts.push(contactName);
        this.salesContactValue = [...this.salesContactValue, contactName];
        this.onSalesContactsChanged();
      }
    }
  }

  private selectNewClientContactByEmail(email: string): void {
    // Find the user by email - check both sales and non-sales user lists
    let newUser = this.salesUsers.find((user: any) => user.email === email);
    let foundIn = 'salesUsers';
    if (!newUser) {
      newUser = this.nonSalesUsers.find((user: any) => user.email === email);
      foundIn = 'nonSalesUsers';
    }
    if (!newUser) {
      // Fallback to clientUsers for backward compatibility
      newUser = this.clientUsers.find((user: any) => user.email === email);
      foundIn = 'clientUsers';
    }

    if (newUser) {
      const contactName = `${newUser.firstName} ${newUser.lastName}`.trim();
      let isSales = this.isSalesUser(newUser);

      // Also check the navigation state to ensure we respect the isSales flag from creation
      const state = (window.history as any).state;
      if (state?.newClientContactIsSales !== undefined) {
        isSales = state.newClientContactIsSales === true;
      }

      if (isSales) {
        // This is a sales contact - add to sales list
        if (!this.salesContactValue.includes(contactName)) {
          if (!this.allSalesContacts.includes(contactName)) {
            this.allSalesContacts.push(contactName);
          }
          this.salesContactValue = [...this.salesContactValue, contactName];
          this.onSalesContactsChanged();
        }
      } else {
        // This is a non-sales client contact
        if (!this.clientContactValue.includes(contactName)) {
          if (!this.allClientContacts.includes(contactName)) {
            this.allClientContacts.push(contactName);
          }
          this.clientContactValue = [...this.clientContactValue, contactName];
          this.onClientContactsChanged();
        }
      }
    } else {
      // User not found in clientUsers list - this can happen if the API hasn't refreshed yet
      // Try to get the name from the state as a fallback
      const state = (window.history as any).state;
      if (state?.newClientContactName) {
        const contactName = state.newClientContactName;
        const isSalesFromState = state?.newClientContactIsSales === true;

        if (isSalesFromState) {
          if (!this.salesContactValue.includes(contactName)) {
            if (!this.allSalesContacts.includes(contactName)) {
              this.allSalesContacts.push(contactName);
            }
            this.salesContactValue = [...this.salesContactValue, contactName];
            this.onSalesContactsChanged();
          }
        } else {
          if (!this.clientContactValue.includes(contactName)) {
            if (!this.allClientContacts.includes(contactName)) {
              this.allClientContacts.push(contactName);
            }
            this.clientContactValue = [...this.clientContactValue, contactName];
            this.onClientContactsChanged();
          }
        }
      } else {
      }
    }
  }

  private restoreContactValues(): void {
    // Restore contact values from saved state after users are loaded
    const savedState = this.projectCreateStateService.getState();
    if (savedState && this.projectCreateStateService.isCacheValidForClient(this.clientId)) {
      // Restore client contacts
      if (savedState.clientContactValue && savedState.clientContactValue.length > 0) {
        // Verify contacts still exist in loaded users
        const validClientContacts = savedState.clientContactValue.filter((name) => this.allClientContacts.includes(name));
        if (validClientContacts.length > 0) {
          this.clientContactValue = validClientContacts;
          this.onClientContactsChanged();
        }
      }

      // Restore sales contacts
      if (savedState.salesContactValue && savedState.salesContactValue.length > 0) {
        // Verify contacts still exist in loaded users
        const validSalesContacts = savedState.salesContactValue.filter((name) => this.allSalesContacts.includes(name));
        if (validSalesContacts.length > 0) {
          this.salesContactValue = validSalesContacts;
          this.onSalesContactsChanged();
        }
      }
    }
  }

  private selectNewContact(email: string): void {
    // Find the user by email in akzenteUsers
    const newUser = this.akzenteUsers.find((user: any) => user.email === email);
    if (newUser) {
      const contactName = `${newUser.firstName} ${newUser.lastName}`.trim();

      // Add to sales contacts if not already present
      if (!this.salesContactValue.includes(contactName)) {
        this.salesContactValue = [...this.salesContactValue, contactName];
        // Add to allSalesContacts if not already there
        if (!this.allSalesContacts.includes(contactName)) {
          this.allSalesContacts.push(contactName);
        }
        this.onSalesContactsChanged();
      }
    }
  }

  private saveFormState(): void {
    const formValue = this.projectForm.value;

    // Extract questions data (skip empty rows)
    const questionsData = Array.from(this.questions.controls)
      .filter((q) => !this.isQuestionEmpty(q as FormGroup))
      .map((q) => {
        const questionValue = q.value;
        const optionsArray = q.get('options') as FormArray;
        return {
          text: questionValue.text || '',
          answerType: questionValue.answerType || null,
          required: questionValue.required !== undefined ? questionValue.required : true,
          visibleToClient: questionValue.visibleToClient !== undefined ? questionValue.visibleToClient : true,
          showInOverview: questionValue.showInOverview !== undefined ? questionValue.showInOverview : false,
          options: optionsArray.value
            .map((opt: any) => opt.text || opt || '')
            .filter((text: string) => !isEmptyQuestionOptionText(text))
            .map((text: string) => ({ text })),
        };
      });

    // Extract photo sections data
    const photoSectionsData = Array.from(this.photoSections.controls).map((p) => {
      const sectionValue = p.value;
      const descriptionsArray = p.get('descriptions') as FormArray;
      return {
        photoType: sectionValue.photoType || '',
        beforeImageCount: sectionValue.beforeImageCount ?? 1,
        afterImageCount: sectionValue.afterImageCount ?? 1,
        beforeImagesUnlimited: sectionValue.beforeImagesUnlimited ?? false,
        afterImagesUnlimited: sectionValue.afterImagesUnlimited ?? false,
        descriptions: descriptionsArray.value.map((desc: string) => desc || ''),
      };
    });

    const formState = {
      clientId: this.clientId,
      projectName: formValue.projectName || '',
      startDate: formValue.startDate || null,
      endDate: formValue.endDate || null,
      dateRange2: this.dateRange2,
      clientContactValue: [...this.clientContactValue],
      salesContactValue: [...this.salesContactValue],
      selectedClientUserIds: [...this.selectedClientUserIds],
      selectedSalesUserIds: [...this.selectedSalesUserIds],
      questions: questionsData,
      photosConfigEnabled: formValue.photosConfigEnabled !== undefined ? formValue.photosConfigEnabled : false,
      photosVisibleInReport: formValue.photosVisibleInReport !== undefined ? formValue.photosVisibleInReport : true,
      photoStyle: formValue.photoStyle || '',
      beforeImageCount: formValue.beforeImageCount ?? 1,
      afterImageCount: formValue.afterImageCount ?? 1,
      beforeImagesUnlimited: formValue.beforeImagesUnlimited ?? false,
      afterImagesUnlimited: formValue.afterImagesUnlimited ?? false,
      photoImageNamePattern: formValue.photoImageNamePattern || '',
      extendedPhotosVisibleInReport: formValue.extendedPhotosVisibleInReport !== undefined ? formValue.extendedPhotosVisibleInReport : true,
      photoSections: photoSectionsData,
      activeAccordionValue: [...this.activeAccordionValue],
    };

    this.projectCreateStateService.saveFormState(formState);
  }

  private loadData(): void {
    // Get client ID from route parameters
    this.route.params.subscribe((params) => {
      // Convert slug to ID if needed, or get ID from another parameter
      const nextClientId = Number(params['clientId']) || Number(this.selectedClient) || null;
      const hasClientChanged = this.previousClientId !== null && this.previousClientId !== nextClientId;

      if (hasClientChanged) {
        this.resetFormForNewClient();
      }

      this.clientId = nextClientId;
      this.previousClientId = nextClientId;

      // Restore cached form only for the currently opened client
      this.restoreFormState();

      if (this.clientId) {
        this.loadUsersForClient();
      }
    });
  }

  private resetFormForNewClient(): void {
    this.projectForm.reset({
      projectName: '',
      startDate: null,
      endDate: null,
      photosConfigEnabled: false,
      photosVisibleInReport: true,
      photoStyle: '',
      beforeImageCount: 1,
      afterImageCount: 1,
      beforeImagesUnlimited: false,
      afterImagesUnlimited: false,
      photoImageNamePattern: '',
      extendedPhotosVisibleInReport: true,
      extendedPhotoStyle: '',
    });

    // Reset repeated form arrays
    while (this.questions.length > 0) {
      this.questions.removeAt(0);
    }
    this.questions.push(this.createQuestionGroup());

    while (this.photoSections.length > 0) {
      this.photoSections.removeAt(0);
    }
    this.photoSections.push(this.createPhotoSectionGroup());

    // Reset in-memory selections and helper state
    this.dateRange2 = { start: null, end: null };
    this.clientContactValue = [];
    this.salesContactValue = [];
    this.selectedClientUserIds = [];
    this.selectedSalesUserIds = [];
    this.filteredClientContacts = [];
    this.filteredSalesContacts = [];
    this.activeAccordionValue = ['0', '1', '2', '3'];
    this.clientCompanyName = '';
  }

  /**
   * Backend uses both `isSales` and legacy `isSale`; treat either as true.
   */
  private isSalesUser(user: any): boolean {
    return user?.isSales === true || user?.isSale === true;
  }

  private loadUsersForClient(): void {
    this.isLoading = true;

    // Use the same endpoint as client-edit to get users
    this.clientCompanyService
      .getClientCompanyWithRelationships(this.clientId!)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (result) => {
          // Store client company name
          this.clientCompanyName = result.clientCompany?.name || '';

          // Extract the actual arrays from the data property (prefer assignment-aware subsets if present)
          const rawClientUsers: User[] = (result.allUsers?.assignedClientUsers?.data || result.allUsers?.clientUsers?.data || []) as User[];
          const rawAkzenteUsers: any[] = (result.allUsers?.akzenteUsers?.data || []) as any[];

          // Use assignment-aware client users; fallback to clientCompanies check when provided
          this.clientUsers = rawClientUsers.filter((u) => {
            if (!this.clientId) return false;
            if (!Array.isArray(u.clientCompanies)) return true; // already pre-filtered by backend
            return u.clientCompanies.some((c) => c.id === this.clientId);
          });

          // Keep only Akzente users (for backward compatibility, though sales are now client users)
          this.akzenteUsers = rawAkzenteUsers.filter((u) => {
            const assignedToClient = Array.isArray(u.clientCompanies) && u.clientCompanies.some((c: any) => c.id === this.clientId);
            return assignedToClient;
          });

          // Customer contacts: use backend's NON-sales subset (isSales == false)

          this.nonSalesUsers = (result.allUsers?.nonSalesClientUsers?.data as User[]) || [];
          this.allClientContacts = this.nonSalesUsers.map((user) => `${user.firstName} ${user.lastName}`.trim());

          // Sales contacts: use backend's SALES subset (isSales == true)

          this.salesUsers = (result.allUsers?.salesClientUsers?.data as User[]) || [];

          this.allSalesContacts = this.salesUsers.map((user) => `${user.firstName} ${user.lastName}`.trim());

          // After users are loaded, restore contact values and check for new contact
          this.restoreContactValues();
          this.checkForNewContactAfterUsersLoad();
        },
        error: (error) => {
          console.error('❌ Error loading users:', error);
        },
      });
  }

  initForms(): void {
    this.projectForm = this.fb.group({
      projectName: ['', Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      questions: this.fb.array([this.createQuestionGroup()]),
      photosConfigEnabled: [false],
      photosVisibleInReport: [true],
      photoStyle: [''],
      beforeImageCount: [1],
      afterImageCount: [1],
      beforeImagesUnlimited: [false],
      afterImagesUnlimited: [false],
      photoImageNamePattern: [''],
      extendedPhotosVisibleInReport: [true],
      extendedPhotoStyle: [''],
      photoSections: this.fb.array([this.createPhotoSectionGroup()]),
    });

    this.newContactForm = this.fb.group({
      newContactName: ['', Validators.required],
      newContactEmail: ['', [Validators.email]],
      newContactPhone: [''],
      newContactType: [null, Validators.required],
    });
  }

  createQuestionGroup(): FormGroup {
    return this.fb.group({
      text: [''],
      answerType: [null],
      required: [true],
      visibleToClient: [true],
      showInOverview: [false],
      options: this.fb.array([]), // Add options FormArray
    });
  }

  private isQuestionEmpty(question: FormGroup): boolean {
    const text = (question.get('text')?.value || '').trim();
    const answerType = question.get('answerType')?.value;
    return !text && !answerType;
  }

  createPhotoSectionGroup(): FormGroup {
    return this.fb.group({
      photoType: [''],
      beforeImageCount: [1],
      afterImageCount: [1],
      beforeImagesUnlimited: [false],
      afterImagesUnlimited: [false],
      descriptions: this.fb.array([this.fb.control('')]),
    });
  }

  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    this.projectForm.patchValue({
      startDate: range.start,
      endDate: range.end,
    });
    this.dateRange2 = range;
    this.saveFormState();
  }

  get questions(): FormArray {
    return this.projectForm.get('questions') as FormArray;
  }

  get photoSections(): FormArray {
    return this.projectForm.get('photoSections') as FormArray;
  }

  getPhotoTypeControl(index: number): FormControl {
    return (this.photoSections.at(index) as FormGroup).get('photoType') as FormControl;
  }

  togglePhotoStyle(value: 'before-after' | 'after'): void {
    if (!this.projectForm.get('photosConfigEnabled')?.value) {
      return;
    }
    const control = this.projectForm.get('photoStyle');
    const newValue = control?.value === value ? '' : value;
    control?.setValue(newValue);
    this.applyMainPhotoStyleCounts(newValue);
    this.saveFormState();
  }

  onPhotosConfigEnabledChanged(): void {
    if (!this.projectForm.get('photosConfigEnabled')?.value) {
      this.projectForm.patchValue({ photoStyle: '' });
    }
    this.saveFormState();
  }

  deactivatePhotoSectionType(sectionIndex: number): void {
    const control = this.getPhotoTypeControl(sectionIndex);
    control.setValue('');
    this.saveFormState();
  }

  private applyMainPhotoStyleCounts(style: 'before-after' | 'after' | ''): void {
    if (style === 'before-after') {
      this.projectForm.patchValue({
        beforeImageCount: 1,
        afterImageCount: 1,
        beforeImagesUnlimited: false,
        afterImagesUnlimited: false,
      });
      return;
    }

    if (style === 'after') {
      this.projectForm.patchValue({
        beforeImageCount: 0,
        afterImageCount: 1,
        beforeImagesUnlimited: false,
        afterImagesUnlimited: false,
      });
    }
  }

  private applyPhotoSectionCounts(section: FormGroup, style: 'before-after' | 'after' | ''): void {
    if (style === 'before-after') {
      section.patchValue({
        beforeImageCount: 1,
        afterImageCount: 1,
        beforeImagesUnlimited: false,
        afterImagesUnlimited: false,
      });
      return;
    }

    if (style === 'after') {
      section.patchValue({
        beforeImageCount: 0,
        afterImageCount: 1,
        beforeImagesUnlimited: false,
        afterImagesUnlimited: false,
      });
    }
  }

  private getFixedPhotoCounts(isBeforeAfter: boolean): {
    beforeImageCount: number;
    afterImageCount: number;
    beforeImagesUnlimited: boolean;
    afterImagesUnlimited: boolean;
  } {
    return {
      beforeImageCount: isBeforeAfter ? 1 : 0,
      afterImageCount: 1,
      beforeImagesUnlimited: false,
      afterImagesUnlimited: false,
    };
  }

  private resolveImageCount(count: number, unlimited: boolean): number | null {
    return unlimited ? null : Math.max(0, Number(count) || 0);
  }

  private buildAdvancedPhotoEntry(options: {
    descriptions: string[];
    isBeforeAfter: boolean;
    isVisibleInReport: boolean;
    beforeImageCount: number;
    afterImageCount: number;
    beforeImagesUnlimited: boolean;
    afterImagesUnlimited: boolean;
    imageNamePattern?: string;
  }) {
    const beforeCount = options.isBeforeAfter ? this.resolveImageCount(options.beforeImageCount, options.beforeImagesUnlimited) : 0;
    const afterCount = this.resolveImageCount(options.afterImageCount, options.afterImagesUnlimited);

    return {
      labels: buildPersistedPhotoLabels(options.descriptions, options.isBeforeAfter, beforeCount, afterCount, options.imageNamePattern),
      isVisibleInReport: options.isVisibleInReport,
      isBeforeAfter: options.isBeforeAfter,
      beforeImageCount: beforeCount,
      afterImageCount: afterCount,
    };
  }

  togglePhotoSectionType(sectionIndex: number, value: 'before-after' | 'after'): void {
    const section = this.photoSections.at(sectionIndex) as FormGroup;
    const control = this.getPhotoTypeControl(sectionIndex);
    const newValue = control.value === value ? '' : value;
    control.setValue(newValue);
    this.applyPhotoSectionCounts(section, newValue);
    this.saveFormState();
  }

  getDescriptionControls(sectionIndex: number): FormControl[] {
    const descriptionsArray = (this.photoSections.at(sectionIndex) as FormGroup).get('descriptions') as FormArray;
    return descriptionsArray.controls as FormControl[];
  }

  addQuestion(): void {
    const lastQuestion = this.questions.at(this.questions.length - 1) as FormGroup;
    if (this.isQuestionEmpty(lastQuestion)) {
      return;
    }
    this.questions.push(this.createQuestionGroup());
  }

  removeQuestion(index: number): void {
    this.questions.removeAt(index);
  }

  addPhotoSection(): void {
    this.photoSections.push(this.createPhotoSectionGroup());
  }

  addDescription(sectionIndex: number): void {
    const descriptionsArray = (this.photoSections.at(sectionIndex) as FormGroup).get('descriptions') as FormArray;
    descriptionsArray.push(this.fb.control(''));
  }

  /**
   * Removes a photo section at the specified index
   */
  removePhotoSection(index: number): void {
    this.photoSections.removeAt(index);
  }

  /**
   * Removes a description at the specified index within a photo section
   * @param sectionIndex Index of the photo section
   * @param descriptionIndex Index of the description to remove
   */
  removeDescription(sectionIndex: number, descriptionIndex: number): void {
    // Get the photo section
    const section = this.photoSections.at(sectionIndex) as FormGroup;

    // Get descriptions FormArray
    const descriptions = section.get('descriptions') as FormArray;

    // Remove the description at the specified index
    descriptions.removeAt(descriptionIndex);
  }

  showNewContactDialog(type: 'client' | 'sales'): void {
    this.newContactForm.get('newContactType')?.setValue(type);
    this.contactDialogVisible = true;
  }

  addNewContact(): void {
    if (this.newContactForm.valid) {
      const newContactName = this.newContactForm.value.newContactName;

      if (this.newContactForm.value.newContactType === 'client') {
        // Add to client contacts
        this.allClientContacts.push(newContactName);
        this.clientContactValue = [...this.clientContactValue, newContactName];
      } else {
        // Add to sales contacts
        this.allSalesContacts.push(newContactName);
        this.salesContactValue = [...this.salesContactValue, newContactName];
      }

      this.contactDialogVisible = false;
      this.newContactForm.reset();
    }
  }

  searchClientContacts(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredClientContacts = this.allClientContacts.filter((contact) => contact.toLowerCase().includes(query));
  }

  searchSalesContacts(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredSalesContacts = this.allSalesContacts.filter((contact) => contact.toLowerCase().includes(query));
  }

  onClientContactsChanged(): void {
    // Update the selected user IDs based on contact names
    this.selectedClientUserIds = this.clientContactValue
      .map((contactName) => {
        const user = this.clientUsers.find((user) => `${user.firstName} ${user.lastName}`.trim() === contactName);
        return user ? user.id : null;
      })
      .filter((id) => id !== null);

    // Save state when contacts change
    this.saveFormState();
  }

  onSalesContactsChanged(): void {
    // Update the selected user IDs based on contact names
    // Sales contacts are now client users with isSales=true
    this.selectedSalesUserIds = this.salesContactValue
      .map((contactName) => {
        const user = this.clientUsers.find((user) => this.isSalesUser(user) && `${user.firstName} ${user.lastName}`.trim() === contactName);
        return user ? user.id : null;
      })
      .filter((id) => id !== null);

    // Save state when contacts change
    this.saveFormState();
  }

  onSubmit(): void {
    if (this.projectForm.valid) {
      this.isSubmitting = true;

      // Save project name for Excel download
      this.projectName = this.projectForm.get('projectName')?.value || 'Project';

      const photoStyle = this.projectForm.get('photoStyle')?.value;
      const photosConfigEnabled = this.projectForm.get('photosConfigEnabled')?.value === true;
      const imageNamePattern = (this.projectForm.get('photoImageNamePattern')?.value || '').trim();
      const isMainBeforeAfter = photoStyle === 'before-after';
      const mainPhotoCounts = this.getFixedPhotoCounts(isMainBeforeAfter);

      const payload = {
        name: this.projectForm.value.projectName,
        startDate: this.projectForm.value.startDate,
        endDate: this.projectForm.value.endDate,
        clientCompany: { id: this.clientId! },
        clientContactIds: this.selectedClientUserIds,
        salesContactIds: this.selectedSalesUserIds,
        photoImageNamePattern: imageNamePattern || null,
        questions: Array.from(this.questions.controls)
          .filter((q) => !this.isQuestionEmpty(q as FormGroup))
          .map((q) => ({
            questionText: q.get('text')?.value,
            answerType: { id: q.get('answerType')?.value },
            isRequired: q.get('required')?.value,
            isVisibleToClient: q.get('visibleToClient')?.value,
            showInOverview: q.get('showInOverview')?.value,
            options: (q.get('options')?.value || [])
              .map((o: any) => o.text || o)
              .filter((text: string) => !isEmptyQuestionOptionText(text))
              .map((optionText: string, index: number) => ({
                optionText,
                order: index,
              })),
          })),
        photos:
          photosConfigEnabled && photoStyle
            ? [
                {
                  isVisibleInReport: this.projectForm.get('photosVisibleInReport')?.value ?? true,
                  order: 0,
                  isBeforeAfter: photoStyle === 'before-after',
                },
              ]
            : [],
        advancedPhotos: [
          ...(photosConfigEnabled && photoStyle
            ? [
                this.buildAdvancedPhotoEntry({
                  descriptions: ['Foto'],
                  isBeforeAfter: isMainBeforeAfter,
                  isVisibleInReport: this.projectForm.get('photosVisibleInReport')?.value ?? true,
                  beforeImageCount: mainPhotoCounts.beforeImageCount,
                  afterImageCount: mainPhotoCounts.afterImageCount,
                  beforeImagesUnlimited: mainPhotoCounts.beforeImagesUnlimited,
                  afterImagesUnlimited: mainPhotoCounts.afterImagesUnlimited,
                  imageNamePattern,
                }),
              ]
            : []),
          ...Array.from(this.photoSections.controls)
            .filter((p) => p.get('photoType')?.value)
            .map((p) => {
              const isBeforeAfter = p.get('photoType')?.value === 'before-after';
              const sectionCounts = this.getFixedPhotoCounts(isBeforeAfter);
              return this.buildAdvancedPhotoEntry({
                descriptions: p.get('descriptions')?.value || [],
                isBeforeAfter,
                isVisibleInReport: this.projectForm.get('extendedPhotosVisibleInReport')?.value ?? true,
                beforeImageCount: sectionCounts.beforeImageCount,
                afterImageCount: sectionCounts.afterImageCount,
                beforeImagesUnlimited: sectionCounts.beforeImagesUnlimited,
                afterImagesUnlimited: sectionCounts.afterImagesUnlimited,
                imageNamePattern,
              });
            }),
        ],
      };

      // Now send `payload` to your ProjectService
      this.projectService.createProject(payload).subscribe({
        next: (response) => {
          this.projectResponse = response; // Store the response for Excel generation
          this.isSubmitting = false;
          this.successModalVisible = true;
          // Clear state after successful creation
          this.projectCreateStateService.clearState();
          this.downloadExcel(response); // Pass the response to downloadExcel
        },
        error: (error) => {
          console.error('❌ Error creating project:', error);
          this.isSubmitting = false;
          // Optionally, display an error message to the user
        },
      });
    } else {
      // Mark all fields as touched to display validation errors
      this.markFormGroupTouched(this.projectForm);
    }
  }

  // Helper function to mark all form controls as touched
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((c) => {
          if (c instanceof FormGroup) {
            this.markFormGroupTouched(c);
          } else {
            c.markAsTouched();
          }
        });
      }
    });
  }

  // Remove CSV download method and related logic

  // Generate styled Excel file instead of CSV
  downloadExcel(projectResponse?: any): void {
    const response = projectResponse || this.projectResponse;

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Generate headers exactly like the image with proper line breaks
    const headers = [
      'FILIALNUMMER',
      'FILIALE\n(Text)',
      'STRABE +\nHAUSNUM\nMER',
      'PLZ',
      'ORT',
      'LAND',
      'TELEFON\nFILIALE\n(Text)',
      'NOTIZ\n(Text)',
      'MERCHANDISER\n(Text)',
      'BESUCHSDATUM', // plannedOn
      'Report bis', // reportTo
      'Feedback\n1. JA\n2. NEIN', // feedback
    ];

    // Add question headers based on the backend response format
    if (response && response.questions) {
      response.questions.forEach((question: any, index: number) => {
        const questionNumber = index + 1;
        let questionText = question.questionText || `Frage ${questionNumber}`;
        let optionsText = '';
        const answerType = (question.answerType?.name || '').toLowerCase();

        if (answerType === 'boolean') {
          optionsText = '\n1. JA\n2. NEIN';
        } else if (answerType === 'select' || answerType === 'multiple choice' || answerType === 'multiselect') {
          if (question.options && question.options.length > 0) {
            const visibleOptions = question.options.map((option: any) => option.optionText || option.text || '').filter((text: string) => !isEmptyQuestionOptionText(text));
            if (visibleOptions.length > 0) {
              optionsText = '\n' + visibleOptions.map((text: string, optionIndex: number) => `${optionIndex + 1}. ${text}`).join('\n');
            }
          }
        }
        // For text, optionsText remains empty

        headers.push(`FRAGE ${questionNumber}:\n"${questionText}${optionsText}"`);
      });
    }

    // Create header row with styling - no borders, flat design
    const headerRow = headers.map((header) => ({
      v: header,
      s: {
        fill: {
          fgColor: { rgb: 'CCCCCC' },
        },
        font: {
          bold: true,
          color: { rgb: '000000' },
          sz: 10,
        },
        alignment: {
          horizontal: 'center',
          vertical: 'top',
          wrapText: true,
        },
        // No borders - flat design like the image
      },
    }));

    // Add header row to worksheet
    XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A1' });

    // Set column widths based on content type
    const columnWidths = [
      12, // FILIALNUMMER
      12, // FILIALE
      15, // STRABE + HAUSNUMMER
      8, // PLZ
      12, // ORT
      12, // LAND
      15, // TELEFON
      12, // NOTIZ
      15, // MERCHANDISER
      15, // BESUCHSDATUM
      15, // Report bis
      15, // Feedback
    ];

    // Add question column widths (wider for better readability)
    if (response && response.questions) {
      response.questions.forEach(() => {
        columnWidths.push(40); // Set width to 40 for each FRAGE column
      });
    }

    ws['!cols'] = columnWidths.map((width) => ({ width }));
    ws['!rows'] = [{ hpt: 50 }]; // Header row height for wrapped text

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Project Template');

    // Generate filename
    const clientName = this.clientCompanyName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const projectName = this.projectName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${clientName}_${projectName}.xlsx`;

    // Download the file
    XLSX.writeFile(wb, filename);

    // Close modal and navigate back
    this.successModalVisible = false;
    setTimeout(() => {
      if (this.clientId) {
        // Preserve query parameters when navigating back
        const queryParams = { ...this.route.snapshot.queryParams };
        // Pass the new project info in state to highlight it
        this.router.navigate(['/clients', this.clientId], {
          queryParams,
          state: {
            newProjectId: response?.id,
            newProjectName: this.projectName,
          },
        });
      } else {
        this._location.back();
      }
    }, 500);
  }

  // Store the project response for CSV generation
  projectResponse: any = null;

  getOptionsArray(questionIndex: number): FormArray {
    return (this.questions.at(questionIndex) as FormGroup).get('options') as FormArray;
  }

  addOption(questionIndex: number): void {
    const optionsArray = this.getOptionsArray(questionIndex);
    const lastOption = optionsArray.at(optionsArray.length - 1)?.value;
    if (optionsArray.length > 0 && isEmptyQuestionOptionText(lastOption)) {
      return;
    }
    optionsArray.push(this.fb.control(''));
  }

  removeOption(questionIndex: number, optionIndex: number): void {
    this.getOptionsArray(questionIndex).removeAt(optionIndex);
  }

  onAnswerTypeChanged(questionIndex: number): void {
    const question = this.questions.at(questionIndex) as FormGroup;
    const answerType = question.get('answerType')?.value;
    const optionsArray = question.get('options') as FormArray;

    if ((answerType === AnswerTypeEnum.SELECT || answerType === AnswerTypeEnum.MULTISELECT) && optionsArray.length === 0) {
      optionsArray.push(this.fb.control(''));
    } else if (answerType !== AnswerTypeEnum.SELECT && answerType !== AnswerTypeEnum.MULTISELECT) {
      // Clear options if switching to a type that doesn't use them
      while (optionsArray.length) {
        optionsArray.removeAt(0);
      }
    }
  }

  // Debug method for button click
  debugButtonClick(): void {}

  navigateToCreateContact(): void {
    // Save current form state before navigating
    this.saveFormState();

    // Navigate to user add page for Client/Kunde Sales users with isSales pre-checked
    // Pass clientCompanyId to pre-select the company and disable Akzente tab
    const returnToPath = `/clients/${this.clientId}/projects/create`;
    this.router.navigate(['/users/add'], {
      queryParams: {
        returnTo: returnToPath,
        isSales: 'true',
        clientCompanyId: this.clientId,
        clientCompanyName: this.clientCompanyName,
        salesMode: 'true', // Flag to disable Akzente tab
      },
      state: {
        returnTo: returnToPath,
        formState: {
          // We'll restore from state service, but pass returnTo for navigation
        },
      },
    });
  }

  navigateToCreateClientContact(): void {
    // Save current form state before navigating
    this.saveFormState();

    // Navigate to contact person add page for client contacts
    const returnToPath = `/clients/${this.clientId}/projects/create`;
    this.router.navigate(['/users/contact/add', this.clientId], {
      queryParams: {
        returnTo: returnToPath,
        returnToType: 'client', // Flag to indicate we're creating a client contact
      },
      state: {
        returnTo: returnToPath,
        returnToType: 'client',
        formState: {
          // We'll restore from state service, but pass returnTo for navigation
        },
      },
    });
  }

  navigateBack(): void {
    // Save state before navigating back
    this.saveFormState();

    if (this.clientId) {
      // Preserve query parameters when navigating back
      const queryParams = { ...this.route.snapshot.queryParams };
      this.router.navigate(['/clients', this.clientId], { queryParams });
    } else {
      // Fallback to browser history
      this._location.back();
    }
  }
}
