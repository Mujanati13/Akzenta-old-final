import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AkzenteFavoriteProjectEntity } from '../entities/akzente-favorite-project.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AkzenteFavoriteProject } from '../../../../domain/akzente-favorite-project';
import { AkzenteFavoriteProjectMapper } from '../mappers/akzente-favorite-project.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { AkzenteFavoriteProjectRepository } from '../../akzente-favorite-project.repository';

@Injectable()
export class AkzenteFavoriteProjectRelationalRepository
  implements AkzenteFavoriteProjectRepository
{
  constructor(
    @InjectRepository(AkzenteFavoriteProjectEntity)
    private readonly akzenteFavoriteProjectRepository: Repository<AkzenteFavoriteProjectEntity>,
  ) {}

  async create(data: AkzenteFavoriteProject): Promise<AkzenteFavoriteProject> {
    const persistenceModel = AkzenteFavoriteProjectMapper.toPersistence(data);
    const newEntity = await this.akzenteFavoriteProjectRepository.save(
      this.akzenteFavoriteProjectRepository.create(persistenceModel),
    );
    return AkzenteFavoriteProjectMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteProject[]> {
    const entities = await this.akzenteFavoriteProjectRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => AkzenteFavoriteProjectMapper.toDomain(entity));
  }

  async findById(
    id: AkzenteFavoriteProject['id'],
  ): Promise<NullableType<AkzenteFavoriteProject>> {
    const entity = await this.akzenteFavoriteProjectRepository.findOne({
      where: { id },
    });

    return entity ? AkzenteFavoriteProjectMapper.toDomain(entity) : null;
  }

  async findByIds(ids: AkzenteFavoriteProject['id'][]): Promise<AkzenteFavoriteProject[]> {
    const entities = await this.akzenteFavoriteProjectRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => AkzenteFavoriteProjectMapper.toDomain(entity));
  }

  findOne(options: { akzenteId: number; projectId: number }): Promise<NullableType<AkzenteFavoriteProject>> {
    return this.akzenteFavoriteProjectRepository.findOne({
      where: {
        akzente: { id: options.akzenteId },
        project: { id: options.projectId },
      },
      relations: ['akzente', 'project'],
    }).then(entity => entity ? AkzenteFavoriteProjectMapper.toDomain(entity) : null);
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteProject[]> {
    const entities = await this.akzenteFavoriteProjectRepository.find({
      where: { akzente: { id: akzenteId } },
      relations: ['akzente', 'project', 'project.clientCompany'],
    });

    return entities.map((entity) => AkzenteFavoriteProjectMapper.toDomain(entity));
  }

  async update(
    id: AkzenteFavoriteProject['id'],
    payload: Partial<AkzenteFavoriteProject>,
  ): Promise<AkzenteFavoriteProject> {
    const entity = await this.akzenteFavoriteProjectRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.akzenteFavoriteProjectRepository.save(
      this.akzenteFavoriteProjectRepository.create(
        AkzenteFavoriteProjectMapper.toPersistence({
          ...AkzenteFavoriteProjectMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AkzenteFavoriteProjectMapper.toDomain(updatedEntity);
  }

  async remove(id: AkzenteFavoriteProject['id']): Promise<void> {
    await this.akzenteFavoriteProjectRepository.delete(id);
  }
}
