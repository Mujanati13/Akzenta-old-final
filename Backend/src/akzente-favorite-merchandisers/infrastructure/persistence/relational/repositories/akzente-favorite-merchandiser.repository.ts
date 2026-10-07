import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AkzenteFavoriteMerchandiserEntity } from '../entities/akzente-favorite-merchandiser.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AkzenteFavoriteMerchandiser } from '../../../../domain/akzente-favorite-merchandiser';
import { AkzenteFavoriteMerchandiserRepository } from '../../akzente-favorite-merchandiser.repository';
import { AkzenteFavoriteMerchandiserMapper } from '../mappers/akzente-favorite-merchandiser.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AkzenteFavoriteMerchandiserRelationalRepository
  implements AkzenteFavoriteMerchandiserRepository
{
  constructor(
    @InjectRepository(AkzenteFavoriteMerchandiserEntity)
    private readonly akzenteFavoriteMerchandiserRepository: Repository<AkzenteFavoriteMerchandiserEntity>,
  ) {}

  async create(data: AkzenteFavoriteMerchandiser): Promise<AkzenteFavoriteMerchandiser> {
    const persistenceModel = AkzenteFavoriteMerchandiserMapper.toPersistence(data);
    const newEntity = await this.akzenteFavoriteMerchandiserRepository.save(
      this.akzenteFavoriteMerchandiserRepository.create(persistenceModel),
    );
    return AkzenteFavoriteMerchandiserMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteMerchandiser[]> {
    const entities = await this.akzenteFavoriteMerchandiserRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => AkzenteFavoriteMerchandiserMapper.toDomain(entity));
  }

  async findById(
    id: AkzenteFavoriteMerchandiser['id'],
  ): Promise<NullableType<AkzenteFavoriteMerchandiser>> {
    const entity = await this.akzenteFavoriteMerchandiserRepository.findOne({
      where: { id },
    });

    return entity ? AkzenteFavoriteMerchandiserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: AkzenteFavoriteMerchandiser['id'][]): Promise<AkzenteFavoriteMerchandiser[]> {
    const entities = await this.akzenteFavoriteMerchandiserRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => AkzenteFavoriteMerchandiserMapper.toDomain(entity));
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteMerchandiser[]> {
    const entities = await this.akzenteFavoriteMerchandiserRepository.find({
      where: { akzente: { id: akzenteId } },
    });

    return entities.map((entity) => AkzenteFavoriteMerchandiserMapper.toDomain(entity));
  }

  async update(
    id: AkzenteFavoriteMerchandiser['id'],
    payload: Partial<AkzenteFavoriteMerchandiser>,
  ): Promise<AkzenteFavoriteMerchandiser> {
    const entity = await this.akzenteFavoriteMerchandiserRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.akzenteFavoriteMerchandiserRepository.save(
      this.akzenteFavoriteMerchandiserRepository.create(
        AkzenteFavoriteMerchandiserMapper.toPersistence({
          ...AkzenteFavoriteMerchandiserMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AkzenteFavoriteMerchandiserMapper.toDomain(updatedEntity);
  }

  async remove(id: AkzenteFavoriteMerchandiser['id']): Promise<void> {
    await this.akzenteFavoriteMerchandiserRepository.delete(id);
  }
}
