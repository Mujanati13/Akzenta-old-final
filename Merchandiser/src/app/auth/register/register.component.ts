import { Component, TemplateRef, ViewChild, ViewEncapsulation, OnInit, OnDestroy, ChangeDetectorRef, Inject, Renderer2, HostListener } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AuthenticationService } from '../services/authentication.service';
import { AuthStateService, AuthState } from '../services/auth-state.service';
import { ApiService } from '@app/core/services/api.service';
import { filter, take, switchMap, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { HotToastService } from '@ngneat/hot-toast';
import { of } from 'rxjs';
import { phoneValidator } from '@app/@core/utils/form-validators.utility';

// Updated interfaces for the API response
interface Country {
  id: number;
  name?: string; // Make name optional since it's missing from API
  flag: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobType {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface City {
  id: number;
  name: string;
  country?: any;
}

interface MerchandiserRegisterData {
  countries: Country[];
  jobTypes: JobType[];
}

// Add interface for registration request
interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  zipCode?: string;
  cityId?: number; // Changed from city to cityId
  countryId?: number;
  cityName?: string;
  countryName?: string;
  jobTypeIds: number[]; // Array of selected job type IDs
}

// Add interface for registration response (if any)
interface RegisterResponse {
  message?: string;
  /** false when the account was created but sending the confirmation email failed */
  confirmationEmailSent?: boolean;
}

@UntilDestroy()
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class RegisterComponent implements OnInit, OnDestroy {
  // Form setup
  userForm: FormGroup;
  @ViewChild('emailVerificationToast', { static: true })
  emailVerificationToast!: TemplateRef<any>;

  // Stepper properties
  activeStep: number = 1;

  // Form fields
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  loginError = '';
  emailDuplicateError = false;
  emailDuplicateMessage = '';
  firstName = '';
  lastName = '';
  phone = '';
  zipCode = '';
  city = '';

  // Preferences/settings
  remember = true;

  // UI states
  isLoading = false;
  isLoadingCities = false;
  returnUrl: string;
  isRegistering = false;
  registrationSuccess = false;
  /** Set from API; false if confirmation mail could not be sent (account still created) */
  confirmationEmailSent = true;
  registeredEmail = '';
  stepErrors: { [key: number]: string } = {};

  // Data from API
  countries: Country[] = [];
  jobTypes: JobType[] = [];
  cities: City[] = [];

  // Dropdown options
  countryOptions: { id: number; name: string }[] = [];
  filteredCitySuggestions: { id: number; name: string }[] = [];
  selectedCityOption: { id: number; name: string } | null = null;

  private readonly cityDisplayLimit = 50;
  private allCityOptions: { id: number; name: string }[] = [];
  private cityOptionsCache = new Map<number, { id: number; name: string }[]>();

  // Phone country codes
  phoneCountryCodes = [
    { label: '🇩🇪 +49', code: '+49' },
    { label: '🇦🇹 +43', code: '+43' },
    { label: '🇨🇭 +41', code: '+41' },
    { label: '🇱🇺 +352', code: '+352' },
    { label: '🇫🇷 +33', code: '+33' },
    { label: '🇮🇹 +39', code: '+39' },
    { label: '🇪🇸 +34', code: '+34' },
    { label: '🇳🇱 +31', code: '+31' },
    { label: '🇧🇪 +32', code: '+32' },
    { label: '🇵🇱 +48', code: '+48' },
    { label: '🇨🇿 +420', code: '+420' },
    { label: '🇩🇰 +45', code: '+45' },
    { label: '🇸🇪 +46', code: '+46' },
    { label: '🇳🇴 +47', code: '+47' },
    { label: '🇬🇧 +44', code: '+44' },
  ];
  selectedPhoneCode = '+49';

  // Form fields
  selectedCountryId: number | null = null;
  selectedCityId: number | null = null;

  // Mobile specific
  activeField: string | null = null;
  // @ViewChildren('mobileInput') mobileInputs!: QueryList<ElementRef>; // No longer needed

  private readonly stepFields: { [key: number]: string[] } = {
    1: ['firstName', 'lastName', 'email', 'phone', 'zipCode'],
    2: [], // checkboxes
    3: ['password', 'confirmPassword'],
  };

  constructor(
    private readonly _router: Router,
    private readonly _route: ActivatedRoute,
    private readonly _authService: AuthenticationService,
    private readonly cdr: ChangeDetectorRef,
    private readonly _authStateService: AuthStateService,
    private readonly _formBuilder: FormBuilder,
    private readonly toast: HotToastService,
    private readonly apiService: ApiService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.initForm();
  }

  ngOnInit() {
    this.loadRegistrationData();
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  private loadRegistrationData() {
    this.isLoading = true;

    this.apiService
      .get<MerchandiserRegisterData>('/public/register-data', {}, {}, true)
      .pipe(
        untilDestroyed(this),
        catchError((error) => {
          console.error('Failed to load registration data:', error);
          this.isLoading = false;
          // Use fallback data if API fails
          this.setFallbackData();
          return of(null);
        }),
      )
      .subscribe({
        next: (data) => {
          if (data?.countries?.length && data?.jobTypes?.length) {
            this.countries = this.normalizeCountries(data.countries);
            this.jobTypes = data.jobTypes;
            this.populateDropdownOptions();
            this.updateCustomersFormGroup();
          } else {
            this.setFallbackData();
          }
          this.isLoading = false;
        },
      });
  }

  private loadCities(countryId: number) {
    if (!countryId) return;

    if (this.cityOptionsCache.has(countryId)) {
      this.allCityOptions = this.cityOptionsCache.get(countryId)!;
      this.isLoadingCities = false;
      this.userForm.get('city')?.enable();
      return;
    }

    this.isLoadingCities = true;
    this.allCityOptions = [];

    this.apiService
      .get<City[]>(`/public/countries/${countryId}/cities`, {}, {}, true)
      .pipe(
        untilDestroyed(this),
        catchError((error) => {
          console.error('Failed to load cities:', error);
          this.setCityFallbackData(countryId);
          this.isLoadingCities = false;
          this.userForm.get('city')?.enable();
          return of(null);
        }),
      )
      .subscribe({
        next: (cities) => {
          if (cities && cities.length > 0) {
            const seen = new Set<string>();
            this.allCityOptions = cities
              .map((city) => ({ id: city.id, name: city.name }))
              .filter((city) => {
                const key = city.name.trim().toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              })
              .sort((a, b) => a.name.localeCompare(b.name, 'de'));
          } else {
            this.setCityFallbackData(countryId);
          }

          this.cityOptionsCache.set(countryId, this.allCityOptions);
          this.isLoadingCities = false;
          this.userForm.get('city')?.enable();
        },
      });
  }

  onCitySearch(event: { query: string }) {
    const query = (event.query || '').trim().toLowerCase();
    const cached = this.cityOptionsCache.get(this.selectedCountryId!) || [];

    if (!query) {
      this.filteredCitySuggestions = cached.slice(0, this.cityDisplayLimit);
      return;
    }

    this.filteredCitySuggestions = cached.filter((city) => city.name.toLowerCase().includes(query)).slice(0, this.cityDisplayLimit);
  }

  private normalizeCountries(countries: Country[]): Country[] {
    return countries.map((country) => ({
      ...country,
      name: this.resolveCountryName(country),
    }));
  }

  private resolveCountryName(country: Country): string {
    const name = country.name as unknown;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
    if (name && typeof name === 'object') {
      const localized = name as Record<string, string>;
      return localized['de'] || localized['en'] || localized['fr'] || Object.values(localized).find((value) => !!value?.trim()) || `Land ${country.id}`;
    }
    return `Land ${country.id}`;
  }

  private populateDropdownOptions() {
    this.countryOptions = this.countries
      .map((country) => ({
        id: country.id,
        name: this.resolveCountryName(country),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  private updateCustomersFormGroup() {
    // Dynamically create the customers form group based on jobTypes
    const customersGroup = this._formBuilder.group({});

    this.jobTypes.forEach((jobType) => {
      // Create a control name based on the job type name (convert to camelCase)
      const controlName = this.toCamelCase(jobType.name);
      customersGroup.addControl(controlName, this._formBuilder.control(false));
    });

    // Replace the existing customers form group
    this.userForm.setControl('customers', customersGroup);
  }

  // Made public so it can be used in template
  toCamelCase(str: string): string {
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
  }

  private setFallbackData() {
    if (this.countries.length === 0) {
      this.countries = [
        { id: 1, name: 'Deutschland', flag: null, createdAt: '', updatedAt: '' },
        { id: 2, name: 'Österreich', flag: null, createdAt: '', updatedAt: '' },
        { id: 3, name: 'Schweiz', flag: null, createdAt: '', updatedAt: '' },
        { id: 4, name: 'Luxemburg', flag: null, createdAt: '', updatedAt: '' },
        { id: 5, name: 'Frankreich', flag: null, createdAt: '', updatedAt: '' },
        { id: 6, name: 'Italien', flag: null, createdAt: '', updatedAt: '' },
        { id: 7, name: 'Spanien', flag: null, createdAt: '', updatedAt: '' },
        { id: 8, name: 'Niederlande', flag: null, createdAt: '', updatedAt: '' },
        { id: 9, name: 'Belgien', flag: null, createdAt: '', updatedAt: '' },
        { id: 10, name: 'Polen', flag: null, createdAt: '', updatedAt: '' },
        { id: 11, name: 'Tschechien', flag: null, createdAt: '', updatedAt: '' },
        { id: 12, name: 'Dänemark', flag: null, createdAt: '', updatedAt: '' },
        { id: 13, name: 'Schweden', flag: null, createdAt: '', updatedAt: '' },
        { id: 14, name: 'Norwegen', flag: null, createdAt: '', updatedAt: '' },
        { id: 15, name: 'Ungarn', flag: null, createdAt: '', updatedAt: '' },
        { id: 16, name: 'Kroatien', flag: null, createdAt: '', updatedAt: '' },
        { id: 17, name: 'Slowakei', flag: null, createdAt: '', updatedAt: '' },
        { id: 18, name: 'Slowenien', flag: null, createdAt: '', updatedAt: '' },
        { id: 19, name: 'Rumänien', flag: null, createdAt: '', updatedAt: '' },
        { id: 20, name: 'Bulgarien', flag: null, createdAt: '', updatedAt: '' },
        { id: 21, name: 'Griechenland', flag: null, createdAt: '', updatedAt: '' },
        { id: 22, name: 'Portugal', flag: null, createdAt: '', updatedAt: '' },
        { id: 23, name: 'Irland', flag: null, createdAt: '', updatedAt: '' },
        { id: 24, name: 'Finnland', flag: null, createdAt: '', updatedAt: '' },
        { id: 25, name: 'Litauen', flag: null, createdAt: '', updatedAt: '' },
        { id: 26, name: 'Lettland', flag: null, createdAt: '', updatedAt: '' },
        { id: 27, name: 'Estland', flag: null, createdAt: '', updatedAt: '' },
        { id: 28, name: 'Vereinigtes Königreich', flag: null, createdAt: '', updatedAt: '' },
        { id: 29, name: 'Island', flag: null, createdAt: '', updatedAt: '' },
        { id: 30, name: 'Liechtenstein', flag: null, createdAt: '', updatedAt: '' },
        { id: 31, name: 'Monaco', flag: null, createdAt: '', updatedAt: '' },
        { id: 32, name: 'Malta', flag: null, createdAt: '', updatedAt: '' },
        { id: 33, name: 'Zypern', flag: null, createdAt: '', updatedAt: '' },
        { id: 34, name: 'Serbien', flag: null, createdAt: '', updatedAt: '' },
        { id: 35, name: 'Bosnien und Herzegowina', flag: null, createdAt: '', updatedAt: '' },
        { id: 36, name: 'Albanien', flag: null, createdAt: '', updatedAt: '' },
        { id: 37, name: 'Nordmazedonien', flag: null, createdAt: '', updatedAt: '' },
        { id: 38, name: 'Montenegro', flag: null, createdAt: '', updatedAt: '' },
        { id: 39, name: 'Andorra', flag: null, createdAt: '', updatedAt: '' },
        { id: 40, name: 'San Marino', flag: null, createdAt: '', updatedAt: '' },
        { id: 41, name: 'Vatikanstadt', flag: null, createdAt: '', updatedAt: '' },
      ];
    } else {
      this.countries = this.normalizeCountries(this.countries);
    }

    // Keep existing jobTypes fallback
    if (this.jobTypes.length === 0) {
      this.jobTypes = [
        { id: 1, name: 'Visual Merchandiser', createdAt: '', updatedAt: '' },
        { id: 2, name: 'Sales adviser', createdAt: '', updatedAt: '' },
        { id: 3, name: 'Dekorateur', createdAt: '', updatedAt: '' },
        { id: 4, name: 'Folierung', createdAt: '', updatedAt: '' },
      ];
    }

    this.populateDropdownOptions();
    this.updateCustomersFormGroup();
  }

  private setCityFallbackData(countryId: number) {
    const cityMap: Record<number, string[]> = {
      1: [
        'Berlin',
        'Hamburg',
        'München',
        'Köln',
        'Frankfurt am Main',
        'Stuttgart',
        'Düsseldorf',
        'Leipzig',
        'Dortmund',
        'Essen',
        'Bremen',
        'Dresden',
        'Hannover',
        'Nürnberg',
        'Bonn',
        'Mannheim',
        'Karlsruhe',
        'Wiesbaden',
        'Münster',
        'Aachen',
      ],
      2: ['Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn', 'Bregenz', 'Eisenstadt', 'Leoben', 'Steyr', 'Feldkirch'],
      3: ['Zürich', 'Bern', 'Genf', 'Basel', 'Lausanne', 'Winterthur', 'Luzern', 'St. Gallen', 'Lugano', 'Biel', 'Thun', 'Köniz', 'La Chaux-de-Fonds', 'Freiburg', 'Schaffhausen'],
      4: ['Luxemburg', 'Esch-sur-Alzette', 'Differdingen', 'Düdelingen', 'Ettelbrück', 'Diekirch', 'Wiltz', 'Echternach', 'Rümelingen', 'Grevenmacher', 'Remich', 'Vianden'],
      5: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nizza', 'Nantes', 'Straßburg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Saint-Étienne', 'Le Havre', 'Toulon'],
      6: ['Rom', 'Mailand', 'Neapel', 'Turin', 'Palermo', 'Genua', 'Bologna', 'Florenz', 'Catania', 'Bari', 'Venedig', 'Verona', 'Padua', 'Triest', 'Brescia'],
      7: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza', 'Murcia', 'Palma', 'Granada', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón'],
      8: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen', 'Haarlem', 'Arnhem', 'Enschede', 'Maastricht'],
      9: ['Brüssel', 'Antwerpen', 'Gent', 'Charleroi', 'Lüttich', 'Brügge', 'Namur', 'Leuven', 'Mons', 'Mechelen', 'Aalst', 'Hasselt', 'Kortrijk', 'Ostende'],
      10: ['Warschau', 'Krakau', 'Łódź', 'Breslau', 'Posen', 'Danzig', 'Stettin', 'Bydgoszcz', 'Lublin', 'Kattowitz', 'Białystok', 'Gdingen', 'Tschenstochau', 'Radom'],
      11: ['Prag', 'Brünn', 'Ostrau', 'Pilsen', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové', 'Ústí nad Labem', 'Pardubice', 'Zlin', 'Havířov', 'Kladno', 'Most'],
      12: ['Kopenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde', 'Herning', 'Silkeborg', 'Næstved', 'Fredericia'],
      13: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Västerås', 'Örebro', 'Helsingborg', 'Norrköping', 'Jönköping', 'Umeå', 'Lund', 'Gävle', 'Sundsvall'],
      14: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen', 'Fredrikstad', 'Kristiansand', 'Tromsø', 'Sandnes', 'Lillestrøm', 'Sarpsborg', 'Skien', 'Ålesund', 'Haugesund'],
      15: ['Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs', 'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár', 'Szombathely', 'Eger', 'Esztergom', 'Zalaegerszeg', 'Veszprém'],
      16: ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Slavonski Brod', 'Pula', 'Dubrovnik', 'Karlovac', 'Varaždin', 'Šibenik', 'Sisak', 'Vinkovci', 'Koprivnica'],
      17: ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica', 'Trnava', 'Martin', 'Trenčín', 'Poprad', 'Prievidza', 'Zvolen', 'Považská Bystrica', 'Michalovce'],
      18: ['Ljubljana', 'Maribor', 'Celje', 'Kranj', 'Koper', 'Novo Mesto', 'Velenje', 'Ptuj', 'Trbovlje', 'Kamnik', 'Jesenice', 'Nova Gorica', 'Murska Sobota', 'Izola'],
      19: ['Bukarest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea', 'Brăila', 'Arad', 'Sibiu', 'Bacău'],
      20: ['Sofia', 'Plowdiw', 'Warna', 'Burgas', 'Russe', 'Stara Sagora', 'Plewen', 'Dobritsch', 'Schumen', 'Pernik', 'Chaskowo', 'Jambol', 'Pasardschik', 'Wraza'],
      21: ['Athen', 'Thessaloniki', 'Patras', 'Heraklion', 'Larisa', 'Volos', 'Ioannina', 'Kavala', 'Rhodos', 'Chania', 'Agrinio', 'Katerini', 'Chalcis', 'Tripoli'],
      22: ['Lissabon', 'Porto', 'Braga', 'Coimbra', 'Funchal', 'Amadora', 'Setúbal', 'Aveiro', 'Faro', 'Viseu', 'Évora', 'Guimarães', 'Leiria', 'Ponta Delgada'],
      23: ['Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda', 'Kilkenny', 'Dundalk', 'Swords', 'Navan', 'Tralee', 'Wexford', 'Athlone', 'Carlow'],
      24: ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Turku', 'Oulu', 'Lahti', 'Kuopio', 'Jyväskylä', 'Pori', 'Joensuu', 'Lappeenranta', 'Vaasa', 'Rovaniemi'],
      28: ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Edinburgh', 'Leeds', 'Bristol', 'Sheffield', 'Newcastle', 'Nottingham', 'Southampton', 'Aberdeen', 'Cardiff'],
    };

    const names = cityMap[countryId] || ['Bitte wählen Sie zuerst ein Land'];
    this.allCityOptions = names.map((name, index) => ({ id: index + 1, name }));
  }

  // Helper method to get job type by control name
  getJobTypeByControlName(controlName: string): JobType | undefined {
    return this.jobTypes.find((jobType) => this.toCamelCase(jobType.name) === controlName);
  }
  onInputFocus(field: string) {
    if (window.innerWidth < 768) {
      this.activeField = field;
    }
  }

  onInputBlur() {
    // Small delay to allow focus to move to buttons if clicked
    setTimeout(() => {
      // Logic to clear activeField if we clicked outside could go here
      // But we might want to keep the bar specific logic
    }, 200);
  }

  closeMobileToolbar() {
    this.activeField = null;
    // unfocus current
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  // iOS Keyboard Lock - Prevents layout shift/zoom issues
  private scrollY = 0;
  private isScrollLocked = false;

  private isIOSDevice(): boolean {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isIOS && window.innerWidth < 768; // Only apply on mobile iOS
  }

  @HostListener('window:focusin', ['$event'])
  onWindowFocusIn(event: FocusEvent) {
    if (!this.isIOSDevice()) return;
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      this.lockBodyScroll();
    }
  }

  @HostListener('window:focusout', ['$event'])
  onWindowFocusOut(event: FocusEvent) {
    if (!this.isIOSDevice()) return;

    // Check if we are moving focus to another input
    const nextTarget = event.relatedTarget as HTMLElement;
    if (nextTarget && (nextTarget.tagName === 'INPUT' || nextTarget.tagName === 'TEXTAREA')) {
      return;
    }

    this.unlockBodyScroll();
  }

  private lockBodyScroll() {
    if (this.isScrollLocked) return;
    this.scrollY = window.scrollY;

    this.renderer.setStyle(this.document.body, 'position', 'fixed');
    this.renderer.setStyle(this.document.body, 'top', `-${this.scrollY}px`);
    this.renderer.setStyle(this.document.body, 'width', '100%');

    this.isScrollLocked = true;
  }

  private unlockBodyScroll() {
    if (!this.isScrollLocked) return;

    this.renderer.removeStyle(this.document.body, 'position');
    this.renderer.removeStyle(this.document.body, 'top');
    this.renderer.removeStyle(this.document.body, 'width');

    window.scrollTo(0, this.scrollY);
    this.isScrollLocked = false;
  }

  get isMobileToolbarVisible(): boolean {
    return !!this.activeField && window.innerWidth < 768;
  }

  navigateMobileInput(direction: 'next' | 'prev') {
    if (!this.activeField) return;

    // Filter fields to only text-like inputs for now, excluding dropdowns if they don't support focus the same way
    // Actually standard inputs are what we care about mostly
    const currentStepFields = this.stepFields[this.activeStep].filter((f) => ['country', 'city'].indexOf(f) === -1);

    // Add password fields for step 3
    if (this.activeStep === 3) {
      // stepFields[3] is already correct
    }

    const currentIndex = currentStepFields.indexOf(this.activeField);
    if (currentIndex === -1) return;

    let targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (targetIndex >= 0 && targetIndex < currentStepFields.length) {
      const targetField = currentStepFields[targetIndex];
      const element = document.getElementById(targetField);
      if (element) {
        // Use preventScroll to avoid iOS jumping
        (element as any).focus({ preventScroll: true });
        this.activeField = targetField;
      }
    } else {
      // potentially move to next step or just close
      if (direction === 'next') {
        // close keyboard/toolbar
        this.closeMobileToolbar();
      }
    }
  }

  private initForm() {
    // Create the main form with password confirmation validator
    this.userForm = this._formBuilder.group(
      {
        // Step 1: Personal information
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [phoneValidator(() => this.selectedPhoneCode)]],
        zipCode: [''],
        country: ['', Validators.required],
        city: [{ value: '', disabled: true }, Validators.required],

        // Step 2: Customer qualification checkboxes (will be updated dynamically)
        customers: this._formBuilder.group({}),

        // Step 3: Password and confirmations
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      {
        validators: this.passwordMatchValidator,
      },
    );

    // Subscribe to country changes to load cities
    this.userForm.get('country')?.valueChanges.subscribe((countryId) => {
      if (countryId && countryId !== this.selectedCountryId) {
        this.selectedCountryId = countryId;
        this.allCityOptions = [];
        this.filteredCitySuggestions = [];
        this.selectedCityOption = null;
        this.userForm.get('city')?.setValue('');
        this.selectedCityId = null;
        this.loadCities(countryId);
      } else if (!countryId) {
        this.userForm.get('city')?.setValue('');
        this.userForm.get('city')?.disable();
        this.selectedCountryId = null;
        this.selectedCityId = null;
        this.allCityOptions = [];
        this.filteredCitySuggestions = [];
        this.selectedCityOption = null;
      }
    });

    this.userForm.get('city')?.valueChanges.subscribe((cityVal) => {
      const id = typeof cityVal === 'number' ? cityVal : cityVal?.id;
      this.selectedCityId = id ?? null;
      if (id) {
        this.selectedCityOption = this.allCityOptions.find((option) => option.id === id) ?? this.selectedCityOption;
      } else {
        this.selectedCityOption = null;
      }
    });

    // PLZ lookup via Zippopotam.us
    this.userForm.get('zipCode')?.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), untilDestroyed(this))
      .subscribe((zip) => {
        if (zip && zip.toString().trim().length >= 3) {
          this.performZipLookup(zip.toString().trim());
        }
      });

    // Subscribe to form value changes to update the component properties
    this.userForm.get('firstName')?.valueChanges.subscribe((value) => (this.firstName = value));
    this.userForm.get('lastName')?.valueChanges.subscribe((value) => (this.lastName = value));
    this.userForm.get('email')?.valueChanges.subscribe((value) => {
      this.email = value;
      if (this.emailDuplicateError) {
        this.emailDuplicateError = false;
        this.emailDuplicateMessage = '';
      }
    });
    this.userForm.get('password')?.valueChanges.subscribe((value) => (this.password = value));
    this.userForm.get('confirmPassword')?.valueChanges.subscribe((value) => (this.confirmPassword = value));
  }

  // Custom validator for password confirmation
  private passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  private performZipLookup(zip: string): void {
    const selectedCountryId = this.userForm.get('country')?.value;
    const countryCode = selectedCountryId ? this.getCountryCode(selectedCountryId) : 'DE';

    this.apiService
      .get<any>(`/public/zip-lookup/${countryCode}/${zip}`, {}, {}, true)
      .pipe(catchError(() => of(null)), untilDestroyed(this))
      .subscribe((result) => {
        if (!result?.country || !result?.city) return;

        const matchedCountry = this.matchCountry(result.country);
        if (matchedCountry) {
          this.userForm.get('country')?.setValue(matchedCountry.id);
          this.matchCityAfterLoad(result.city);
        }
      });
  }

  private getCountryCode(countryId: number): string {
    const map: Record<number, string> = {
      1: 'DE', 2: 'AT', 3: 'CH', 4: 'LU', 5: 'FR', 6: 'IT', 7: 'ES', 8: 'NL', 9: 'BE',
      10: 'PL', 11: 'CZ', 12: 'DK', 13: 'SE', 14: 'NO', 15: 'HU', 16: 'HR', 17: 'SK',
      18: 'SI', 19: 'RO', 20: 'BG', 21: 'GR', 22: 'PT', 23: 'IE', 24: 'FI', 25: 'LT',
      26: 'LV', 27: 'EE', 28: 'GB', 29: 'IS', 30: 'LI', 31: 'MC', 32: 'MT', 33: 'CY',
      34: 'RS', 35: 'BA', 36: 'AL', 37: 'MK', 38: 'ME', 39: 'AD', 40: 'SM', 41: 'VA',
    };
    return map[countryId] || 'DE';
  }

  private matchCountry(apiCountryName: string): { id: number; name: string } | null {
    const nameMap: Record<string, number> = {
      Germany: 1, Deutschland: 1,
      Austria: 2, Österreich: 2,
      Switzerland: 3, Schweiz: 3,
      Luxembourg: 4, Luxemburg: 4,
      France: 5, Frankreich: 5,
      Italy: 6, Italien: 6,
      Spain: 7, Spanien: 7,
      Netherlands: 8, Niederlande: 8,
      Belgium: 9, Belgien: 9,
      Poland: 10, Polen: 10,
      'Czech Republic': 11, Tschechien: 11,
      Denmark: 12, Dänemark: 12,
      Sweden: 13, Schweden: 13,
      Norway: 14, Norwegen: 14,
      Hungary: 15, Ungarn: 15,
      Croatia: 16, Kroatien: 16,
      Slovakia: 17, Slowakei: 17,
      Slovenia: 18, Slowenien: 18,
      Romania: 19, Rumänien: 19,
      Bulgaria: 20, Bulgarien: 20,
      Greece: 21, Griechenland: 21,
      Portugal: 22,
      Ireland: 23, Irland: 23,
      Finland: 24, Finnland: 24,
      Lithuania: 25, Litauen: 25,
      Latvia: 26, Lettland: 26,
      Estonia: 27, Estland: 27,
      'United Kingdom': 28, 'Vereinigtes Königreich': 28,
      Iceland: 29, Island: 29,
      Liechtenstein: 30,
      Monaco: 31,
      Malta: 32,
      Cyprus: 33, Zypern: 33,
      Serbia: 34, Serbien: 34,
      'Bosnia and Herzegovina': 35, 'Bosnien und Herzegowina': 35,
      Albania: 36, Albanien: 36,
      'North Macedonia': 37, Nordmazedonien: 37,
      Montenegro: 38,
      Andorra: 39,
      'San Marino': 40,
      'Vatican City': 41, Vatikanstadt: 41,
    };
    const id = nameMap[apiCountryName];
    if (!id) return null;
    return this.countryOptions.find((c) => c.id === id) || null;
  }

  private matchCityAfterLoad(placeName: string, maxAttempts = 10): void {
    if (maxAttempts <= 0) return;
    if (this.allCityOptions.length > 0) {
      const city = this.allCityOptions.find((c) => c.name.toLowerCase() === placeName.toLowerCase());
      if (city) {
        this.userForm.get('city')?.setValue(city);
      }
      return;
    }
    setTimeout(() => this.matchCityAfterLoad(placeName, maxAttempts - 1), 300);
  }

  toggleCustomerSelection(controlName: string) {
    // Get the form control group
    const customersGroup = this.userForm.get('customers') as FormGroup;
    // Get the specific control
    const control = customersGroup.get(controlName);

    if (control) {
      // Toggle the value
      control.setValue(!control.value);
    }
  }

  login() {
    // Clear previous error message
    this.loginError = '';
    this.isLoading = true;

    this._authService
      .login({
        username: this.email,
        password: this.password,
        remember: this.remember,
      })
      .pipe(
        untilDestroyed(this),
        switchMap(() =>
          this._authStateService.authState$.pipe(
            filter((state) => state === AuthState.AUTHENTICATED),
            take(1),
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.isLoading = false;
          console.log('Login successful, redirecting to', this.returnUrl);
          this._router.navigateByUrl(this.returnUrl);
        },
        error: (err) => {
          this.isLoading = false;
          this.loginError = 'Invalid credentials. Please try again.';
          console.error('Login failed:', err);
        },
      });
  }

  register() {
    // Clear previous errors
    this.loginError = '';
    this.emailDuplicateError = false;
    this.emailDuplicateMessage = '';

    // Validate the entire form
    if (!this.userForm.valid) {
      this.markFormGroupTouched(this.userForm);

      // Check for password mismatch specifically
      if (this.userForm.hasError('passwordMismatch')) {
        this.loginError = 'Passwörter stimmen nicht überein.';
      } else {
        this.loginError = 'Bitte füllen Sie alle erforderlichen Felder korrekt aus.';
      }
      return;
    }

    // Validate step 3 specifically
    if (!this.validateStep(3)) {
      return;
    }

    // Set loading state
    this.isRegistering = true;

    // Get form values and prepare registration data
    const formValues = this.userForm.value;

    // Get selected job type IDs
    const customersGroup = formValues.customers;
    const selectedJobTypeIds: number[] = [];

    Object.keys(customersGroup).forEach((controlName) => {
      if (customersGroup[controlName] === true) {
        const jobType = this.getJobTypeByControlName(controlName);
        if (jobType) {
          selectedJobTypeIds.push(jobType.id);
        }
      }
    });

    const cityValue = formValues.city;
    let cityId: number | undefined;
    let cityName: string | undefined;

    if (typeof cityValue === 'number') {
      cityId = cityValue;
    } else if (typeof cityValue === 'object' && cityValue?.id) {
      cityId = cityValue.id;
    } else if (typeof cityValue === 'string' && cityValue.trim()) {
      cityName = cityValue.trim();
    }

    const localPhone = (formValues.phone || '').replace(/^0+/, '');
    const fullPhone = localPhone ? `${this.selectedPhoneCode || '+49'}${localPhone}` : undefined;

    const registrationData: RegisterRequest = {
      email: formValues.email.toLowerCase().trim(),
      password: formValues.password,
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      phone: fullPhone,
      zipCode: formValues.zipCode?.trim() || undefined,
      countryId: formValues.country || undefined,
      cityId,
      cityName,
      jobTypeIds: selectedJobTypeIds,
    };

    console.log('Sending registration data:', registrationData);

    // Call the API using your ApiService
    this.apiService
      .post<RegisterResponse>('/auth/email/register', registrationData, {}, true, false)
      .pipe(
        untilDestroyed(this),
        catchError((error) => {
          console.error('Registration error:', error);
          this.isRegistering = false;

          // Extract error message from different possible locations
          const errorMessage = error?.message || error?.data?.message || error?.data?.error || '';
          const errorMessageLower = errorMessage.toLowerCase();

          const duplicateEmailMessage = 'Diese E-Mail-Adresse ist bereits registriert. Bitte verwenden Sie eine andere E-Mail-Adresse oder melden Sie sich an.';

          // Check for email-related errors in the message
          if (this.isEmailAlreadyRegisteredError(errorMessage)) {
            this.handleEmailAlreadyRegisteredError(duplicateEmailMessage);
          } else if (errorMessageLower.includes('invalid email') || errorMessageLower.includes('ungültige e-mail') || errorMessageLower.includes('email format')) {
            const emailFormatErrorMsg = 'Die eingegebene E-Mail-Adresse ist ungültig. Bitte überprüfen Sie die E-Mail-Adresse und versuchen Sie es erneut.';
            this.handleEmailInputError(emailFormatErrorMsg);
          } else if (error.status === 422) {
            // Validation errors from backend
            if (error.data?.errors?.email) {
              const emailErrorMsg = Array.isArray(error.data.errors.email) ? error.data.errors.email[0] : error.data.errors.email;
              if (this.isEmailAlreadyRegisteredError(String(emailErrorMsg))) {
                this.handleEmailAlreadyRegisteredError(duplicateEmailMessage);
              } else {
                this.handleEmailInputError(emailErrorMsg);
              }
            } else if (error.data?.errors?.password) {
              this.loginError = 'Das Passwort entspricht nicht den Anforderungen.';
              this.toast.error(this.loginError, {
                position: 'bottom-right',
                duration: 5000,
              });
            } else if (error.data?.errors?.jobTypeIds) {
              this.loginError = 'Ungültige Qualifikationsauswahl.';
              this.toast.error(this.loginError, {
                position: 'bottom-right',
                duration: 5000,
              });
            } else {
              this.loginError = 'Ungültige Eingabedaten. Bitte überprüfen Sie Ihre Angaben.';
              this.toast.error(this.loginError, {
                position: 'bottom-right',
                duration: 5000,
              });
            }
          } else if (error.status === 409) {
            const conflictErrorMsg = 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits. Bitte verwenden Sie eine andere E-Mail-Adresse oder melden Sie sich an.';
            this.handleEmailAlreadyRegisteredError(conflictErrorMsg);
          } else {
            const genericErrorMsg = 'Registrierung fehlgeschlagen. Bitte versuchen Sie es später erneut.';
            this.loginError = genericErrorMsg;
            this.toast.error(genericErrorMsg, {
              position: 'bottom-right',
              duration: 5000,
            });
          }

          return of(null);
        }),
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }
          console.log('Registration successful:', response);
          this.isRegistering = false;
          this.confirmationEmailSent = response?.confirmationEmailSent !== false;
          this.showEmailVerificationToast();
        },
      });
  }

  // Show the email verification success page
  private showEmailVerificationToast() {
    this.registeredEmail = this.userForm.get('email')?.value || '';
    this.registrationSuccess = true;
  }

  goToLogin(): void {
    const email = this.userForm.get('email')?.value?.trim().toLowerCase() || '';
    this._router.navigate(['/login'], email ? { queryParams: { email } } : undefined);
  }

  onStepHeaderClick(targetStep: number, activateCallback: () => void) {
    if (targetStep > this.activeStep) {
      if (this.validateStep(this.activeStep)) {
        activateCallback();
      }
    } else {
      activateCallback();
    }
  }

  // Method to navigate between steps with validation
  goToStep(nextStep: number) {
    if (nextStep > this.activeStep) {
      // Validate current step before proceeding
      if (this.validateStep(this.activeStep)) {
        this.activeStep = nextStep;
      }
    } else {
      // Allow going back without validation
      this.stepErrors[this.activeStep] = '';
      this.activeStep = nextStep;
      this.activeField = null;
    }
  }

  // Validate each step - single implementation
  validateStep(step: number): boolean {
    this.stepErrors[step] = '';

    switch (step) {
      case 1:
        const personalFields = ['firstName', 'lastName', 'email', 'phone'];
        const invalidPersonalFields = personalFields.filter((field) => {
          const control = this.userForm.get(field);
          return control && (control.invalid || (control.disabled && !control.value));
        });

        const countryValue = this.userForm.get('country')?.value;
        const cityValue = this.userForm.get('city')?.value;

        if (invalidPersonalFields.length > 0 || !countryValue || !cityValue) {
          this.stepErrors[1] = 'Bitte füllen Sie alle erforderlichen Felder aus.';
          this.markFormGroupTouched(this.userForm);
          return false;
        }
        return true;

      case 2:
        // Check if at least one job type is selected
        const customersGroup = this.userForm.get('customers') as FormGroup;
        const hasSelection = Object.keys(customersGroup.controls).some((key) => customersGroup.get(key)?.value === true);

        if (!hasSelection) {
          this.stepErrors[2] = 'Bitte wählen Sie mindestens eine Qualifikation aus.';
          return false;
        }
        return true;

      case 3:
        if (this.userForm.invalid) {
          this.stepErrors[3] = 'Bitte korrigieren Sie die Eingabefehler.';
          this.markFormGroupTouched(this.userForm);
          return false;
        }
        return true;

      default:
        return true;
    }
  }

  // Utility to mark all form controls as touched to show validation errors
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else {
        control?.markAsTouched();
      }
    });
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  private isEmailAlreadyRegisteredError(message: string): boolean {
    const normalized = (message || '').toLowerCase();
    return (
      normalized.includes('emailalreadyexists') ||
      normalized.includes('email already exists') ||
      normalized.includes('email bereits vorhanden') ||
      normalized.includes('email existiert bereits') ||
      normalized.includes('email is already registered') ||
      normalized.includes('already registered') ||
      normalized.includes('already exists') ||
      normalized.includes('bereits registriert') ||
      normalized.includes('bereits vorhanden') ||
      normalized.includes('existiert bereits')
    );
  }

  get isEmailInputHighlighted(): boolean {
    if (this.emailDuplicateError) {
      return true;
    }
    const emailControl = this.userForm.get('email');
    return !!(emailControl?.invalid && emailControl?.touched);
  }

  goToEmailStep(): void {
    this.activeStep = 1;
    this.stepErrors[3] = '';
    this.activeField = null;

    setTimeout(() => {
      const emailElement = this.document.getElementById('email') as HTMLInputElement | null;
      emailElement?.focus();
    }, 0);
  }

  private handleEmailInputError(message: string): void {
    this.emailDuplicateError = true;
    this.emailDuplicateMessage = message;
    this.loginError = '';
    this.userForm.get('email')?.markAsTouched();
    this.toast.error(message, {
      position: 'bottom-right',
      duration: 5000,
    });
    this.goToEmailStep();
  }

  private handleEmailAlreadyRegisteredError(message: string): void {
    this.handleEmailInputError(message);
  }
}
