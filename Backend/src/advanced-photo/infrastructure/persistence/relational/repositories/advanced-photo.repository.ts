import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvancedPhotoEntity } from '../entities/advanced-photo.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AdvancedPhoto } from '../../../../domain/advanced-photo';
import { AdvancedPhotoRepository } from '../../advanced-photo.repository';
import { AdvancedPhotoMapper } from '../mappers/advanced-photo.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AdvancedPhotoRelationalRepository
  implements AdvancedPhotoRepository
{
  constructor(
    @InjectRepository(AdvancedPhotoEntity)
    private readonly advancedPhotoRepository: Repository<AdvancedPhotoEntity>,
  ) {}

  async create(data: AdvancedPhoto): Promise<AdvancedPhoto> {
    const persistenceModel = AdvancedPhotoMapper.toPersistence(data);
    const newEntity = await this.advancedPhotoRepository.save(
      this.advancedPhotoRepository.create(persistenceModel),
    );
    return AdvancedPhotoMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AdvancedPhoto[]; totalCount: number }> {
    const [entities, totalCount] =
      await this.advancedPhotoRepository.findAndCount({
        skip: (paginationOptions.page - 1) * paginationOptions.limit,
        take: paginationOptions.limit,
      });

    return {
      data: entities.map((entity) => AdvancedPhotoMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(
    id: AdvancedPhoto['id'],
  ): Promise<NullableType<AdvancedPhoto>> {
    const entity = await this.advancedPhotoRepository.findOne({
      where: { id },
    });

    return entity ? AdvancedPhotoMapper.toDomain(entity) : null;
  }

  async findByProjectId(projectId: number): Promise<AdvancedPhoto[]> {
    const entities = await this.advancedPhotoRepository.find({
      where: { project: { id: projectId } },
      order: { createdAt: 'ASC' },
    });
    return entities.map((entity) => AdvancedPhotoMapper.toDomain(entity));
  }

  async findByIds(ids: AdvancedPhoto['id'][]): Promise<AdvancedPhoto[]> {
    const entities = await this.advancedPhotoRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => AdvancedPhotoMapper.toDomain(entity));
  }

  async update(
    id: AdvancedPhoto['id'],
    payload: Partial<AdvancedPhoto>,
  ): Promise<AdvancedPhoto | null> {
    const entity = await this.advancedPhotoRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.advancedPhotoRepository.save(
      this.advancedPhotoRepository.create(
        AdvancedPhotoMapper.toPersistence({
          ...AdvancedPhotoMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AdvancedPhotoMapper.toDomain(updatedEntity);
  }

  async remove(id: AdvancedPhoto['id']): Promise<void> {
    await this.advancedPhotoRepository.delete(id);
  }
}
