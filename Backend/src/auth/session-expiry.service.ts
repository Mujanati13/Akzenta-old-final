import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { AllConfigType } from '../config/config.type';
import {
  getRemainingSessionMs,
  getSessionAgeMs,
  isSessionExpired,
} from '../utils/session-timestamp.util';

@Injectable()
export class SessionExpiryService {
  readonly maxAgeMs: number;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    const configured = this.configService.get('auth.sessionMaxAge', {
      infer: true,
    });
    this.maxAgeMs = ms((configured ?? '8h') as ms.StringValue);
  }

  isExpired(sessionCreatedAt: unknown): boolean {
    return isSessionExpired(sessionCreatedAt, this.maxAgeMs);
  }

  getAgeMs(sessionCreatedAt: unknown): number {
    return getSessionAgeMs(sessionCreatedAt);
  }

  getRemainingMs(sessionCreatedAt: unknown): number {
    return getRemainingSessionMs(sessionCreatedAt, this.maxAgeMs);
  }
}
