import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchandiserFavoriteReportEntity } from '../entities/merchandiser-favorite-report.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserFavoriteReports } from '../../../../domain/merchandiser-favorite-reports';
import { MerchandiserFavoriteReportRepository } from '../../merchandiser-favorite-report.repository';
import { MerchandiserFavoriteReportMapper } from '../mappers/merchandiser-favorite-report.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MerchandiserFavoriteReportRelationalRepository implements MerchandiserFavoriteReportRepository {
  constructor(
    @InjectRepository(MerchandiserFavoriteReportEntity)
    private readonly merchandiserFavoriteReportRepository: Repository<MerchandiserFavoriteReportEntity>,
  ) {}

  async create(data: Omit<MerchandiserFavoriteReports, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserFavoriteReports> {
    const persistenceModel = MerchandiserFavoriteReportMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.merchandiserFavoriteReportRepository.save(
      this.merchandiserFavoriteReportRepository.create(persistenceModel),
    );
    return MerchandiserFavoriteReportMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserFavoriteReports[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserFavoriteReportRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['report', 'merchandiser'],
    });

    return {
      data: entities.map((entity) => MerchandiserFavoriteReportMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserFavoriteReports['id']): Promise<NullableType<MerchandiserFavoriteReports>> {
    const entity = await this.merchandiserFavoriteReportRepository.findOne({
      where: { id },
      relations: ['report', 'merchandiser'],
    });

    return entity ? MerchandiserFavoriteReportMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteReports[]> {
    const entities = await this.merchandiserFavoriteReportRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['report', 'merchandiser'],
    });

    return entities.map((entity) => MerchandiserFavoriteReportMapper.toDomain(entity));
  }

  async findOne({
    merchandiserId,
    reportId,
  }: {
    merchandiserId: number;
    reportId: number;
  }): Promise<MerchandiserFavoriteReports | null> {
    const entity = await this.merchandiserFavoriteReportRepository.findOne({
      where: { 
        merchandiser: { id: merchandiserId },
        report: { id: reportId }
      },
      relations: ['report', 'merchandiser'],
    });

    return entity ? MerchandiserFavoriteReportMapper.toDomain(entity) : null;
  }

  async remove(id: MerchandiserFavoriteReports['id']): Promise<void> {
    await this.merchandiserFavoriteReportRepository.delete(id);
  }
}