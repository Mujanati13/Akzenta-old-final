import { Component, Input, OnInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-staff-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-map.component.html',
})
export class StaffMapComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() staffData: any[] = [];
  @Input() locationSearch: string = '';
  @Input() loading: boolean = false;
  filteredStaffData: any[] = [];

  // Map properties
  map: mapboxgl.Map;
  markers: mapboxgl.Marker[] = [];

  // Cache for geocoded coordinates (city name → {lat, lng})
  private geocodingCache = new Map<string, { lat: number; lng: number }>();

  private readonly mapboxToken = environment.mapboxToken;

  constructor(private router: Router) {}

  ngOnInit() {
    this.syncStaffData();
    (window as any).staffMapComponentInstance = this;
  }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['locationSearch'] && !changes['locationSearch'].firstChange && this.map) {
      const locationValue = changes['locationSearch'].currentValue;
      if (locationValue && locationValue.trim()) {
        this.geocodeAndZoomToLocation(locationValue.trim());
      }
    }

    if (changes['staffData']) {
      this.syncStaffData();
      if (this.map) {
        this.addMarkers(this.filteredStaffData);
      }
    }
  }

  private syncStaffData(): void {
    this.filteredStaffData = this.staffData.map((s) => {
      // Preserve geocoded location from cache if staff has no valid location
      const hasValid = s.location && s.location.lat && s.location.lng && !(s.location.lat === 0 && s.location.lng === 0);
      if (!hasValid && s.city) {
        const cached = this.geocodingCache.get(s.city);
        if (cached) {
          return { ...s, location: cached };
        }
      }
      return { ...s };
    });
  }

  private initializeMap(): void {
    // Set mapbox token - fixed to avoid "Cannot assign to import" error
    // (mapboxgl as any).accessToken = this.mapboxToken;

    // Initialize map
    this.map = new mapboxgl.Map({
      accessToken: this.mapboxToken,
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v10',
      center: [10.4515, 51.1657],
      zoom: 5,
    });

    // Add navigation controls
    this.map.addControl(new mapboxgl.NavigationControl());

    // Add markers when map loads
    this.map.on('load', () => {
      this.syncStaffData();
      this.addMarkers(this.filteredStaffData);

      // If there's a location search, geocode and zoom to it
      if (this.locationSearch && this.locationSearch.trim()) {
        this.geocodeAndZoomToLocation(this.locationSearch.trim());
      }
    });
  }

  private async geocodeAndZoomToLocation(locationQuery: string): Promise<void> {
    if (!this.map || !locationQuery) {
      return;
    }

    const place = this.extractPlaceFromLocationQuery(locationQuery);

    try {
      const encodedQuery = encodeURIComponent(place);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${this.mapboxToken}&limit=1&country=DE&language=de`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;

        // Check if we have filtered markers nearby
        const nearbyMarkers = this.filteredStaffData.filter((staff) => {
          if (!staff.location || !staff.location.lat || !staff.location.lng) {
            return false;
          }
          // Calculate rough distance (simple approximation)
          const distance = this.calculateDistanceBetweenPoints(lat, lng, staff.location.lat, staff.location.lng);
          // Include markers within ~50km radius
          return distance < 50;
        });

        if (nearbyMarkers.length > 0) {
          // Fit bounds to include both searched location and nearby markers
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([lng, lat]); // Add searched location

          nearbyMarkers.forEach((staff) => {
            if (staff.location && staff.location.lat && staff.location.lng) {
              bounds.extend([staff.location.lng, staff.location.lat]);
            }
          });

          this.map.fitBounds(bounds, {
            padding: 100, // Add padding around the bounds
            duration: 1500,
            maxZoom: 14, // Don't zoom too close
          });
        } else {
          // No nearby markers, just zoom to the searched location
          // Zoom level 12 shows city/district level, 13 shows neighborhood, 14 shows street level
          this.map.flyTo({
            center: [lng, lat],
            zoom: 13, // Good zoom level to show approximate location
            duration: 1500, // Smooth animation
          });
        }
      } else {
        console.warn('Location not found:', locationQuery);
      }
    } catch (error) {
      console.error('Error geocoding location:', error);
    }
  }

  // Calculate distance between two points in kilometers (Haversine formula)
  private calculateDistanceBetweenPoints(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }

  private extractPlaceFromLocationQuery(query: string): string {
    const trimmed = query.trim();
    const suffixMatch = trimmed.match(/^(.+?)\s+(\d+)\s*(km)?$/i);
    if (suffixMatch) {
      return suffixMatch[1].trim();
    }

    const prefixMatch = trimmed.match(/^(\d+)\s*(km)?\s+(.+)$/i);
    if (prefixMatch) {
      return prefixMatch[3].trim();
    }

    return trimmed;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Add markers for staff locations
  private async addMarkers(staff: any[]): Promise<void> {
    // Clear existing markers
    this.clearMarkers();

    // Geocode staff with missing coordinates using their city name
    await this.geocodeMissingLocations(staff);

    // Group staff by location
    const locationGroups = this.groupByLocation(staff);

    locationGroups.forEach((group) => {
      if (group.location && group.location.lat && group.location.lng) {
        // If multiple staff at same location, create carousel
        if (group.staff.length > 1) {
          this.createCarouselMarker(group);
        } else {
          this.createSingleMarker(group.staff[0]);
        }
      }
    });

    // Fit bounds to markers if there are any
    if (this.markers.length > 0) {
      this.fitMapToMarkers();
    }
  }

  // Group staff members by their city name (not exact coordinates)
  // "Frankfurt" and "Frankfurt am Main" will be grouped together
  private groupByLocation(staff: any[]): Array<{ location: any; staff: any[] }> {
    const groups = new Map<string, any[]>();

    staff.forEach((person) => {
      if (person.location && person.location.lat && person.location.lng) {
        const key = this.normalizeCityName(person.city || '');
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(person);
      }
    });

    return Array.from(groups.values()).map((staffGroup) => ({
      location: staffGroup[0].location,
      staff: staffGroup,
    }));
  }

  // Normalize city name so "Frankfurt" and "Frankfurt am Main" group together
  private normalizeCityName(city: string): string {
    if (!city) return '';
    const trimmed = city.trim().toLowerCase();
    // Remove common German suffixes: "am Main", "an der Oder", "an der Havel", etc.
    const suffixMatch = trimmed.match(/^(.+?)\s+(am|an\s+der|an\s+dem|im|auf\s+der)\s+.+$/);
    if (suffixMatch) {
      return suffixMatch[1];
    }
    return trimmed;
  }

  // Geocode staff members that have city names but missing/invalid coordinates
  private async geocodeMissingLocations(staff: any[]): Promise<void> {
    const needsGeocoding = staff.filter((s) => {
      const hasValidLocation = s.location && s.location.lat && s.location.lng && !(s.location.lat === 0 && s.location.lng === 0);
      return !hasValidLocation && s.city && !this.geocodingCache.has(s.city);
    });

    if (needsGeocoding.length === 0) return;

    // Get unique city names to avoid duplicate API calls
    const uniqueCities = [...new Set(needsGeocoding.map((s) => s.city))];

    const geocodePromises = uniqueCities.map(async (city) => {
      try {
        const encoded = encodeURIComponent(city);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${this.mapboxToken}&limit=1&country=DE&language=de`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.features?.length) {
          const [lng, lat] = data.features[0].center;
          if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
            this.geocodingCache.set(city, { lat, lng });
          }
        }
      } catch (error) {
        console.warn(`Geocoding failed for city "${city}":`, error);
      }
    });

    await Promise.all(geocodePromises);

    // Apply cached coordinates to staff
    staff.forEach((person) => {
      const hasValid = person.location && person.location.lat && person.location.lng && !(person.location.lat === 0 && person.location.lng === 0);
      if (!hasValid && person.city) {
        const cached = this.geocodingCache.get(person.city);
        if (cached) {
          person.location = cached;
        }
      }
    });
  }

  // Create a marker with scrollable list for multiple staff at same location
  private createCarouselMarker(group: { location: any; staff: any[] }): void {
    const staffCount = group.staff.length;

    // Calculate max height: show up to 3 cards (each 70px) + header (40px)
    const maxHeight = staffCount > 3 ? '270px' : 'auto'; // 40 (header) + 3 * 70 + padding

    // Create popup content with scrollable list
    const popup = new mapboxgl.Popup({
      offset: [0, -60],
      maxWidth: '350px',
      closeButton: false,
      className: 'staff-list-popup',
    }).setHTML(`
      <div class="bg-white w-[320px] rounded-lg shadow overflow-hidden">
        <!-- Header -->
        <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <h3 class="text-[14px] font-semibold text-gray-800">${staffCount} Mitarbeiter in der Nähe</h3>
        </div>
        
        <!-- Staff List -->
        <div style="max-height: ${staffCount > 3 ? '210px' : 'auto'}; overflow-y: auto;">
          ${group.staff.map((person) => this.createStaffCardHTML(person, true)).join('')}
        </div>
      </div>
    `);

    this.createMarkerElement(group.location, popup, staffCount);
  }

  // Create a marker for single staff member with detailed card
  private createSingleMarker(person: any): void {
    const popup = new mapboxgl.Popup({
      offset: [0, -60],
      maxWidth: '500px',
      closeButton: false,
    }).setHTML(`
      <div class="bg-white w-[404px] rounded-xl shadow flex items-center gap-x-[10px] p-2 h-[131px]">
        <!-- Staff Image -->
        <a 
          href="${this.getStaffDetailUrl(person.id)}"
          onclick="event.preventDefault(); window.staffMapComponentInstance.navigateToStaffDetails('${person.id}')"
          class="w-[105px] h-[113px] rounded-[10px] overflow-hidden flex-shrink-0 bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity block"
          title="Klicken zum Öffnen, Rechtsklick für neuen Tab"
        >
          <img
            src="${person.portrait?.path || 'https://st2.depositphotos.com/1010683/7109/i/450/depositphotos_71090693-stock-photo-caucasian-handsome-man-in-grey.jpg'}"
            alt="${person.firstName} ${person.lastName}"
            class="w-full h-full object-cover"
          />
        </a>

        <!-- Staff Info -->
        <div class="flex flex-col gap-y-[4px] flex-1">
          <div class="flex items-center mb-2">
            <a 
              href="${this.getStaffDetailUrl(person.id)}"
              onclick="event.preventDefault(); window.staffMapComponentInstance.navigateToStaffDetails('${person.id}')"
              class="text-primary-500 font-semibold text-[14px] mr-2 truncate cursor-pointer hover:underline"
              title="Klicken zum Öffnen, Rechtsklick für neuen Tab"
            >${person.firstName} ${person.lastName}</a>
            <span class="text-gray-500 text-[10px] whitespace-nowrap"> | Geb. ${this.formatDate(person.dateOfBirth)} </span>
            <span class="ml-auto px-3 py-0.5 text-[10px] font-semibold text-white bg-primary-500 rounded-[4px]"> ${person.status} </span>
          </div>
          <div class="flex-col gap-y-[18px]">
            <div class="flex items-end text-[10px]">
              <div class="text-gray-700 leading-tight">
                <p class="truncate">${person.address || ''}</p>
                <p class="truncate">${person.postalCode || ''} ${person.city || ''}</p>
                <p class="truncate">${person.country || ''}</p>
              </div>
            </div>
            <div class="flex items-end justify-between leading-tight">
              <div class="mt-1 text-gray-500 text-[10px] leading-tight">
                <p class="truncate">${person.user?.email || person.email || ''}</p>
                <p class="truncate">${person.phoneNumber || person.phone || ''}</p>
              </div>
              <div class="flex gap-x-2 ml-4">
                <button class="w-5 h-5 cursor-pointer text-primary-500 flex items-center" title="${person.qualifications?.join(', ') || ''}">
                  <!-- Info SVG -->
                  <svg viewBox="0 0 17 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.5 0.422363C10.8471 0.422363 12.9721 1.37396 14.5104 2.91193C16.0484 4.4499 17 6.57523 17 8.92236C17 11.2695 16.0484 13.3948 14.5104 14.9328C12.9721 16.4708 10.8471 17.4224 8.5 17.4224C6.15287 17.4224 4.02787 16.4708 2.48957 14.9328C0.951602 13.3945 0 11.2695 0 8.92236C0 6.57523 0.951602 4.45023 2.48957 2.91193C4.02787 1.37396 6.15287 0.422363 8.5 0.422363ZM8.1693 5.76906C8.1693 5.62695 8.19453 5.4948 8.24467 5.37361C8.29447 5.25309 8.36984 5.14318 8.47012 5.04457C8.56973 4.94662 8.67896 4.87191 8.79684 4.82211C8.91537 4.7723 9.04287 4.74641 9.17934 4.74641C9.31613 4.74641 9.44363 4.7723 9.56084 4.82178C9.67838 4.87191 9.78596 4.94662 9.88457 5.04523C9.98252 5.14385 10.0559 5.25309 10.105 5.37428C10.1545 5.4948 10.1787 5.62695 10.1787 5.76906C10.1787 5.90752 10.1545 6.03734 10.1054 6.15721C10.0562 6.27674 9.98318 6.38764 9.88457 6.48824C9.78695 6.58885 9.67938 6.66488 9.56184 6.71535C9.4443 6.76549 9.3168 6.79139 9.17934 6.79139C9.03922 6.79139 8.90906 6.76615 8.7892 6.71635C8.67033 6.66621 8.56143 6.59051 8.46281 6.4909C8.3652 6.39063 8.29148 6.28039 8.24268 6.15986C8.19354 6.03967 8.1693 5.90951 8.1693 5.76906ZM8.61422 11.6845C8.57736 11.8163 8.50299 12.075 8.72379 12.075C8.7716 12.075 8.83236 12.0481 8.90508 11.9953C8.98377 11.9385 9.07408 11.8522 9.17502 11.738C9.27762 11.6218 9.38486 11.484 9.49609 11.3256C9.60666 11.1676 9.7232 10.9863 9.84439 10.7841C9.85668 10.7625 9.88523 10.7552 9.90715 10.7681L10.3175 11.0729C10.3375 11.0872 10.3418 11.1144 10.3292 11.1347C10.1402 11.4627 9.94932 11.7493 9.75607 11.994C9.56184 12.24 9.36461 12.4446 9.16506 12.6059L9.16174 12.6079C8.96186 12.7699 8.75699 12.8918 8.54715 12.9735C7.96344 13.1996 7.04105 13.1627 6.77676 12.4811C6.61008 12.0508 6.74688 11.5617 6.87836 11.1407L7.54109 9.13387C7.58359 8.9818 7.63705 8.81445 7.65631 8.65807C7.68852 8.39676 7.57363 8.22775 7.28908 8.22775H6.70969C6.68445 8.22775 6.66387 8.20717 6.66387 8.18193L6.66652 8.166L6.81859 7.61217C6.82391 7.59158 6.84283 7.57764 6.86342 7.5783L9.82248 7.48566C9.84771 7.48467 9.8693 7.50459 9.87029 7.52982L9.86797 7.5441L8.61422 11.6845ZM13.8703 3.55209C12.496 2.17781 10.5971 1.32748 8.5 1.32748C6.40289 1.32748 4.504 2.17781 3.12973 3.55209C1.75545 4.92637 0.905117 6.82525 0.905117 8.92236C0.905117 11.0195 1.75545 12.9184 3.12973 14.2926C4.504 15.6669 6.40289 16.5172 8.5 16.5172C10.5971 16.5172 12.496 15.6669 13.8703 14.2926C15.2446 12.9184 16.0949 11.0195 16.0949 8.92236C16.0949 6.82525 15.2446 4.92637 13.8703 3.55209Z" fill="currentColor"/>
                  </svg>
                </button>
                <a 
                  href="${this.getStaffDetailUrl(person.id)}"
                  onclick="event.preventDefault(); window.staffMapComponentInstance.navigateToStaffDetails('${person.id}')"
                  class="w-5 h-5 cursor-pointer text-primary-500 flex items-center hover:text-primary-600 inline-flex" 
                  title="Details ansehen (Rechtsklick für neuen Tab)"
                >
                  <!-- Eye SVG -->
                  <svg viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 5C14 5 11.375 0.1875 7 0.1875C2.625 0.1875 0 5 0 5C0 5 2.625 9.8125 7 9.8125C11.375 9.8125 14 5 14 5ZM1.02637 5C1.44945 4.35698 1.93606 3.7581 2.47887 3.21237C3.605 2.0845 5.145 1.0625 7 1.0625C8.855 1.0625 10.3941 2.0845 11.522 3.21237C12.0648 3.7581 12.5514 4.35698 12.9745 5C12.9237 5.07613 12.8678 5.16013 12.8039 5.252C12.5107 5.672 12.0776 6.232 11.522 6.78763C10.3941 7.9155 8.85412 8.9375 7 8.9375C5.145 8.9375 3.60588 7.9155 2.478 6.78763C1.93519 6.2419 1.44946 5.64301 1.02637 5Z" fill="currentColor"/>
                    <path d="M7 2.8125C6.41984 2.8125 5.86344 3.04297 5.4532 3.4532C5.04297 3.86344 4.8125 4.41984 4.8125 5C4.8125 5.58016 5.04297 6.13656 5.4532 6.5468C5.86344 6.95703 6.41984 7.1875 7 7.1875C7.58016 7.1875 8.13656 6.95703 8.5468 6.5468C8.95703 6.13656 9.1875 5.58016 9.1875 5C9.1875 4.41984 8.95703 3.86344 8.5468 3.4532C8.13656 3.04297 7.58016 2.8125 7 2.8125ZM3.9375 5C3.9375 4.18777 4.26016 3.40882 4.83449 2.83449C5.40882 2.26016 6.18777 1.9375 7 1.9375C7.81223 1.9375 8.59118 2.26016 9.16551 2.83449C9.73984 3.40882 10.0625 4.18777 10.0625 5C10.0625 5.81223 9.73984 6.59118 9.16551 7.16551C8.59118 7.73984 7.81223 8.0625 7 8.0625C6.18777 8.0625 5.40882 7.73984 4.83449 7.16551C4.26016 6.59118 3.9375 5.81223 3.9375 5Z" fill="currentColor"/>
                  </svg>
                </a>
                <a href="mailto:${person.user?.email || person.email || ''}" title="E-Mail senden" class="w-5 h-5 cursor-pointer text-primary-500 flex items-center">
                  <!-- Envelope SVG -->
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 5C0 4.33696 0.263392 3.70107 0.732233 3.23223C1.20107 2.76339 1.83696 2.5 2.5 2.5H17.5C18.163 2.5 18.7989 2.76339 19.2678 3.23223C19.7366 3.70107 20 4.33696 20 5V15C20 15.663 19.7366 16.2989 19.2678 16.7678C18.7989 17.2366 18.163 17.5 17.5 17.5H2.5C1.83696 17.5 1.20107 17.2366 0.732233 16.7678C0.263392 16.2989 0 15.663 0 15V5ZM2.5 3.75C2.16848 3.75 1.85054 3.8817 1.61612 4.11612C1.3817 4.35054 1.25 4.66848 1.25 5V5.27125L10 10.5212L18.75 5.27125V5C18.75 4.66848 18.6183 4.35054 18.3839 4.11612C18.1495 3.8817 17.8315 3.75 17.5 3.75H2.5ZM18.75 6.72875L12.865 10.26L18.75 13.8812V6.72875ZM18.7075 15.3237L11.6575 10.985L10 11.9788L8.3425 10.985L1.2925 15.3225C1.36353 15.5885 1.5204 15.8236 1.73874 15.9913C1.95708 16.159 2.22468 16.25 2.5 16.25H17.5C17.7752 16.25 18.0426 16.1593 18.261 15.9918C18.4793 15.8243 18.6362 15.5895 18.7075 15.3237ZM1.25 13.8812L7.135 10.26L1.25 6.72875V13.8812Z" fill="currentColor"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    this.createMarkerElement(person.location, popup, 1);
  }

  // Add a helper method to format dates (since we can't use the Angular date pipe in HTML strings)
  private formatDate(dateString: string): string {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  }

  // Fit map view to include all markers
  private fitMapToMarkers(): void {
    const bounds = new mapboxgl.LngLatBounds();

    this.markers.forEach((marker) => {
      bounds.extend(marker.getLngLat());
    });

    this.map.fitBounds(bounds, {
      padding: 70,
      maxZoom: 15,
    });
  }

  // Clear all markers from the map
  private clearMarkers(): void {
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];
  }

  // Helper method to get staff detail URL without query params
  private getStaffDetailUrl(staffId: string): string {
    const urlTree = this.router.createUrlTree(['/staff', staffId]);
    return window.location.origin + this.router.serializeUrl(urlTree);
  }

  navigateToStaffDetails(staffId: string, newTab: boolean = false): void {
    if (newTab) {
      const urlTree = this.router.createUrlTree(['/staff', staffId]);
      const url = window.location.origin + this.router.serializeUrl(urlTree);
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/staff', staffId]);
    }
  }

  // Create HTML for a staff card (compact version matching screenshot)
  private createStaffCardHTML(person: any, visible: boolean): string {
    const location = `${person.city || person.address || ''} ${person.country || ''}`.trim() || 'Kein Standort';

    return `
      <div class="flex items-center gap-x-3 px-4 py-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
        <!-- Staff Image -->
        <a 
          href="${this.getStaffDetailUrl(person.id)}"
          onclick="event.preventDefault(); window.staffMapComponentInstance.navigateToStaffDetails('${person.id}')"
          class="w-[40px] h-[40px] rounded-full overflow-hidden flex-shrink-0 bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity block"
          title="Klicken zum Öffnen, Rechtsklick für neuen Tab"
        >
          <img
            src="${person?.portrait?.path || 'https://st2.depositphotos.com/1010683/7109/i/450/depositphotos_71090693-stock-photo-caucasian-handsome-man-in-grey.jpg'}"
            alt="${person.firstName} ${person.lastName}"
            class="w-full h-full object-cover"
          />
        </a>

        <!-- Staff Info -->
        <div class="flex-1 min-w-0">
          <a 
            href="${this.getStaffDetailUrl(person.id)}"
            onclick="event.preventDefault(); window.staffMapComponentInstance.navigateToStaffDetails('${person.id}')"
            class="text-[14px] font-medium text-gray-900 truncate cursor-pointer hover:text-primary-500 hover:underline block"
            title="Klicken zum Öffnen, Rechtsklick für neuen Tab"
          >${person.firstName} ${person.lastName}</a>
          <p class="text-[12px] text-gray-500 truncate">${location}</p>
        </div>

        <!-- Details Link -->
        <a 
          href="${this.getStaffDetailUrl(person.id)}"
          onclick="event.preventDefault(); window.staffMapComponentInstance.navigateToStaffDetails('${person.id}')"
          class="text-[14px] text-primary-500 hover:text-primary-600 font-medium cursor-pointer flex-shrink-0"
          title="Klicken zum Öffnen, Rechtsklick für neuen Tab"
        >
          Details
        </a>
      </div>
    `;
  }

  // Create the marker DOM element and add to map
  private createMarkerElement(location: any, popup: mapboxgl.Popup, count: number = 1): void {
    const el = document.createElement('div');
    el.className = 'relative flex flex-col items-center group cursor-pointer';
    el.style.width = '48px';
    el.style.height = '60px';
    el.style.background = 'transparent';

    // Show count number for multiple staff, person icon for single staff
    const markerContent =
      count > 1
        ? `<span class="text-white font-bold text-[16px]">${count}</span>`
        : `<svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.5 8.5C9.62717 8.5 10.7082 8.05223 11.5052 7.2552C12.3022 6.45817 12.75 5.37717 12.75 4.25C12.75 3.12283 12.3022 2.04183 11.5052 1.2448C10.7082 0.447767 9.62717 0 8.5 0C7.37283 0 6.29183 0.447767 5.4948 1.2448C4.69777 2.04183 4.25 3.12283 4.25 4.25C4.25 5.37717 4.69777 6.45817 5.4948 7.2552C6.29183 8.05223 7.37283 8.5 8.5 8.5ZM11.3333 4.25C11.3333 5.00145 11.0348 5.72212 10.5035 6.25347C9.97212 6.78482 9.25145 7.08333 8.5 7.08333C7.74855 7.08333 7.02788 6.78482 6.49653 6.25347C5.96518 5.72212 5.66667 5.00145 5.66667 4.25C5.66667 3.49855 5.96518 2.77788 6.49653 2.24653C7.02788 1.71518 7.74855 1.41667 8.5 1.41667C9.25145 1.41667 9.97212 1.71518 10.5035 2.24653C11.0348 2.77788 11.3333 3.49855 11.3333 4.25ZM17 15.5833C17 17 15.5833 17 15.5833 17H1.41667C1.41667 17 0 17 0 15.5833C0 14.1667 1.41667 9.91667 8.5 9.91667C15.5833 9.91667 17 14.1667 17 15.5833ZM15.5833 15.5777C15.5819 15.2292 15.3652 14.1808 14.4047 13.2203C13.481 12.2967 11.7428 11.3333 8.5 11.3333C5.25583 11.3333 3.519 12.2967 2.59533 13.2203C1.63483 14.1808 1.4195 15.2292 1.41667 15.5777H15.5833Z" fill="currentColor"/>
        </svg>`;

    const bubbleBgColor = count > 1 ? 'bg-primary-500' : 'bg-white';
    const bubbleTextColor = count > 1 ? 'text-white' : 'text-primary-500';

    el.innerHTML = `
      <div class="marker-bubble ${bubbleBgColor} z-2 rounded-[2px] shadow-md ${bubbleTextColor} flex items-center justify-center w-10 h-8 transition-colors duration-200">
        ${markerContent}
      </div>
      <div class="marker-pointer w-3 h-3 ${count > 1 ? 'bg-primary-500' : 'bg-white'} rotate-45 -mt-2 shadow-md"></div>
    `;

    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat([location.lng, location.lat])
      .setPopup(popup)
      .addTo(this.map);

    // Popup open/close color logic (only for single staff markers)
    if (count === 1) {
      popup.on('open', () => {
        const bubble = el.querySelector('.marker-bubble');
        const pointer = el.querySelector('.marker-pointer');
        if (bubble) {
          bubble.classList.remove('bg-white', 'text-primary-500');
          bubble.classList.add('bg-primary-500', 'text-white');
        }
        if (pointer) {
          pointer.classList.remove('bg-white');
          pointer.classList.add('bg-primary-500');
        }
      });

      popup.on('close', () => {
        const bubble = el.querySelector('.marker-bubble');
        const pointer = el.querySelector('.marker-pointer');
        if (bubble) {
          bubble.classList.remove('bg-primary-500', 'text-white');
          bubble.classList.add('bg-white', 'text-primary-500');
        }
        if (pointer) {
          pointer.classList.remove('bg-primary-500');
          pointer.classList.add('bg-white');
        }
      });
    }

    el.addEventListener('click', () => {
      marker.togglePopup();
    });

    this.markers.push(marker);
  }
}
