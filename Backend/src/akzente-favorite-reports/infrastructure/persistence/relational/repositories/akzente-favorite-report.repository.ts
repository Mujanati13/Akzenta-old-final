import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AkzenteFavoriteReportEntity } from '../entities/akzente-favorite-report.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AkzenteFavoriteReport } from '../../../../domain/akzente-favorite-report';
import { AkzenteFavoriteReportRepository } from '../../akzente-favorite-report.repository';
import { AkzenteFavoriteReportMapper } from '../mappers/akzente-favorite-report.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AkzenteFavoriteReportRelationalRepository
  implements AkzenteFavoriteReportRepository
{
  constructor(
    @InjectRepository(AkzenteFavoriteReportEntity)
    private readonly akzenteFavoriteReportRepository: Repository<AkzenteFavoriteReportEntity>,
  ) {}

  async create(data: AkzenteFavoriteReport): Promise<AkzenteFavoriteReport> {
    const persistenceModel = AkzenteFavoriteReportMapper.toPersistence(data);
    const newEntity = await this.akzenteFavoriteReportRepository.save(
      this.akzenteFavoriteReportRepository.create(persistenceModel),
    );
    return AkzenteFavoriteReportMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteReport[]> {
    const entities = await this.akzenteFavoriteReportRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => AkzenteFavoriteReportMapper.toDomain(entity));
  }

  async findById(
    id: AkzenteFavoriteReport['id'],
  ): Promise<NullableType<AkzenteFavoriteReport>> {
    const entity = await this.akzenteFavoriteReportRepository.findOne({
      where: { id },
    });

    return entity ? AkzenteFavoriteReportMapper.toDomain(entity) : null;
  }

  async findByIds(ids: AkzenteFavoriteReport['id'][]): Promise<AkzenteFavoriteReport[]> {
    const entities = await this.akzenteFavoriteReportRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => AkzenteFavoriteReportMapper.toDomain(entity));
  }

    findOne(options: { akzenteId: number; reportId: number }): Promise<NullableType<AkzenteFavoriteReport>> {
    return this.akzenteFavoriteReportRepository.findOne({
      where: {
        akzente: { id: options.akzenteId },
        report: { id: options.reportId },
      },
      relations: [
        'akzente',
        'report',
        'report.project',
        'report.clientCompany',
        'report.branch',
        'report.status',
      ],
    }).then(entity => entity ? AkzenteFavoriteReportMapper.toDomain(entity) : null);
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteReport[]> {
    const entities = await this.akzenteFavoriteReportRepository.find({
      where: { akzente: { id: akzenteId } },
      relations: [
        'akzente',
        'report',
        'report.project',
        'report.clientCompany',
        'report.branch',
        'report.status',
      ],
    });

    return entities.map((entity) => AkzenteFavoriteReportMapper.toDomain(entity));
  }

  async findByAkzenteIdAndReportIds(akzenteId: number, reportIds: number[]): Promise<AkzenteFavoriteReport[]> {
    if (!reportIds || reportIds.length === 0) {
      return [];
    }
    
    const entities = await this.akzenteFavoriteReportRepository.find({
      where: {
        akzente: { id: akzenteId },
        report: { id: In(reportIds) },
      },
      relations: [
        'akzente',
        'report',
        'report.project',
        'report.clientCompany',
        'report.branch',
        'report.status',
      ],
    });

    return entities.map((entity) => AkzenteFavoriteReportMapper.toDomain(entity));
  }

  async update(
    id: AkzenteFavoriteReport['id'],
    payload: Partial<AkzenteFavoriteReport>,
  ): Promise<AkzenteFavoriteReport> {
    const entity = await this.akzenteFavoriteReportRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.akzenteFavoriteReportRepository.save(
      this.akzenteFavoriteReportRepository.create(
        AkzenteFavoriteReportMapper.toPersistence({
          ...AkzenteFavoriteReportMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AkzenteFavoriteReportMapper.toDomain(updatedEntity);
  }

  async remove(id: AkzenteFavoriteReport['id']): Promise<void> {
    await this.akzenteFavoriteReportRepository.delete(id);
  }
}
