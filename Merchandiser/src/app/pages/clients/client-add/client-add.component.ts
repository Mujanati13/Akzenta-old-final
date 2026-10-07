import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ImageItem } from '@app/shared/components/multi-image-upload/multi-image-upload.component';

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
  logoPreview: string | null = null;
  fileName: string = 'File 1.jpg';

  // For autocomplete
  filteredContacts: string[] = [];
  contactValue: string[] = [];
  allContacts: string[] = [];

  selectedManagers: string[] = [];

  // Add these properties to your component class
  filteredManagers: string[] = [];
  allManagers: string[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private location: Location,
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      image: [''],
      contacts: [this.contactValue],
      managers: [this.selectedManagers],
    });
  }

  // Autocomplete search function
  searchContacts(event: any) {
    const query = event.query.toLowerCase();
    this.filteredContacts = this.allContacts.filter((contact) => contact.toLowerCase().includes(query));
  }

  // When an item is selected or unselected, update the form value
  onContactsChanged() {
    this.clientForm.patchValue({
      contacts: this.contactValue,
    });
  }

  // To add a contact that doesn't exist in suggestions
  addCustomContact() {
    // Implementation if needed
  }

  // Rest of your existing methods...
  onImageSelected(file: File): void {
    this.logoPreview = URL.createObjectURL(file);
    this.fileName = file.name;
    this.clientForm.patchValue({
      image: file,
    });
  }

  onImageRemoved(): void {
    this.logoPreview = null;
    this.fileName = '';
    this.clientForm.patchValue({
      image: '',
    });
  }

  addNewManager(): void {
    const manager = this.managerControl.value?.trim();
    if (manager && !this.selectedManagers.includes(manager)) {
      this.selectedManagers.push(manager);
      this.clientForm.patchValue({
        managers: this.selectedManagers,
      });
      this.managerControl.setValue('');
    }
  }

  removeManager(manager: string): void {
    this.selectedManagers = this.selectedManagers.filter((m) => m !== manager);
    this.clientForm.patchValue({
      managers: this.selectedManagers,
    });
  }

  // Add these methods to your component class
  searchManagers(event: any) {
    const query = event.query.toLowerCase();
    this.filteredManagers = this.allManagers.filter((manager) => manager.toLowerCase().includes(query));
  }

  // When managers selection changes
  onManagersChanged() {
    this.clientForm.patchValue({
      managers: this.selectedManagers,
    });
  }

  // To add a manager that doesn't exist in suggestions
  addCustomManager() {
    const managerName = this.managerControl.value?.trim();
    if (managerName && !this.selectedManagers.includes(managerName)) {
      this.selectedManagers.push(managerName);

      // Add to allManagers for future suggestions if it's not already there
      if (!this.allManagers.includes(managerName)) {
        this.allManagers.push(managerName);
      }

      this.clientForm.patchValue({
        managers: this.selectedManagers,
      });
      this.managerControl.setValue('');
    }
  }

  onSubmit(): void {
    if (this.clientForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    console.log('New client data:', {
      ...this.clientForm.value,
    });

    setTimeout(() => {
      this.router.navigate(['/clients/list']);
    }, 1000);
  }

  cancel(): void {
    this.router.navigate(['/clients/list']);
  }
}
