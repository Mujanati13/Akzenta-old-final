import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MerchandiserFilesEntity } from '../entities/merchandiser-files.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserFiles, MerchandiserFileType } from '../../../../domain/merchandiser-files';
import { MerchandiserFilesRepository } from '../../merchandiser-files.repository';
import { MerchandiserFilesMapper } from '../mappers/merchandiser-files.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MerchandiserFilesRelationalRepository implements MerchandiserFilesRepository {
  constructor(
    @InjectRepository(MerchandiserFilesEntity)
    private readonly merchandiserFilesRepository: Repository<MerchandiserFilesEntity>,
  ) {}

  async create(data: Omit<MerchandiserFiles, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserFiles> {
    const persistenceModel = MerchandiserFilesMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.merchandiserFilesRepository.save(
      this.merchandiserFilesRepository.create(persistenceModel),
    );
    
    // Reload with file relation for response
    const savedEntity = await this.merchandiserFilesRepository.findOne({
      where: { id: newEntity.id },
      relations: ['file'],
    });
    
    return MerchandiserFilesMapper.toDomain(savedEntity!);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserFiles[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserFilesRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['file'], // Only load file, not merchandiser
    });

    return {
      data: entities.map((entity) => MerchandiserFilesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserFiles['id']): Promise<NullableType<MerchandiserFiles>> {
    const entity = await this.merchandiserFilesRepository.findOne({
      where: { id },
      relations: ['file'], // Only load file, not merchandiser
    });

    return entity ? MerchandiserFilesMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFiles[]> {
    const entities = await this.merchandiserFilesRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['file'], // Only load file, not merchandiser
      order: { id: 'ASC' },
    });

    return entities.map((entity) => MerchandiserFilesMapper.toDomain(entity));
  }

  async findByMerchandiserIdAndType(
    merchandiserId: number,
    type: MerchandiserFileType,
  ): Promise<MerchandiserFiles[]> {
    const entities = await this.merchandiserFilesRepository.find({
      where: {
        merchandiser: { id: merchandiserId },
        type: type,
      },
      relations: ['file'], // Only load file, not merchandiser
    });

    return entities.map((entity) => MerchandiserFilesMapper.toDomain(entity));
  }

  async findByType(type: MerchandiserFileType): Promise<MerchandiserFiles[]> {
    const entities = await this.merchandiserFilesRepository.find({
      where: { type: type },
      relations: ['file'], // Only load file, not merchandiser
    });

    return entities.map((entity) => MerchandiserFilesMapper.toDomain(entity));
  }

  async findByMerchandiserIdsAndType(
    merchandiserIds: number[],
    type: MerchandiserFileType,
  ): Promise<MerchandiserFiles[]> {
    if (!merchandiserIds || merchandiserIds.length === 0) {
      return [];
    }

    // Fetch all portraits for the given merchandisers in a single query (much faster!)
    // Use query builder to access merchandiser_id column directly and select it
    const entities = await this.merchandiserFilesRepository
      .createQueryBuilder('mf')
      .leftJoinAndSelect('mf.file', 'file')
      .addSelect('mf.merchandiser_id', 'merchandiser_id') // Explicitly select merchandiser_id
      .where('mf.merchandiser_id IN (:...merchandiserIds)', { merchandiserIds })
      .andWhere('mf.type = :type', { type })
      .orderBy('mf.id', 'ASC')
      .getMany();

    // Group by merchandiser ID and take only the first portrait for each
    // Access merchandiser_id from the raw entity data
    const portraitMap = new Map<number, MerchandiserFilesEntity>();
    for (const entity of entities) {
      // Access merchandiser_id from raw entity or relation
      const merchandiserId = (entity as any).merchandiser_id || 
                            (entity.merchandiser as any)?.id ||
                            (entity as any).merchandiser?.id;
      if (merchandiserId && !portraitMap.has(merchandiserId)) {
        portraitMap.set(merchandiserId, entity);
      }
    }

    return Array.from(portraitMap.values()).map((entity) => MerchandiserFilesMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserFiles['id'],
    payload: Partial<MerchandiserFiles>,
  ): Promise<MerchandiserFiles | null> {
    const entity = await this.merchandiserFilesRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'file'], // Load both for update operation
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserFilesRepository.save(
      this.merchandiserFilesRepository.create(
        MerchandiserFilesMapper.toPersistence({
          ...MerchandiserFilesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    // Reload with only file relation for response
    const savedEntity = await this.merchandiserFilesRepository.findOne({
      where: { id: updatedEntity.id },
      relations: ['file'],
    });

    return MerchandiserFilesMapper.toDomain(savedEntity!);
  }

  async remove(id: MerchandiserFiles['id']): Promise<void> {
    await this.merchandiserFilesRepository.delete(id);
  }
}