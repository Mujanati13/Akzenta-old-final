import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatusEntity } from '../entities/status.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ReportStatus } from '../../../../domain/status';
import { StatusRepository } from '../../status.repository';
import { StatusMapper } from '../mappers/status.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class StatusRelationalRepository implements StatusRepository {
  constructor(
    @InjectRepository(StatusEntity)
    private readonly statusRepository: Repository<StatusEntity>,
  ) {}

  async create(data: ReportStatus): Promise<ReportStatus> {
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
  }): Promise<{ data: ReportStatus[]; totalCount: number }> {
    const [entities, totalCount] = await this.statusRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return {
      data: entities.map((entity) => StatusMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: ReportStatus['id']): Promise<NullableType<ReportStatus>> {
    const entity = await this.statusRepository.findOne({
      where: { id },
    });

    return entity ? StatusMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ReportStatus['id'][]): Promise<ReportStatus[]> {
    const entities = await this.statusRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => StatusMapper.toDomain(entity));
  }

  async update(
    id: ReportStatus['id'],
    payload: Partial<ReportStatus>,
  ): Promise<ReportStatus | null> {
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

  async remove(id: ReportStatus['id']): Promise<void> {
    await this.statusRepository.delete(id);
  }
}
