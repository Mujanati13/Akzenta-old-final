import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AkzenteEntity } from '../entities/akzente.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Akzente } from '../../../../domain/akzente';
import { AkzenteRepository } from '../../akzente.repository';
import { AkzenteMapper } from '../mappers/akzente.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AkzenteRelationalRepository implements AkzenteRepository {
  constructor(
    @InjectRepository(AkzenteEntity)
    private readonly akzenteRepository: Repository<AkzenteEntity>,
  ) {}

  async create(data: Akzente): Promise<Akzente> {
    const persistenceModel = AkzenteMapper.toPersistence(data);
    const newEntity = await this.akzenteRepository.save(
      this.akzenteRepository.create(persistenceModel),
    );
    return AkzenteMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Akzente[]; totalCount: number }> {
    const [entities, totalCount] = await this.akzenteRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    const data = entities.map((entity) => AkzenteMapper.toDomain(entity));

    return {
      data,
      totalCount,
    };
  }

  async findById(id: Akzente['id']): Promise<NullableType<Akzente>> {
    // Validate id
    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      console.error('❌ Invalid id in findById:', {
        id,
        idType: typeof id,
        numericId: Number(id),
        isNaN: isNaN(Number(id)),
      });
      return null;
    }

    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    
    const entity = await this.akzenteRepository.findOne({
      where: { id: numericId },
    });

    return entity ? AkzenteMapper.toDomain(entity) : null;
  }

  async findByUserId(userId: Akzente['user']['id']): Promise<NullableType<Akzente>> {
    // Validate userId
    if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
      console.error('❌ Invalid userId in findByUserId:', {
        userId,
        userIdType: typeof userId,
        numericUserId: Number(userId),
        isNaN: isNaN(Number(userId)),
      });
      return null;
    }

    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    const entity = await this.akzenteRepository.findOne({
      where: { user: { id: numericUserId } },
    });

    return entity ? AkzenteMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Akzente['id'][]): Promise<Akzente[]> {
    const entities = await this.akzenteRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => AkzenteMapper.toDomain(entity));
  }

  async update(
    id: Akzente['id'],
    payload: Partial<Akzente>,
  ): Promise<Akzente | null> {
    const entity = await this.akzenteRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.akzenteRepository.save(
      this.akzenteRepository.create(
        AkzenteMapper.toPersistence({
          ...AkzenteMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AkzenteMapper.toDomain(updatedEntity);
  }

  async remove(id: Akzente['id']): Promise<void> {
    await this.akzenteRepository.delete(id);
  }
}
