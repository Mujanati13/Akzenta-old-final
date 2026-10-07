import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadedAdvancedPhotoEntity } from '../entities/uploaded-advanced-photo.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { UploadedAdvancedPhoto } from '../../../../domain/uploaded-advanced-photo';
import { UploadedAdvancedPhotoRepository } from '../../uploaded-advanced-photo.repository';
import { UploadedAdvancedPhotoMapper } from '../mappers/uploaded-advanced-photo.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class UploadedAdvancedPhotoRelationalRepository
  implements UploadedAdvancedPhotoRepository
{
  constructor(
    @InjectRepository(UploadedAdvancedPhotoEntity)
    private readonly uploadedAdvancedPhotoRepository: Repository<UploadedAdvancedPhotoEntity>,
  ) {}

  async create(data: UploadedAdvancedPhoto): Promise<UploadedAdvancedPhoto> {
    const persistenceModel = UploadedAdvancedPhotoMapper.toPersistence(data);
    const newEntity = await this.uploadedAdvancedPhotoRepository.save(
      this.uploadedAdvancedPhotoRepository.create(persistenceModel),
    );
    return UploadedAdvancedPhotoMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: UploadedAdvancedPhoto[]; totalCount: number }> {
    const [entities, totalCount] =
      await this.uploadedAdvancedPhotoRepository.findAndCount({
        skip: (paginationOptions.page - 1) * paginationOptions.limit,
        take: paginationOptions.limit,
      });

    return {
      data: entities.map((entity) =>
        UploadedAdvancedPhotoMapper.toDomain(entity),
      ),
      totalCount,
    };
  }

  async findById(
    id: UploadedAdvancedPhoto['id'],
  ): Promise<NullableType<UploadedAdvancedPhoto>> {
    const entity = await this.uploadedAdvancedPhotoRepository.findOne({
      where: { id },
    });

    return entity ? UploadedAdvancedPhotoMapper.toDomain(entity) : null;
  }

  async findByFileId(
    fileId: string,
  ): Promise<NullableType<UploadedAdvancedPhoto>> {
    const entity = await this.uploadedAdvancedPhotoRepository.findOne({
      where: {
        file: {
          id: fileId,
        },
      },
      order: {
        id: 'DESC',
      },
    });

    return entity ? UploadedAdvancedPhotoMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: UploadedAdvancedPhoto['id'][],
  ): Promise<UploadedAdvancedPhoto[]> {
    const entities = await this.uploadedAdvancedPhotoRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) =>
      UploadedAdvancedPhotoMapper.toDomain(entity),
    );
  }

  async update(
    id: UploadedAdvancedPhoto['id'],
    payload: Partial<UploadedAdvancedPhoto>,
  ): Promise<UploadedAdvancedPhoto | null> {
    const entity = await this.uploadedAdvancedPhotoRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }


    // Convert payload to persistence model for direct field updates
    const persistencePayload: Partial<UploadedAdvancedPhotoEntity> = {};
    
    // Only include fields that are explicitly provided in the payload
    if (payload.label !== undefined) {
      persistencePayload.label = payload.label;
    }
    if (payload.beforeAfterType !== undefined) {
      persistencePayload.beforeAfterType = payload.beforeAfterType;
    }
    if (payload.order !== undefined) {
      persistencePayload.order = payload.order;
    }
    if (payload.advancedPhoto !== undefined) {
      const persistenceModel = UploadedAdvancedPhotoMapper.toPersistence({
        ...UploadedAdvancedPhotoMapper.toDomain(entity),
        ...payload,
      });
      persistencePayload.advancedPhoto = persistenceModel.advancedPhoto;
    }
    if (payload.file !== undefined) {
      const persistenceModel = UploadedAdvancedPhotoMapper.toPersistence({
          ...UploadedAdvancedPhotoMapper.toDomain(entity),
          ...payload,
      });
      persistencePayload.file = persistenceModel.file;
    }


    // Use TypeORM update for partial updates (handles nullable fields correctly)
    const updateResult = await this.uploadedAdvancedPhotoRepository.update(id, persistencePayload);
    

    // Fetch and return the updated entity
    const updatedEntity = await this.uploadedAdvancedPhotoRepository.findOne({
      where: { id },
    });



    return updatedEntity ? UploadedAdvancedPhotoMapper.toDomain(updatedEntity) : null;
  }

  async remove(id: UploadedAdvancedPhoto['id']): Promise<void> {
    await this.uploadedAdvancedPhotoRepository.delete(id);
  }
}
