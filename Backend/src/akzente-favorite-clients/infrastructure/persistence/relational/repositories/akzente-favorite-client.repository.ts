import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AkzenteFavoriteClientEntity } from '../entities/akzente-favorite-client.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AkzenteFavoriteClient } from '../../../../domain/akzente-favorite-client';
import { AkzenteFavoriteClientRepository } from '../../akzente-favorite-client.repository';
import { AkzenteFavoriteClientMapper } from '../mappers/akzente-favorite-client.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AkzenteFavoriteClientRelationalRepository
  implements AkzenteFavoriteClientRepository
{
  constructor(
    @InjectRepository(AkzenteFavoriteClientEntity)
    private readonly akzenteFavoriteClientRepository: Repository<AkzenteFavoriteClientEntity>,
  ) {}

  async create(data: AkzenteFavoriteClient): Promise<AkzenteFavoriteClient> {
    const persistenceModel = AkzenteFavoriteClientMapper.toPersistence(data);
    const newEntity = await this.akzenteFavoriteClientRepository.save(
      this.akzenteFavoriteClientRepository.create(persistenceModel),
    );
    return AkzenteFavoriteClientMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteClient[]> {
    const entities = await this.akzenteFavoriteClientRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => AkzenteFavoriteClientMapper.toDomain(entity));
  }

  async findById(
    id: AkzenteFavoriteClient['id'],
  ): Promise<NullableType<AkzenteFavoriteClient>> {
    const entity = await this.akzenteFavoriteClientRepository.findOne({
      where: { id },
    });

    return entity ? AkzenteFavoriteClientMapper.toDomain(entity) : null;
  }

  async findByIds(ids: AkzenteFavoriteClient['id'][]): Promise<AkzenteFavoriteClient[]> {
    const entities = await this.akzenteFavoriteClientRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => AkzenteFavoriteClientMapper.toDomain(entity));
  }

  async update(
    id: AkzenteFavoriteClient['id'],
    payload: Partial<AkzenteFavoriteClient>,
  ): Promise<AkzenteFavoriteClient> {
    const entity = await this.akzenteFavoriteClientRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.akzenteFavoriteClientRepository.save(
      this.akzenteFavoriteClientRepository.create(
        AkzenteFavoriteClientMapper.toPersistence({
          ...AkzenteFavoriteClientMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AkzenteFavoriteClientMapper.toDomain(updatedEntity);
  }

  async remove(id: AkzenteFavoriteClient['id']): Promise<void> {
    await this.akzenteFavoriteClientRepository.delete(id);
  }
}
