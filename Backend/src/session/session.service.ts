import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SessionRepository } from './infrastructure/persistence/session.repository';
import { Session } from './domain/session';
import { User } from '../users/domain/user';
import { NullableType } from '../utils/types/nullable.type';
import { isSessionExpired } from '../utils/session-timestamp.util';
import ms from 'ms';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class SessionService {
  private readonly maxSessionAgeMs: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    const configured = this.configService.get('auth.sessionMaxAge', {
      infer: true,
    });
    this.maxSessionAgeMs = ms((configured ?? '8h') as ms.StringValue);
  }

  findById(id: Session['id']): Promise<NullableType<Session>> {
    return this.sessionRepository.findById(id);
  }

  create(
    data: Omit<
      Session,
      'id' | 'createdAt' | 'lastActivityAt' | 'updatedAt' | 'deletedAt'
    >,
  ): Promise<Session> {
    return this.sessionRepository.create(data);
  }

  touchActivity(
    id: Session['id'],
    minIntervalMs?: number,
  ): Promise<void> {
    return this.sessionRepository.touchActivity(id, minIntervalMs);
  }

  update(
    id: Session['id'],
    payload: Partial<
      Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    >,
  ): Promise<Session | null> {
    return this.sessionRepository.update(id, payload);
  }

  deleteById(id: Session['id']): Promise<void> {
    return this.sessionRepository.deleteById(id);
  }

  deleteByUserId(conditions: { userId: User['id'] }): Promise<void> {
    return this.sessionRepository.deleteByUserId(conditions);
  }

  deleteByUserIdWithExclude(conditions: {
    userId: User['id'];
    excludeSessionId: Session['id'];
  }): Promise<void> {
    return this.sessionRepository.deleteByUserIdWithExclude(conditions);
  }

  async hasActiveSessions(userId: User['id']): Promise<boolean> {
    const sessions = await this.sessionRepository.findByUserId(userId);
    return sessions.some((session) => {
      const activityAt = session.lastActivityAt ?? session.updatedAt ?? session.createdAt;
      return !isSessionExpired(activityAt, this.maxSessionAgeMs);
    });
  }

  async hasRecentActivity(
    userId: User['id'],
    windowMs: number,
  ): Promise<boolean> {
    const sessions =
      await this.sessionRepository.findByUserIdWithinWindow(userId, windowMs);
    return sessions.length > 0;
  }
}
