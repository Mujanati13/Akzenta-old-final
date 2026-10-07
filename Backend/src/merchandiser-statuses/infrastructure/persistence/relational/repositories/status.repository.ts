import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Status } from '../../../../domain/status';
import { StatusRepository } from '../../status.repository';
import { StatusMapper } from '../mappers/status.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { MerchandiserStatusEntity } from '../entities/status.entity';

@Injectable()
export class StatusRelationalRepository implements StatusRepository {
  constructor(
    @InjectRepository(MerchandiserStatusEntity)
    private readonly statusRepository: Repository<MerchandiserStatusEntity>,
  ) {}

  async create(data: Status): Promise<Status> {
    const persistenceModel = StatusMapper.toPersistence(data);
    const newEntity = await this.statusRepository.save(
      this.statusRepository.create(persistenceModel),
    );
    return StatusMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Status[]; totalCount: number }> {
    const [entities, totalCount] = await this.statusRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return {
      data: entities.map((entity) => StatusMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Status['id']): Promise<NullableType<Status>> {
    const entity = await this.statusRepository.findOne({
      where: { id },
    });

    return entity ? StatusMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Status['id'][]): Promise<Status[]> {
    const entities = await this.statusRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => StatusMapper.toDomain(entity));
  }

  async update(
    id: Status['id'],
    payload: Partial<Status>,
  ): Promise<Status | null> {
    const entity = await this.statusRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.statusRepository.save(
      this.statusRepository.create(
        StatusMapper.toPersistence({
          ...StatusMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return StatusMapper.toDomain(updatedEntity);
  }

  async remove(id: Status['id']): Promise<void> {
    await this.statusRepository.delete(id);
  }
}
