import { environment } from '@env/environment';
import { Component, ViewEncapsulation, Output, EventEmitter, OnInit, ElementRef, HostListener, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators, FormArray } from '@angular/forms';
import { HotToastService } from '@ngneat/hot-toast';
import { ImageItem } from '@app/shared/components/multi-image-upload/multi-image-upload.component';
import { Store } from '@ngrx/store';
import * as AuthSelectors from '@app/@core/store/auth/auth.selectors';
import * as AppDataSelectors from '@app/@core/store/app-data/app-data.selectors';
import {
  ProfileService,
  ProfileUpdateRequest,
  ProfileUpdateResponse,
  ProfileInitialData,
  MerchandiserLanguage,
  MerchandiserReference,
  MerchandiserEducation,
  MerchandiserSpecialization,
  MerchandiserFile,
  MerchandiserFileRecord,
} from '../services/profile.service';
import { MerchandiserFileType } from '@app/auth/enums';
import { PROFILE_DOCUMENT_MAX_FILE_SIZE_BYTES, PROFILE_IMAGE_MAX_FILE_SIZE_BYTES } from '@app/shared/constants/profile-upload.constants';
import { of, forkJoin, throwError } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { phoneValidator } from '@app/@core/utils/form-validators.utility';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (password && confirmPassword && password.value !== confirmPassword.value) {
    confirmPassword.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }

  return null;
};

const parseDateInput = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dotFormatMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (dotFormatMatch) {
      const [, day, month, year] = dotFormatMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month) - 1 && parsed.getDate() === Number(day)) {
        return parsed;
      }
      return null;
    }

    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const referenceDateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const fromDate = control.get('fromDate')?.value;
  const toDate = control.get('toDate')?.value;

  if (!fromDate || !toDate) {
    return null;
  }

  const start = parseDateInput(fromDate);
  const end = parseDateInput(toDate);

  if (!start || !end) {
    return null;
  }

  return end < start ? { invalidDateRange: true } : null;
};

