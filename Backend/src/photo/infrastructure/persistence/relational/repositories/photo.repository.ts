import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhotoEntity } from '../entities/photo.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Photo } from '../../../../domain/photo';
import { PhotoRepository } from '../../photo.repository';
import { PhotoMapper } from '../mappers/photo.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class PhotoRelationalRepository implements PhotoRepository {
  constructor(
    @InjectRepository(PhotoEntity)
    private readonly photoRepository: Repository<PhotoEntity>,
  ) {}

  async create(data: Photo): Promise<Photo> {
    const persistenceModel = PhotoMapper.toPersistence(data);
    const newEntity = await this.photoRepository.save(
      this.photoRepository.create(persistenceModel),
    );
    return PhotoMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Photo[]; totalCount: number }> {
    const [entities, totalCount] = await this.photoRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return {
      data: entities.map((entity) => PhotoMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Photo['id']): Promise<NullableType<Photo>> {
    const entity = await this.photoRepository.findOne({
      where: { id },
    });

    return entity ? PhotoMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Photo['id'][]): Promise<Photo[]> {
    const entities = await this.photoRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => PhotoMapper.toDomain(entity));
  }

  async update(
    id: Photo['id'],
    payload: Partial<Photo>,
  ): Promise<Photo | null> {
    const entity = await this.photoRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.photoRepository.save(
      this.photoRepository.create(
        PhotoMapper.toPersistence({
          ...PhotoMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return PhotoMapper.toDomain(updatedEntity);
  }

  async remove(id: Photo['id']): Promise<void> {
    await this.photoRepository.delete(id);
  }
}
