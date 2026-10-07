import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-settings-button',
  standalone: true,
  templateUrl: './settings-button.component.html',
  styleUrls: ['./settings-button.component.scss'],
})
export class SettingsButtonComponent {
  @Input() label: string = 'Settings';
  @Input() iconClass: string = 'pi pi-cog text-sm!';
  @Output() settingsClick = new EventEmitter<MouseEvent>();

  onSettingsClick(event: MouseEvent): void {
    event.stopPropagation();
    this.settingsClick.emit(event);
  }
}
