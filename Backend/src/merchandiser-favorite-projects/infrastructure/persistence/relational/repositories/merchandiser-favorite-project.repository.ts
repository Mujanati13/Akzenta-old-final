import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MerchandiserFavoriteProjectEntity } from '../entities/merchandiser-favorite-project.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserFavoriteProject } from '../../../../domain/merchandiser-favorite-project';
import { MerchandiserFavoriteProjectMapper } from '../mappers/merchandiser-favorite-project.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { MerchandiserFavoriteProjectRepository } from '../../merchandiser-favorite-project.repository';

@Injectable()
export class MerchandiserFavoriteProjectRelationalRepository
  implements MerchandiserFavoriteProjectRepository
{
  constructor(
    @InjectRepository(MerchandiserFavoriteProjectEntity)
    private readonly merchandiserFavoriteProjectRepository: Repository<MerchandiserFavoriteProjectEntity>,
  ) {}

  async create(data: MerchandiserFavoriteProject): Promise<MerchandiserFavoriteProject> {
    const persistenceModel = MerchandiserFavoriteProjectMapper.toPersistence(data);
    const newEntity = await this.merchandiserFavoriteProjectRepository.save(
      this.merchandiserFavoriteProjectRepository.create(persistenceModel),
    );
    return MerchandiserFavoriteProjectMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<MerchandiserFavoriteProject[]> {
    const entities = await this.merchandiserFavoriteProjectRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => MerchandiserFavoriteProjectMapper.toDomain(entity));
  }

  async findById(
    id: MerchandiserFavoriteProject['id'],
  ): Promise<NullableType<MerchandiserFavoriteProject>> {
    const entity = await this.merchandiserFavoriteProjectRepository.findOne({
      where: { id },
    });

    return entity ? MerchandiserFavoriteProjectMapper.toDomain(entity) : null;
  }

  async findByIds(ids: MerchandiserFavoriteProject['id'][]): Promise<MerchandiserFavoriteProject[]> {
    const entities = await this.merchandiserFavoriteProjectRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => MerchandiserFavoriteProjectMapper.toDomain(entity));
  }

  findOne(options: { merchandiserId: number; projectId: number }): Promise<NullableType<MerchandiserFavoriteProject>> {
    return this.merchandiserFavoriteProjectRepository.findOne({
      where: {
        merchandiser: { id: options.merchandiserId },
        project: { id: options.projectId },
      },
      relations: ['merchandiser', 'project'],
    }).then(entity => entity ? MerchandiserFavoriteProjectMapper.toDomain(entity) : null);
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteProject[]> {
    const entities = await this.merchandiserFavoriteProjectRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['merchandiser', 'project', 'project.clientCompany'],
    });

    return entities.map((entity) => MerchandiserFavoriteProjectMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserFavoriteProject['id'],
    payload: Partial<MerchandiserFavoriteProject>,
  ): Promise<MerchandiserFavoriteProject> {
    const entity = await this.merchandiserFavoriteProjectRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.merchandiserFavoriteProjectRepository.save(
      this.merchandiserFavoriteProjectRepository.create(
        MerchandiserFavoriteProjectMapper.toPersistence({
          ...MerchandiserFavoriteProjectMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserFavoriteProjectMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserFavoriteProject['id']): Promise<void> {
    await this.merchandiserFavoriteProjectRepository.delete(id);
  }
}
