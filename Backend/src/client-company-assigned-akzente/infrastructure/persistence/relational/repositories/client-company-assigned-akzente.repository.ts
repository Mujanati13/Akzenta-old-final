import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientCompanyAssignedAkzenteEntity } from '../entities/client-company-assigned-akzente.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ClientCompanyAssignedAkzente } from '../../../../domain/client-company-assigned-akzente';
import { ClientCompanyAssignedAkzenteRepository } from '../../client-company-assigned-akzente.repository';
import { ClientCompanyAssignedAkzenteMapper } from '../mappers/client-company-assigned-akzente.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ClientCompanyAssignedAkzenteRelationalRepository implements ClientCompanyAssignedAkzenteRepository {
  constructor(
    @InjectRepository(ClientCompanyAssignedAkzenteEntity)
    private readonly clientCompanyAssignedAkzenteRepository: Repository<ClientCompanyAssignedAkzenteEntity>,
  ) {}

  async create(data: ClientCompanyAssignedAkzente): Promise<ClientCompanyAssignedAkzente> {
    const persistenceModel = ClientCompanyAssignedAkzenteMapper.toPersistence(data);
    const newEntity = await this.clientCompanyAssignedAkzenteRepository.save(
      this.clientCompanyAssignedAkzenteRepository.create(persistenceModel),
    );
    return ClientCompanyAssignedAkzenteMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompanyAssignedAkzente[]; totalCount: number }> {
    const entities = await this.clientCompanyAssignedAkzenteRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['akzente', 'clientCompany'],
    });

    const totalCount = await this.clientCompanyAssignedAkzenteRepository.count();

    return {
      data: entities.map((entity) => ClientCompanyAssignedAkzenteMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: ClientCompanyAssignedAkzente['id']): Promise<NullableType<ClientCompanyAssignedAkzente>> {
    const entity = await this.clientCompanyAssignedAkzenteRepository.findOne({
      where: { id },
    });

    return entity ? ClientCompanyAssignedAkzenteMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ClientCompanyAssignedAkzente['id'][]): Promise<ClientCompanyAssignedAkzente[]> {
    const entities = await this.clientCompanyAssignedAkzenteRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ClientCompanyAssignedAkzenteMapper.toDomain(entity));
  }

  async update(id: ClientCompanyAssignedAkzente['id'], payload: Partial<ClientCompanyAssignedAkzente>): Promise<ClientCompanyAssignedAkzente | null> {
    const entity = await this.clientCompanyAssignedAkzenteRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.clientCompanyAssignedAkzenteRepository.save(
      this.clientCompanyAssignedAkzenteRepository.create(
        ClientCompanyAssignedAkzenteMapper.toPersistence({
          ...ClientCompanyAssignedAkzenteMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ClientCompanyAssignedAkzenteMapper.toDomain(updatedEntity);
  }

  async remove(id: ClientCompanyAssignedAkzente['id']): Promise<void> {
    await this.clientCompanyAssignedAkzenteRepository.delete(id);
  }

  async findByAkzenteId(akzenteId: number): Promise<ClientCompanyAssignedAkzente[]> {
    const entities = await this.clientCompanyAssignedAkzenteRepository.find({
      where: { akzente: { id: akzenteId } },
      relations: ['akzente', 'clientCompany'],
    });

    return entities.map((entity) => ClientCompanyAssignedAkzenteMapper.toDomain(entity));
  }

  async findByAkzenteIdWithPagination(
    akzenteId: number,
    paginationOptions: IPaginationOptions,
  ): Promise<{ data: ClientCompanyAssignedAkzente[]; totalCount: number }> {
    const [entities, totalCount] = await this.clientCompanyAssignedAkzenteRepository.findAndCount({
      where: { akzente: { id: akzenteId } },
      relations: ['akzente', 'clientCompany'],
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: entities.map((entity) => ClientCompanyAssignedAkzenteMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findByClientCompanyId(clientCompanyId: number): Promise<ClientCompanyAssignedAkzente[]> {
    const entities = await this.clientCompanyAssignedAkzenteRepository.find({
      where: { clientCompany: { id: clientCompanyId } },
      relations: ['akzente', 'clientCompany'],
    });

    return entities.map((entity) => ClientCompanyAssignedAkzenteMapper.toDomain(entity));
  }
}