const formatDateForApi = (value: unknown): string | null => {
  const date = parseDateInput(value);
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeFormDate = (value: unknown): Date | null => {
  const date = parseDateInput(value);
  if (!date) {
    return null;
  }

  date.setHours(12, 0, 0, 0);
  return date;
};

const hasReferenceContent = (ref: { company?: string; activity?: string; industry?: string; fromDate?: unknown; toDate?: unknown }): boolean => {
  return !!(ref.company?.trim() || ref.activity?.trim() || ref.industry?.trim() || parseDateInput(ref.fromDate) || parseDateInput(ref.toDate));
};

const hasEducationContent = (edu: { institution?: string; qualification?: string; graduationDate?: unknown }): boolean => {
  return !!(edu.institution?.trim() || edu.qualification?.trim() || parseDateInput(edu.graduationDate));
};

@UntilDestroy()
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ProfileComponent implements OnInit {
  @Output() sidebarToggle = new EventEmitter<void>();
  userName = 'User';
  isProfileMenuOpen = false;

  @ViewChildren('profileButton') profileButtons?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('profileMenu') profileMenus?: QueryList<ElementRef<HTMLElement>>;

  // Form setup
  userForm: FormGroup;
  activeStep: number = 1;

  // UI states
  isLoading = false;
  returnUrl: string;
  isRegistering = false;
  stepErrors: { [key: number]: string } = {};
  isSidebarActive = false;
  successModalVisible = false;
  isStepLoading = false;

  // Dropdown options - loaded from backend
  genderOptions: any[] = [];
  countryOptions: any[] = [];
  cityOptions: any[] = []; // Add this
  allCities: any[] = []; // Store all cities for filtering
  languageOptions: any[] = [];
  languageLevelOptions: any[] = [];
  jobTypeOptions: any[] = [];
  specializationOptions: any[] = [];

  // Cache for grouped specializations to prevent recalculation
  private _groupedSpecializations: Array<{ jobTypeName: string; specializations: any[] }> | null = null;

  // Cache for specialization selection states
  private _specializationSelectionStates: Map<number, boolean> = new Map();

  // Current selections
  selectedCountryId: number | null = null;
  selectedCityId: number | null = null;
  isLoadingCities = false;

  // File arrays
  portraitImages: ImageItem[] = [];
  fullBodyImages: ImageItem[] = [];
  cvFiles: ImageItem[] = [];
  additionalFiles: ImageItem[] = [];

  readonly profileImageMaxBytes = PROFILE_IMAGE_MAX_FILE_SIZE_BYTES;
  readonly profileDocumentMaxBytes = PROFILE_DOCUMENT_MAX_FILE_SIZE_BYTES;

  constructor(
    private readonly _router: Router,
    private readonly _route: ActivatedRoute,
    private readonly _formBuilder: FormBuilder,
    private readonly toast: HotToastService,
    private store: Store,
    private profileService: ProfileService,
  ) {
    this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.initForm();
  }

  ngOnInit(): void {
    // Get user name from store
    this.store
      .select(AppDataSelectors.selectUserDisplayName)
      .pipe(untilDestroyed(this))
      .subscribe((name) => {
        if (name !== 'User') {
          this.userName = name;
        } else {
          this.store
            .select(AuthSelectors.selectUserDisplayName)
            .pipe(untilDestroyed(this))
            .subscribe((authName) => {
              this.userName = authName;
            });
        }
      });

    // Load profile and initial data in one call
    this.loadProfileWithInitialData();
  }

  private initForm() {
    this.userForm = this._formBuilder.group(
      {
        // Step 1: Personal information
        gender: [null],
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        birthDate: [null],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: ['', [phoneValidator()]],
        website: ['', [Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)]],
        postalCode: [''],
        city: [null], // For city selection
        country: [null], // For UI selection only
        nationality: [''],

        // Languages
        languages: this._formBuilder.array([]),

        // Step 2: Job Types and Specializations
        jobTypes: this._formBuilder.array([]),
        specializations: this._formBuilder.array([]),

        // References and Education
        references: this._formBuilder.array([this.createReferenceFormGroup()]),
        education: this._formBuilder.array([this.createEducationFormGroup()]),

        // Step 3: Password
        password: ['', [Validators.minLength(8)]],
        confirmPassword: [''],
      },
      { validators: passwordMatchValidator },
    );

    // Initialize arrays
    this.initializeLanguagesArray();

    // Subscribe to country changes to filter cities
    this.userForm.get('country')?.valueChanges.subscribe((countryId) => {
      this.onCountryChange(countryId);
    });
  }

  /**
   * Handle country selection change
   */
  private onCountryChange(countryId: number | null) {
    this.selectedCountryId = countryId;

    if (countryId) {
      // Filter cities for the selected country
      this.cityOptions = this.allCities.filter((city) => city.country?.id === countryId || city.countryId === countryId);

      // Enable city dropdown
      this.userForm.get('city')?.enable();

      // Clear current city selection if it doesn't belong to the new country
      const currentCityId = this.userForm.get('city')?.value;
      if (currentCityId) {
        const cityStillValid = this.cityOptions.some((city) => city.id === currentCityId);
        if (!cityStillValid) {
          this.userForm.get('city')?.setValue(null);
          this.selectedCityId = null;
        }
      }
    } else {
      // Disable and clear city when no country is selected
      this.cityOptions = [];
      this.userForm.get('city')?.setValue(null);
      this.userForm.get('city')?.disable();
      this.selectedCityId = null;
    }
  }

  private initializeLanguagesArray() {
    const languagesArray = this.userForm.get('languages') as FormArray;
    // Add 3 language slots
    for (let i = 0; i < 3; i++) {
      languagesArray.push(this.createLanguageFormGroup());
    }
  }

  getGroupedSpecializations(): Array<{ jobTypeName: string; specializations: any[] }> {
    if (!this.specializationOptions || this.specializationOptions.length === 0) {
      return [];
    }

    // Check cache first
    if (this._groupedSpecializations) {
      return this._groupedSpecializations;
    }

    // Group specializations by job type
    const grouped = new Map<number, { jobTypeName: string; specializations: any[] }>();

    this.specializationOptions.forEach((spec) => {
      const jobTypeId = spec.jobType?.id;
      const jobTypeName = spec.jobType?.name;

      if (jobTypeId && jobTypeName) {
        if (!grouped.has(jobTypeId)) {
          grouped.set(jobTypeId, {
            jobTypeName: jobTypeName,
            specializations: [],
          });
        }
        grouped.get(jobTypeId)!.specializations.push(spec);
      }
    });

    const result = Array.from(grouped.values());
    this._groupedSpecializations = result; // Cache the result
    return result;
  }

  private updateSpecializationSelectionCache(): void {
    const specializationsArray = this.userForm.get('specializations') as FormArray;
    this._specializationSelectionStates.clear();

    specializationsArray.controls.forEach((control) => {
      const id = control.get('id')?.value;
      const selected = control.get('selected')?.value;
      if (id !== null && id !== undefined) {
        this._specializationSelectionStates.set(id, !!selected);
      }
    });
  }

  isSpecializationSelected(specializationId: number): boolean {
    // Use cached state if available
    if (this._specializationSelectionStates.has(specializationId)) {
      return this._specializationSelectionStates.get(specializationId) || false;
    }

    // Fallback to direct form check
    const specializationsArray = this.userForm.get('specializations') as FormArray;
    return specializationsArray.controls.some((control) => control.get('id')?.value === specializationId && control.get('selected')?.value === true);
  }

  toggleSpecializationSelection(specializationId: number): void {
    const specializationsArray = this.userForm.get('specializations') as FormArray;

    // Find the specialization control
    const specializationControl = specializationsArray.controls.find((control) => control.get('id')?.value === specializationId);

    if (specializationControl) {
      const selectedControl = specializationControl.get('selected');
      if (selectedControl) {
        selectedControl.setValue(!selectedControl.value);
      }
    }

    // Update cache for specialization selection state
    const currentState = this._specializationSelectionStates.get(specializationId) || false;
    this._specializationSelectionStates.set(specializationId, !currentState);
  }

  /**
   * Initialize job types form array with data from backend
   */
  private initializeJobTypesArray() {
    const jobTypesArray = this.userForm.get('jobTypes') as FormArray;

    // Clear existing controls
    while (jobTypesArray.length !== 0) {
      jobTypesArray.removeAt(0);
    }

    // Add all available job types
    this.jobTypeOptions.forEach((jobType) => {
      jobTypesArray.push(this.createJobTypeFormGroup(jobType));
    });
  }

  /**
   * Initialize specializations form array with data from backend
   */
  private initializeSpecializationsArray() {
    const specializationsArray = this.userForm.get('specializations') as FormArray;

    // Clear existing controls
    while (specializationsArray.length !== 0) {
      specializationsArray.removeAt(0);
    }

    // Add all available specializations
    this.specializationOptions.forEach((specialization) => {
      specializationsArray.push(this.createSpecializationFormGroup(specialization));
    });

    // Update selection cache after initializing
    this.updateSpecializationSelectionCache();
  }

  private createLanguageFormGroup(): FormGroup {
    return this._formBuilder.group({
      languageId: [null],
      levelId: [null],
    });
  }

  get languages() {
    return this.userForm.get('languages') as FormArray;
  }

  get jobTypes() {
    return this.userForm.get('jobTypes') as FormArray;
  }

  get specializations() {
    return this.userForm.get('specializations') as FormArray;
  }

  get references() {
    return this.userForm.get('references') as FormArray;
  }

  get education() {
    return this.userForm.get('education') as FormArray;
  }

  private createReferenceFormGroup(): FormGroup {
    return this._formBuilder.group(
      {
        id: [null],
        company: [''],
        activity: [''],
        industry: [''],
        fromDate: [null],
        toDate: [null],
      },
      { validators: referenceDateRangeValidator },
    );
  }

  private createEducationFormGroup(): FormGroup {
    return this._formBuilder.group({
      id: [null],
      institution: [''],
      qualification: [''],
      graduationDate: [null],
    });
  }

  private createJobTypeFormGroup(jobType: any): FormGroup {
    return this._formBuilder.group({
      id: [jobType.id],
      name: [jobType.name],
      selected: [false],
    });
  }

  private createSpecializationFormGroup(specialization: any): FormGroup {
    return this._formBuilder.group({
      id: [specialization.id],
      name: [specialization.name],
      category: [specialization.category],
      selected: [false],
    });
  }

  /**
   * Load profile and initial data in one API call
   * @param showLoader When false, refresh data without the full-page preloader (e.g. after save).
   */
  private loadProfileWithInitialData(showLoader = true) {
    if (showLoader) {
      this.isLoading = true;
    }

    this.profileService
      .getProfileWithInitialData()
      .pipe(
        catchError((error) => {
          console.error('Failed to load profile and initial data:', error);
          this.toast.error('Fehler beim Laden der Daten', {
            position: 'bottom-right',
            duration: 3000,
          });
          return of({
            countries: [],
            cities: [],
            languages: [],
            languageLevels: [],
            jobTypes: [],
            specializations: [],
            industryTypes: [],
            genderOptions: [],
          } as ProfileInitialData);
        }),
        untilDestroyed(this),
      )
      .subscribe((data: ProfileInitialData) => {
        // Set dropdown options
        this.languageOptions = data.languages || [];
        this.countryOptions = data.countries || [];
        this.allCities = data.cities || []; // Store all cities
        this.cityOptions = []; // Will be filtered by country selection
        this.jobTypeOptions = data.jobTypes || [];
        this.languageLevelOptions = data.languageLevels || [];
        this.genderOptions = data.genderOptions || [];
        this.specializationOptions = data.specializations || [];
        // Clear cache when new data is loaded
        this._groupedSpecializations = null;

        // Initialize job types form array
        this.initializeJobTypesArray();

        // Initialize specializations form array
        this.initializeSpecializationsArray();

        // Populate form with profile data if available
        if (data.profile) {
          this.populateForm(data.profile);
        }

        this.isLoading = false;
      });
  }

  /**
   * Toggle job type selection
   */
  toggleJobTypeSelection(index: number) {
    const jobTypeControl = this.jobTypes.at(index);
    const selectedControl = jobTypeControl.get('selected');
    if (selectedControl) {
      selectedControl.setValue(!selectedControl.value);
    }
  }

  onFileRejected(message: string): void {
    this.toast.error(message, {
      position: 'bottom-right',
      duration: 5000,
    });
  }

  // File handling methods (updated names to match German template)
  onPortraitImageChanged(images: ImageItem[]): void {
    this.portraitImages = images;

    // Upload new files immediately
    const newFile = images.find((img) => img.file && !img.fileId);
    if (newFile && newFile.file) {
      this.uploadSingleFile(newFile.file, MerchandiserFileType.PORTRAIT);
    }
  }

  onFullBodyImageChanged(images: ImageItem[]): void {
    this.fullBodyImages = images;

    // Upload new files immediately
    const newFile = images.find((img) => img.file && !img.fileId);
    if (newFile && newFile.file) {
      this.uploadSingleFile(newFile.file, MerchandiserFileType.FULL_BODY_SHOT);
    }
  }

  /**
   * Handle Gesamtaufnahme (full body) image changes
   */
  onGesamtaufnahmeImageChanged(images: ImageItem[]): void {
    this.fullBodyImages = images;

    // Upload new files immediately
    const newFile = images.find((img) => img.file && !img.fileId);
    if (newFile && newFile.file) {
      this.uploadSingleFile(newFile.file, MerchandiserFileType.FULL_BODY_SHOT);
    }
  }

  onCvChanged(files: ImageItem[]): void {
    this.cvFiles = files;

    // Upload new files immediately
    const newFile = files.find((file) => file.file && !file.fileId);
    if (newFile && newFile.file) {
      this.uploadSingleFile(newFile.file, MerchandiserFileType.RESUME);
    }
  }

  /**
   * Handle Lebenslauf (CV) file changes
   */
  onLebenslaufChanged(files: ImageItem[]): void {
    this.cvFiles = files;

    // Upload new files immediately
    const newFile = files.find((file) => file.file && !file.fileId);
    if (newFile && newFile.file) {
      this.uploadSingleFile(newFile.file, MerchandiserFileType.RESUME);
    }
  }

  onAdditionalFilesChanged(files: ImageItem[]): void {
    this.additionalFiles = files;

    // Upload new files immediately
    const newFiles = files.filter((file) => file.file && !file.fileId);
    newFiles.forEach((file) => {
      if (file.file) {
        this.uploadSingleFile(file.file, MerchandiserFileType.ADDITIONAL_ATTACHMENTS);
      }
    });
  }

  /**
   * Handle Weitere Anhang (additional files) changes
   */
  onWeitereAnhangChanged(files: ImageItem[]): void {
    this.additionalFiles = files;

    // Upload new files immediately
    const newFiles = files.filter((file) => file.file && !file.fileId);
    newFiles.forEach((file) => {
      if (file.file) {
        this.uploadSingleFile(file.file, MerchandiserFileType.ADDITIONAL_ATTACHMENTS);
      }
    });
  }

  // Navigation methods
  toggleSidebar(): void {
    this.isSidebarActive = !this.isSidebarActive;
    this.sidebarToggle.emit();
  }

  getInitials(): string {
    if (!this.userName || this.userName === 'User') return 'U';
    const parts = this.userName.split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isProfileMenuOpen) return;

    const target = event.target as Node | null;
    if (!target) return;

    const clickedOnButton = (this.profileButtons?.toArray() || []).some((ref) => ref.nativeElement.contains(target));
    const clickedOnMenu = (this.profileMenus?.toArray() || []).some((ref) => ref.nativeElement.contains(target));

    if (!clickedOnButton && !clickedOnMenu) {
      this.isProfileMenuOpen = false;
    }
  }

  /**
   * Navigate to step and save current step data
   */
  goToStep(nextStep: number) {
    // If going to a previous step, just navigate without validation
    if (nextStep < this.activeStep) {
      this.activeStep = nextStep;
      return;
    }

    // If moving forward, validate and save current step
    if (nextStep > this.activeStep) {
      if (!this.validateStep(this.activeStep)) {
        return;
      }

      // Save current step data before proceeding (except for step 3 which handles files)
      if (this.activeStep < 3) {
        this.isStepLoading = true;
        this.saveCurrentStepData()
          .then(() => {
            this.activeStep = nextStep;
            this.isStepLoading = false;
          })
          .catch((error) => {
            this.isStepLoading = false;
            console.error('Failed to save step data:', error);
            this.toast.error('Fehler beim Speichern der Daten', {
              position: 'bottom-right',
              duration: 3000,
            });
          });
      } else {
        this.activeStep = nextStep;
      }
    } else {
      this.activeStep = nextStep;
    }
  }

  /**
   * Validate the current step of the form
   */
  private validateStep(step: number): boolean {
    switch (step) {
      case 1:
        // Validate personal info (including optional fields that have validators)
        const personalFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'website'];
        let valid = true;
        personalFields.forEach((field) => {
          const control = this.userForm.get(field);
          if (control) {
            control.markAsTouched();
            if (control.invalid) {
              valid = false;
            }
          }
        });

        return valid;
      case 2:
        this.references.controls.forEach((referenceGroup) => {
          referenceGroup.markAllAsTouched();
          referenceGroup.updateValueAndValidity({ onlySelf: true });
        });
        return this.references.valid;
      case 3:
        // Validate password fields if filled
        const password = this.userForm.get('password');
        const confirmPassword = this.userForm.get('confirmPassword');
        if (password && password.value) {
          password.markAsTouched();
          confirmPassword?.markAsTouched();
          if (this.userForm.hasError('passwordMismatch')) {
            return false;
          }
          if (password.invalid || confirmPassword?.invalid) {
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  }

  /**
   * Save current step data to backend
   */
  private async saveCurrentStepData(): Promise<void> {
    // Only validate the current step, not the entire form
    if (!this.validateStep(this.activeStep)) {
      throw new Error('Current step validation failed');
    }

    const stepData = this.prepareStepData(this.activeStep);

    return new Promise((resolve, reject) => {
      this.profileService
        .updateProfile(stepData)
        .pipe(
          catchError((error) => {
            console.error('Step save error:', error);
            reject(error);
            return throwError(() => error);
          }),
          untilDestroyed(this),
        )
        .subscribe({
          next: (response: ProfileUpdateResponse) => {
            if (response?.success) {
              this.toast.success('Daten erfolgreich gespeichert', {
                position: 'bottom-right',
                duration: 2000,
              });
              resolve();
            } else {
              reject(new Error('Save failed'));
            }
          },
          error: (error) => {
            reject(error);
          },
        });
    });
  }

  /**
   * Prepare data for current step only
   */
  private prepareStepData(step: number): ProfileUpdateRequest {
    const formValues = this.userForm.value;

    switch (step) {
      case 1:
        // Step 1: Personal information and languages (languages UI is on this step)
        return {
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          gender: formValues.gender?.id || formValues.gender, // Extract id from gender object
          birthDate: formatDateForApi(formValues.birthDate),
          email: formValues.email,
          phoneNumber: formValues.phoneNumber,
          website: formValues.website,
          postalCode: formValues.postalCode,
          city: formValues.city,
          countryId: formValues.country, // Send countryId for API compatibility
          cityId: formValues.city, // Send cityId (this is what gets stored)
          nationality: formValues.nationality,
          languages: this.prepareLanguagesData(),
        };

      case 2:
        // Step 2: Only qualifications (specializations, languages, references, education)
        // Note: jobTypes are auto-derived from specializations in the backend
        return {
          firstName: formValues.firstName, // Required for API
          lastName: formValues.lastName, // Required for API
          email: formValues.email, // Required for API
          // jobTypes: this.prepareJobTypesData(), // REMOVED: Auto-derived from specializations
          specializations: this.prepareSpecializationsData(),
          languages: this.prepareLanguagesData(),
          references: this.prepareReferencesData(),
          education: this.prepareEducationData(),
        };

      case 3:
        const step3Data: ProfileUpdateRequest = {
          firstName: formValues.firstName, // Required for API
          lastName: formValues.lastName, // Required for API
          email: formValues.email, // Required for API
        };

        if (formValues.password && formValues.password.trim()) {
          step3Data.password = formValues.password;
          step3Data.confirmPassword = formValues.confirmPassword;
        }

        return step3Data;

      default:
        return {
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          email: formValues.email,
        };
    }
  }

  /**
   * Prepare data for step 3 (password and any remaining updates)
   */
  private prepareStep3Data(): ProfileUpdateRequest {
    const formValues = this.userForm.value;

    const data: ProfileUpdateRequest = {
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      email: formValues.email,
    };

    // Add password if provided
    if (formValues.password && formValues.password.trim() !== '') {
      data.password = formValues.password;
      data.confirmPassword = formValues.confirmPassword;
    }

    return data;
  }

  /**
   * Prepare languages data for API submission
   */
  private prepareLanguagesData(): MerchandiserLanguage[] {
    const languagesArray = this.userForm.get('languages') as FormArray;
    return languagesArray.controls
      .map((control) => control.value)
      .filter((lang) => lang.languageId && lang.levelId)
      .map((lang) => ({
        languageId: lang.languageId,
        levelId: lang.levelId,
      }));
  }

  /**
   * Prepare job types data for API submission
   */
  private prepareJobTypesData(): number[] {
    const jobTypesArray = this.userForm.get('jobTypes') as FormArray;
    const selectedJobTypes: number[] = [];

    jobTypesArray.controls.forEach((control, index) => {
      if (control.value.selected && this.jobTypeOptions[index]) {
        selectedJobTypes.push(this.jobTypeOptions[index].id);
      }
    });

    return selectedJobTypes;
  }

  /**
   * Prepare specializations data for API submission
   */
  private prepareSpecializationsData(): MerchandiserSpecialization[] {
    const specializationsArray = this.userForm.get('specializations') as FormArray;
    const selectedSpecializations: MerchandiserSpecialization[] = [];

    specializationsArray.controls.forEach((control, index) => {
      if (control.value.selected && this.specializationOptions[index]) {
        selectedSpecializations.push({
          specializationTypeId: this.specializationOptions[index].id,
        });
      }
    });

    return selectedSpecializations;
  }

  /**
   * Prepare references data for API submission
   */
  private prepareReferencesData(): MerchandiserReference[] {
    const referencesArray = this.userForm.get('references') as FormArray;
    return referencesArray.controls
      .map((control) => control.value)
      .filter((ref) => hasReferenceContent(ref))
      .map((ref) => ({
        id: ref.id ?? undefined,
        company: ref.company?.trim() || '',
        activity: ref.activity?.trim() || '',
        industry: ref.industry?.trim() || '',
        fromDate: formatDateForApi(ref.fromDate),
        toDate: formatDateForApi(ref.toDate),
      }));
  }

  /**
   * Prepare education data for API submission
   */
  private prepareEducationData(): MerchandiserEducation[] {
    const educationArray = this.userForm.get('education') as FormArray;

    const educationData = educationArray.controls
      .map((control) => {
        return control.value;
      })
      .filter((edu) => hasEducationContent(edu))
      .map((edu) => ({
        id: edu.id ?? undefined,
        institution: edu.institution?.trim() || '',
        qualification: edu.qualification?.trim() || '',
        graduationDate: formatDateForApi(edu.graduationDate),
      }));

    return educationData;
  }

  /**
   * Save profile with files (Step 3 completion).
   * Uses step-specific validation — not the entire form — because optional fields
   * (e.g. website) can be invalid while step 1 navigation still allowed proceeding.
   */
  saveProfile() {
    if (!this.validateStep(3)) {
      this.toast.error('Bitte prüfen Sie die Passwort-Eingaben', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    if (this.portraitImages.length === 0) {
      this.toast.error('Bitte laden Sie ein Portrait hoch', {
        position: 'bottom-right',
        duration: 3000,
      });
      return;
    }

    this.isRegistering = true;

    // Check if there are any new files to upload
    const hasNewFiles = this.hasNewFilesToUpload();

    if (hasNewFiles) {
      console.log('Step 3: Uploading remaining new files');

      this.uploadAllFiles()
        .pipe(
          switchMap((uploadResult: MerchandiserFileRecord[] | null) => {
            if (uploadResult && uploadResult.length > 0) {
              console.log('Files uploaded successfully via batch upload');
              return of({ success: true, message: 'Files uploaded successfully' });
            }
            if (uploadResult === null) {
              return of({ success: true, message: 'No files to upload' });
            }
            return of({ success: false, message: 'File upload failed' });
          }),
          catchError((error) => {
            console.error('File upload error:', error);
            this.isRegistering = false;
            this.toast.error(error?.message || 'Fehler beim Hochladen der Dateien', { position: 'bottom-right', duration: 5000 });
            return of(null);
          }),
          untilDestroyed(this),
        )
        .subscribe((response: { success: boolean; message?: string }) => {
          this.isRegistering = false;
          if (response?.success) {
            // Refetch profile data without blocking the success modal.
            this.loadProfileWithInitialData(false);

            // Keep user on profile page but move out of step 3 after saving.
            this.activeStep = 1;
            this.successModalVisible = true;
            this.toast.success('Dateien erfolgreich hochgeladen', {
              position: 'bottom-right',
              duration: 3000,
            });
          }
        });
    } else {
      // No new files to upload, just show success
      this.isRegistering = false;
      // Keep user on profile page but move out of step 3 after saving.
      this.activeStep = 1;
      this.successModalVisible = true;
      this.toast.success('Profil ist bereits vollständig', {
        position: 'bottom-right',
        duration: 3000,
      });
    }
  }

  /**
   * Check if there are new files that need to be uploaded
   */
  private hasNewFilesToUpload(): boolean {
    const hasNewPortrait = this.portraitImages.some((img) => img.file && !img.fileId);
    const hasNewFullBody = this.fullBodyImages.some((img) => img.file && !img.fileId);
    const hasNewCV = this.cvFiles.some((file) => file.file && !file.fileId);
    const hasNewAdditional = this.additionalFiles.some((file) => file.file && !file.fileId);

    return hasNewPortrait || hasNewFullBody || hasNewCV || hasNewAdditional;
  }

  /**
   * Upload all new files in a single batch request (only files that don't have fileId)
   */
  private uploadAllFiles() {
    const filesToUpload: Array<{ file: File; fileType: MerchandiserFileType }> = [];

    // Only upload files that don't have fileId (new files)
    if (this.portraitImages.length > 0 && this.portraitImages[0].file && !this.portraitImages[0].fileId) {
      filesToUpload.push({
        file: this.portraitImages[0].file,
        fileType: MerchandiserFileType.PORTRAIT,
      });
    }

    if (this.fullBodyImages.length > 0 && this.fullBodyImages[0].file && !this.fullBodyImages[0].fileId) {
      filesToUpload.push({
        file: this.fullBodyImages[0].file,
        fileType: MerchandiserFileType.FULL_BODY_SHOT,
      });
    }

    if (this.cvFiles.length > 0 && this.cvFiles[0].file && !this.cvFiles[0].fileId) {
      filesToUpload.push({
        file: this.cvFiles[0].file,
        fileType: MerchandiserFileType.RESUME,
      });
    }

    this.additionalFiles.forEach((fileItem, index) => {
      if (fileItem.file && !fileItem.fileId) {
        filesToUpload.push({
          file: fileItem.file,
          fileType: MerchandiserFileType.ADDITIONAL_ATTACHMENTS,
        });
      }
    });

    if (filesToUpload.length === 0) {
      console.log('No new files to upload');
      return of(null);
    }

    console.log(`Uploading ${filesToUpload.length} new files in a single batch request`);

    // Use the new batch upload method
    return this.profileService.uploadAllFiles(filesToUpload).pipe(
      tap((response) => {
        console.log('✅ All new files uploaded successfully:', response);
        this.toast.success('Alle neuen Dateien erfolgreich hochgeladen!', {
          position: 'bottom-right',
          duration: 3000,
        });
      }),
      catchError((error) => {
        console.error('❌ Batch file upload failed:', error);
        this.toast.error(`Fehler beim Hochladen der Dateien: ${error?.message || 'Unbekannter Fehler'}`, { position: 'bottom-right', duration: 5000 });
        return of(null);
      }),
    );
  }

  /**
   * Upload individual file immediately when selected
   */
  private uploadSingleFile(file: File, fileType: MerchandiserFileType): void {
    this.profileService.uploadFile(file, fileType).subscribe({
      next: (response: MerchandiserFileRecord[]) => {
        console.log('File uploaded successfully:', response);
        this.toast.success('Datei erfolgreich hochgeladen');

        // Refetch profile data without blocking the page (keeps save button usable).
        this.loadProfileWithInitialData(false);
      },
      error: (error) => {
        console.error('Error uploading file:', error);
        this.removeFileFromArray(this.mapFileTypeToKey(fileType), 0);
        this.toast.error(this.getUploadErrorMessage(error), {
          position: 'bottom-right',
          duration: 5000,
        });
      },
    });
  }

  /**
   * Populate form with existing profile data
   */
  private populateForm(profile: any) {
    if (!profile) return;

    // Set the selected country and city IDs first
    this.selectedCountryId = profile.countryId;
    this.selectedCityId = profile.cityId;

    // Filter cities based on the country
    if (this.selectedCountryId) {
      this.cityOptions = this.allCities.filter((city) => city.country?.id === this.selectedCountryId || city.countryId === this.selectedCountryId);
    }

    // Find the gender option object that matches the profile gender string
    const genderOption = this.genderOptions.find((option) => option.id === profile.gender);

    // Parse birthDate string to Date object
    let birthDate = normalizeFormDate(profile.birthDate);

    this.userForm.patchValue({
      gender: genderOption || null, // Set the full gender object, not just the string
      firstName: profile.firstName,
      lastName: profile.lastName,
      birthDate: birthDate, // Set as Date object
      email: profile.email,
      phoneNumber: profile.phoneNumber,
      website: profile.website,
      postalCode: profile.postalCode,
      city: profile.cityId, // Set city for dropdown
      country: profile.countryId, // Set country for dropdown
      nationality: profile.nationality,
    });

    // Enable city dropdown if country is selected
    if (this.selectedCountryId) {
      this.userForm.get('city')?.enable();
    } else {
      this.userForm.get('city')?.disable();
    }

    // Populate languages array
    if (profile.languages && profile.languages.length > 0) {
      const languagesArray = this.userForm.get('languages') as FormArray;
      languagesArray.clear();

      profile.languages.forEach((lang: any) => {
        const langGroup = this.createLanguageFormGroup();
        langGroup.patchValue({
          languageId: lang.languageId,
          levelId: lang.levelId,
        });
        languagesArray.push(langGroup);
      });
    }

    // Populate job types - mark as selected if they exist in profile
    if (profile.jobTypes && profile.jobTypes.length > 0) {
      const jobTypesArray = this.userForm.get('jobTypes') as FormArray;
      const profileJobTypeIds = profile.jobTypes.map((jt: any) => jt.id);

      jobTypesArray.controls.forEach((control) => {
        const jobTypeId = control.get('id')?.value;
        if (profileJobTypeIds.includes(jobTypeId)) {
          control.get('selected')?.setValue(true);
        }
      });
    }

    // Populate specializations - mark as selected if they exist in profile
    if (profile.specializations && profile.specializations.length > 0) {
      const specializationsArray = this.userForm.get('specializations') as FormArray;
      const profileSpecializationIds = profile.specializations.map((spec: any) => spec.specialization.id);

      specializationsArray.controls.forEach((control) => {
        const specializationId = control.get('id')?.value;
        if (profileSpecializationIds.includes(specializationId)) {
          control.get('selected')?.setValue(true);
        }
      });

      // Update the cache after setting selected values
      this.updateSpecializationSelectionCache();
    }

    // Populate references
    const referencesArray = this.userForm.get('references') as FormArray;
    if (profile.references && profile.references.length > 0) {
      referencesArray.clear();

      profile.references.forEach((ref: any) => {
        const refGroup = this.createReferenceFormGroup();
        refGroup.patchValue({
          id: ref.id ?? null,
          company: ref.company,
          activity: ref.activity,
          industry: ref.industry ?? ref.branche ?? '',
          fromDate: normalizeFormDate(ref.fromDate ?? ref.startDate),
          toDate: normalizeFormDate(ref.toDate ?? ref.endDate),
        });
        referencesArray.push(refGroup);
      });
    }

    // Populate education
    const educationArray = this.userForm.get('education') as FormArray;
    if (profile.education && profile.education.length > 0) {
      educationArray.clear();

      profile.education.forEach((edu: any) => {
        const eduGroup = this.createEducationFormGroup();

        eduGroup.patchValue({
          id: edu.id ?? null,
          institution: edu.institution,
          qualification: edu.qualification,
          graduationDate: normalizeFormDate(edu.graduationDate),
        });

        educationArray.push(eduGroup);
      });
    }

    // Populate files - convert existing uploaded files to ImageItem format
    if (profile.files && profile.files.length > 0) {
      this.populateUploadedFiles(profile.files);
    }
  }

  /**
   * Convert relative file path to full URL
   */
  private getFullFileUrl(path: string): string {
    console.log('🔗 getFullFileUrl called with path:', path);

    if (!path) {
      console.log('⚠️ Empty path provided');
      return '';
    }

    // If path already starts with http:// or https://, return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      console.log('✅ Path is already a full URL:', path);
      return path;
    }

    // Otherwise, prepend the base URL (without /api/v1)
    const baseUrl = new URL(environment.apiUrl, window.location.origin).origin;
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${baseUrl}${normalizedPath}`;
    console.log('✅ Converted to full URL:', fullUrl);
    return fullUrl;
  }

  /**
   * Populate uploaded files from profile data into ImageItem arrays
   */
  private populateUploadedFiles(files: any[]) {
    console.log('📁 populateUploadedFiles called with files:', files);

    // Reset all file arrays
    this.portraitImages = [];
    this.fullBodyImages = [];
    this.cvFiles = [];
    this.additionalFiles = [];

    let additionalFileIndex = 0;

    files.forEach((fileData: any, index: number) => {
      console.log(`\n📄 Processing file ${index + 1}/${files.length}:`, {
        id: fileData.id,
        type: fileData.type,
        filePath: fileData.file?.path,
        fullFileData: fileData,
      });

      const fileName = this.extractFileNameFromPath(fileData.file.path);
      const isImage = this.isImageFile(fileName);

      console.log(`  ℹ️ File info:`, {
        fileName,
        isImage,
        fileExtension: fileName.substring(fileName.lastIndexOf('.')),
      });

      const imageItem: ImageItem = {
        id: fileData.id,
        fileName: fileName,
        preview: isImage ? this.getFullFileUrl(fileData.file.path) : undefined, // Convert to full URL for images
        label: fileName,
        isImage: isImage,
        fileId: fileData.id, // Add fileId for deletion functionality
        // Note: We don't have the actual File object for existing files
        // The file upload component should handle this case
      };

      console.log(`  ✅ Created ImageItem:`, imageItem);

      // Distribute files to appropriate arrays based on type
      switch (fileData.type) {
        case 'portrait':
          console.log('  📷 Adding to portraitImages');
          this.portraitImages.push(imageItem);
          break;
        case 'full_body_shot':
          console.log('  🧍 Adding to fullBodyImages');
          this.fullBodyImages.push(imageItem);
          break;
        case 'resume':
          console.log('  📄 Adding to cvFiles');
          this.cvFiles.push(imageItem);
          break;
        case 'additional_attachments':
          console.log('  📎 Adding to additionalFiles');
          imageItem.order = additionalFileIndex;
          this.additionalFiles.push(imageItem);
          additionalFileIndex++;
          break;
        default:
          console.warn('⚠️ Unknown file type:', fileData.type);
          break;
      }
    });

    console.log('\n✅ Final populated file arrays:', {
      portrait: this.portraitImages.length,
      portraitImages: this.portraitImages,
      fullBody: this.fullBodyImages.length,
      fullBodyImages: this.fullBodyImages,
      cv: this.cvFiles.length,
      cvFiles: this.cvFiles,
      additional: this.additionalFiles.length,
      additionalFiles: this.additionalFiles,
    });
  }

  /**
   * Extract filename from file path URL
   */
  private extractFileNameFromPath(filePath: string): string {
    console.log('📝 extractFileNameFromPath called with:', filePath);

    if (!filePath) {
      console.log('⚠️ No file path provided');
      return 'Unknown file';
    }

    // Extract filename from URL path
    const urlParts = filePath.split('/');
    const fileName = urlParts[urlParts.length - 1];

    console.log('  Extracted fileName:', fileName);

    // If it has an extension, return as is, otherwise add a generic extension
    if (fileName.includes('.')) {
      console.log('  ✅ File has extension, returning:', fileName);
      return fileName;
    }

    const result = `${fileName}.file`;
    console.log('  ⚠️ No extension found, returning:', result);
    return result;
  }

  /**
   * Check if file is an image based on file extension
   */
  private isImageFile(fileName: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    const isImage = imageExtensions.includes(fileExtension);

    console.log('🖼️ isImageFile check:', {
      fileName,
      fileExtension,
      isImage,
      supportedExtensions: imageExtensions,
    });

    return isImage;
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  closeModal(): void {
    this.successModalVisible = false;
    // Leave edit mode (step 3) and show saved profile overview on step 1.
    this.activeStep = 1;
  }

  goToDashboard(): void {
    this.successModalVisible = false;
    this._router.navigate(['/dashboard']);
  }

  // Additional methods
  addReference() {
    this.references.push(this.createReferenceFormGroup());
  }

  removeReference(index: number) {
    if (index > 0) {
      this.references.removeAt(index);
    }
  }

  addEducation() {
    this.education.push(this.createEducationFormGroup());
  }

  removeEducation(index: number) {
    if (index > 0) {
      this.education.removeAt(index);
    }
  }

  onBirthDateSelected(date: Date | string | null) {
    this.userForm.patchValue({ birthDate: normalizeFormDate(date) });
  }

  onFromDateSelected(index: number, date: Date | string | null) {
    const referenceGroup = this.references.at(index);
    referenceGroup.patchValue({ fromDate: normalizeFormDate(date) });
    referenceGroup.updateValueAndValidity();
  }

  onToDateSelected(index: number, date: Date | string | null) {
    const referenceGroup = this.references.at(index);
    referenceGroup.patchValue({ toDate: normalizeFormDate(date) });
    referenceGroup.updateValueAndValidity();
  }

  ongraduationDateSelected(index: number, date: Date | string | null) {
    this.education.at(index).patchValue({ graduationDate: normalizeFormDate(date) });
  }

  getFromDate(index: number): Date | null {
    return normalizeFormDate(this.references.at(index).get('fromDate')?.value);
  }

  getToDate(index: number): Date | null {
    return normalizeFormDate(this.references.at(index).get('toDate')?.value);
  }

  getgraduationDate(index: number): Date | null {
    return normalizeFormDate(this.education.at(index).get('graduationDate')?.value);
  }

  /**
   * Handle file deletion from upload component
   */
  onFileDeleted(event: { fileId: number; index: number }, fileType: string): void {
    this.profileService.deleteFile(event.fileId).subscribe({
      next: (response) => {
        console.log('File deleted successfully:', response);
        this.toast.success('Datei erfolgreich gelöscht');

        // Remove file from appropriate array and clear the upload component row
        this.removeFileFromArray(fileType, event.index);

        // Refetch profile data without blocking the page.
        this.loadProfileWithInitialData(false);
      },
      error: (error) => {
        console.error('Error deleting file:', error);
        this.toast.error('Fehler beim Löschen der Datei');
      },
    });
  }

  /**
   * Remove file from appropriate array based on file type
   */
  private removeFileFromArray(fileType: string, index: number): void {
    switch (fileType) {
      case 'portrait':
        this.portraitImages = [];
        break;
      case 'full_body_shot':
        this.fullBodyImages = [];
        break;
      case 'resume':
        this.cvFiles = [];
        break;
      case 'additional_attachments':
        // For additional files, remove specific index
        this.additionalFiles = this.additionalFiles.filter((_, i) => i !== index);
        break;
    }
  }

  navigateToDashboard(event: Event): void {
    event.preventDefault();
    this._router.navigate(['/dashboard']);
  }

  private mapFileTypeToKey(fileType: MerchandiserFileType): string {
    switch (fileType) {
      case MerchandiserFileType.PORTRAIT:
        return 'portrait';
      case MerchandiserFileType.FULL_BODY_SHOT:
        return 'full_body_shot';
      case MerchandiserFileType.RESUME:
        return 'resume';
      case MerchandiserFileType.ADDITIONAL_ATTACHMENTS:
        return 'additional_attachments';
      default:
        return 'portrait';
    }
  }

  private getUploadErrorMessage(error: { status?: number; message?: string; data?: { message?: string; errors?: { message?: string; file?: string } } }): string {
    const serverMessage = error?.data?.message || error?.data?.errors?.message || error?.message;

    if (error?.status === 408) {
      return 'Der Upload hat zu lange gedauert. Bitte verwenden Sie ein kleineres Bild und versuchen Sie es erneut.';
    }

    if (error?.status === 413) {
      return serverMessage || 'Die Datei ist zu groß. Maximal 30 MB sind erlaubt.';
    }

    if (serverMessage && serverMessage !== 'Server Error') {
      return serverMessage;
    }

    return 'Fehler beim Hochladen der Datei. Bitte prüfen Sie die Dateigröße (max. 30 MB für Bilder).';
  }
}
