import { Component, ElementRef, Input } from '@angular/core';
import { I18nService } from './i18n.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss'],
  imports: [NgClass],
  standalone: true,
})
export class LanguageSelectorComponent {
  @Input() inNavbar = true;
  @Input() openAbove = false;

  // Map of language codes to display names
  private languageDisplayNames: { [key: string]: string } = {
    'en-US': 'English',
    'de-DE': 'Deutsch',
    // Add more languages here as needed
  };

  constructor(
    private readonly _i18nService: I18nService,
    private readonly _eRef: ElementRef,
  ) {}

  get currentLanguage(): string {
    return this._i18nService.language;
  }

  get languages(): string[] {
    return this._i18nService.supportedLanguages;
  }

  get displayLanguages(): string[] {
    return this._i18nService.supportedLanguages.map((lang) => {
      return this.languageDisplayNames[lang] || lang;
    });
  }

  setLanguage(language: string) {
    // Find the language code from the display name
    const languageCode = Object.keys(this.languageDisplayNames).find((key) => this.languageDisplayNames[key] === language) || language;

    this._i18nService.language = languageCode;
  }

  getLanguageCode(displayName: string): string {
    // Get the language code for the current display name
    const code = Object.keys(this.languageDisplayNames).find((key) => this.languageDisplayNames[key] === displayName);
    return code ? code : displayName;
  }
}
