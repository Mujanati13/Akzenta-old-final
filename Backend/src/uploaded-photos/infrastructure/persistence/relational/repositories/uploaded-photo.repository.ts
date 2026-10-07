import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadedPhotoEntity } from '../entities/uploaded-photo.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { UploadedPhoto } from '../../../../domain/uploaded-photo';
import { UploadedPhotoRepository } from '../../uploaded-photo.repository';
import { UploadedPhotoMapper } from '../mappers/uploaded-photo.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class UploadedPhotoRelationalRepository
  implements UploadedPhotoRepository
{
  constructor(
    @InjectRepository(UploadedPhotoEntity)
    private readonly uploadedPhotoRepository: Repository<UploadedPhotoEntity>,
  ) {}

  async create(data: UploadedPhoto): Promise<UploadedPhoto> {
    const persistenceModel = UploadedPhotoMapper.toPersistence(data);
    const newEntity = await this.uploadedPhotoRepository.save(
      this.uploadedPhotoRepository.create(persistenceModel),
    );
    return UploadedPhotoMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: UploadedPhoto[]; totalCount: number }> {
    const [entities, totalCount] =
      await this.uploadedPhotoRepository.findAndCount({
        skip: (paginationOptions.page - 1) * paginationOptions.limit,
        take: paginationOptions.limit,
      });

    return {
      data: entities.map((entity) => UploadedPhotoMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(
    id: UploadedPhoto['id'],
  ): Promise<NullableType<UploadedPhoto>> {
    const entity = await this.uploadedPhotoRepository.findOne({
      where: { id },
    });

    return entity ? UploadedPhotoMapper.toDomain(entity) : null;
  }

  async findByIds(ids: UploadedPhoto['id'][]): Promise<UploadedPhoto[]> {
    const entities = await this.uploadedPhotoRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => UploadedPhotoMapper.toDomain(entity));
  }

  async update(
    id: UploadedPhoto['id'],
    payload: Partial<UploadedPhoto>,
  ): Promise<UploadedPhoto | null> {
    const entity = await this.uploadedPhotoRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.uploadedPhotoRepository.save(
      this.uploadedPhotoRepository.create(
        UploadedPhotoMapper.toPersistence({
          ...UploadedPhotoMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return UploadedPhotoMapper.toDomain(updatedEntity);
  }

  async remove(id: UploadedPhoto['id']): Promise<void> {
    await this.uploadedPhotoRepository.delete(id);
  }
}
