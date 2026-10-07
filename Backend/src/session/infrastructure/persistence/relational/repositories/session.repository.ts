import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Not, Repository } from 'typeorm';
import { SessionEntity } from '../entities/session.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';

import { SessionRepository } from '../../session.repository';
import { Session } from '../../../../domain/session';

import { SessionMapper } from '../mappers/session.mapper';
import { User } from '../../../../../users/domain/user';

@Injectable()
export class SessionRelationalRepository implements SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
  ) {}

  async findById(id: Session['id']): Promise<NullableType<Session>> {
    const entity = await this.sessionRepository.findOne({
      where: {
        id: Number(id),
      },
    });

    return entity ? SessionMapper.toDomain(entity) : null;
  }

  async create(data: Session): Promise<Session> {
    const persistenceModel = SessionMapper.toPersistence(data);
    return this.sessionRepository.save(
      this.sessionRepository.create(persistenceModel),
    );
  }

  async update(
    id: Session['id'],
    payload: Partial<
      Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    >,
  ): Promise<Session | null> {
    const entity = await this.sessionRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Session not found');
    }

    const updatedEntity = await this.sessionRepository.save(
      this.sessionRepository.create(
        SessionMapper.toPersistence({
          ...SessionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SessionMapper.toDomain(updatedEntity);
  }

  async deleteById(id: Session['id']): Promise<void> {
    await this.sessionRepository.softDelete({
      id: Number(id),
    });
  }

  async deleteByUserId(conditions: { userId: User['id'] }): Promise<void> {
    await this.sessionRepository.softDelete({
      user: {
        id: Number(conditions.userId),
      },
    });
  }

  async deleteByUserIdWithExclude(conditions: {
    userId: User['id'];
    excludeSessionId: Session['id'];
  }): Promise<void> {
    await this.sessionRepository.softDelete({
      user: {
        id: Number(conditions.userId),
      },
      id: Not(Number(conditions.excludeSessionId)),
    });
  }

  async findByUserId(userId: User['id']): Promise<Session[]> {
    const entities = await this.sessionRepository.find({
      where: {
        user: { id: Number(userId) },
      },
      withDeleted: false,
    });

    return entities.map((entity) => SessionMapper.toDomain(entity));
  }

  async findByUserIdWithinWindow(
    userId: User['id'],
    windowMs: number,
  ): Promise<Session[]> {
    const threshold = new Date(Date.now() - windowMs);
    const entities = await this.sessionRepository.find({
      where: {
        user: { id: Number(userId) },
        lastActivityAt: MoreThanOrEqual(threshold),
      },
      withDeleted: false,
    });
    return entities.map((entity) => SessionMapper.toDomain(entity));
  }

  async touchActivity(
    id: Session['id'],
    minIntervalMs = 60_000,
  ): Promise<void> {
    const threshold = new Date(Date.now() - minIntervalMs);

    await this.sessionRepository
      .createQueryBuilder()
      .update(SessionEntity)
      .set({ lastActivityAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: Number(id) })
      .andWhere('"lastActivityAt" < :threshold', { threshold })
      .execute();
  }
}
