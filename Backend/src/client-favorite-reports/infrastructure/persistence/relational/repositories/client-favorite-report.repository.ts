import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientFavoriteReportEntity } from '../entities/client-favorite-report.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ClientFavoriteReport } from '../../../../domain/client-favorite-report';
import { ClientFavoriteReportRepository } from '../../client-favorite-report.repository';
import { ClientFavoriteReportMapper } from '../mappers/client-favorite-report.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ClientFavoriteReportRelationalRepository
  implements ClientFavoriteReportRepository
{
  constructor(
    @InjectRepository(ClientFavoriteReportEntity)
    private readonly clientFavoriteReportRepository: Repository<ClientFavoriteReportEntity>,
  ) {}

  async create(data: ClientFavoriteReport): Promise<ClientFavoriteReport> {
    const persistenceModel = ClientFavoriteReportMapper.toPersistence(data);
    const newEntity = await this.clientFavoriteReportRepository.save(
      this.clientFavoriteReportRepository.create(persistenceModel),
    );
    return ClientFavoriteReportMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<ClientFavoriteReport[]> {
    const entities = await this.clientFavoriteReportRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => ClientFavoriteReportMapper.toDomain(entity));
  }

  async findById(
    id: ClientFavoriteReport['id'],
  ): Promise<NullableType<ClientFavoriteReport>> {
    const entity = await this.clientFavoriteReportRepository.findOne({
      where: { id },
    });

    return entity ? ClientFavoriteReportMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ClientFavoriteReport['id'][]): Promise<ClientFavoriteReport[]> {
    const entities = await this.clientFavoriteReportRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ClientFavoriteReportMapper.toDomain(entity));
  }

  findOne(options: { clientId: number; reportId: number }): Promise<NullableType<ClientFavoriteReport>> {
    return this.clientFavoriteReportRepository.findOne({
      where: {
        client: { id: options.clientId },
        report: { id: options.reportId },
      },
      relations: ['client', 'report'],
    }).then(entity => entity ? ClientFavoriteReportMapper.toDomain(entity) : null);
  }

  async findByClientId(clientId: number): Promise<ClientFavoriteReport[]> {
    const entities = await this.clientFavoriteReportRepository.find({
      where: { client: { id: clientId } },
      relations: ['client', 'report'],
    });

    return entities.map((entity) => ClientFavoriteReportMapper.toDomain(entity));
  }

  async findByClientIdAndReportIds(clientId: number, reportIds: number[]): Promise<ClientFavoriteReport[]> {
    if (!reportIds || reportIds.length === 0) {
      return [];
    }
    
    const entities = await this.clientFavoriteReportRepository
      .createQueryBuilder('clientFavoriteReport')
      .leftJoinAndSelect('clientFavoriteReport.client', 'client')
      .leftJoinAndSelect('clientFavoriteReport.report', 'report')
      .where('client.id = :clientId', { clientId })
      .andWhere('report.id IN (:...reportIds)', { reportIds })
      .getMany();

    return entities.map((entity) => ClientFavoriteReportMapper.toDomain(entity));
  }

  async update(
    id: ClientFavoriteReport['id'],
    payload: Partial<ClientFavoriteReport>,
  ): Promise<ClientFavoriteReport> {
    const entity = await this.clientFavoriteReportRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.clientFavoriteReportRepository.save(
      this.clientFavoriteReportRepository.create(
        ClientFavoriteReportMapper.toPersistence({
          ...ClientFavoriteReportMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ClientFavoriteReportMapper.toDomain(updatedEntity);
  }

  async remove(id: ClientFavoriteReport['id']): Promise<void> {
    await this.clientFavoriteReportRepository.delete(id);
  }
}
