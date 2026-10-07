import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportMailEntity } from '../entities/support-mail.entity';
import { SupportMailMapper } from '../mappers/support-mail.mapper';
import { SupportMail } from '../../../../domain/support-mail';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { SupportMailRepository } from '../../../persistence/support-mail.repository';
import { Client } from '../../../../../client/domain/client';

@Injectable()
export class SupportMailRelationalRepository implements SupportMailRepository {
  constructor(
    @InjectRepository(SupportMailEntity)
    private readonly supportMailRepository: Repository<SupportMailEntity>,
  ) {}

  async create(data: Omit<SupportMail, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupportMail> {
    const persistenceModel = SupportMailMapper.toPersistence(data as SupportMail);
    const newEntity = await this.supportMailRepository.save(
      this.supportMailRepository.create(persistenceModel),
    );
    return SupportMailMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<SupportMail[]> {
    const entities = await this.supportMailRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['client', 'client.user'],
    });

    return entities.map((entity) => SupportMailMapper.toDomain(entity));
  }

  async findById(id: SupportMail['id']): Promise<SupportMail | null> {
    const entity = await this.supportMailRepository.findOne({
      where: { id },
      relations: ['client', 'client.user'],
    });

    return entity ? SupportMailMapper.toDomain(entity) : null;
  }

  async findByClientId(clientId: Client['id']): Promise<SupportMail[]> {
    const entities = await this.supportMailRepository.find({
      where: { client: { id: clientId } },
      relations: ['client', 'client.user'],
    });

    return entities.map((entity) => SupportMailMapper.toDomain(entity));
  }

  async update(id: SupportMail['id'], payload: Partial<SupportMail>): Promise<SupportMail> {
    const entity = await this.supportMailRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('SupportMail not found');
    }

    const updatedEntity = await this.supportMailRepository.save(
      this.supportMailRepository.create(
        SupportMailMapper.toPersistence({
          ...SupportMailMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SupportMailMapper.toDomain(updatedEntity);
  }

  async remove(id: SupportMail['id']): Promise<void> {
    await this.supportMailRepository.delete(id);
  }
}

