import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { ClientCompanyAssignedClientEntity } from '../entities/client-company-assigned-client.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ClientCompanyAssignedClient } from '../../../../domain/client-company-assigned-client';
import { ClientCompanyAssignedClientRepository } from '../../client-company-assigned-client.repository';
import { ClientCompanyAssignedClientMapper } from '../mappers/client-company-assigned-client.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ClientCompanyAssignedClientRelationalRepository implements ClientCompanyAssignedClientRepository {
  constructor(
    @InjectRepository(ClientCompanyAssignedClientEntity)
    private readonly clientCompanyAssignedClientRepository: Repository<ClientCompanyAssignedClientEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: ClientCompanyAssignedClient): Promise<ClientCompanyAssignedClient> {
    // Reset sequence before creating to avoid ID conflicts
    await this.resetSequenceIfNeeded();
    
    const persistenceModel = ClientCompanyAssignedClientMapper.toPersistence(data);
    const newEntity = await this.clientCompanyAssignedClientRepository.save(
      this.clientCompanyAssignedClientRepository.create(persistenceModel),
    );
    return ClientCompanyAssignedClientMapper.toDomain(newEntity);
  }

  /**
   * Reset the sequence if it's out of sync to avoid ID conflicts
   */
  private async resetSequenceIfNeeded(): Promise<void> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      
      // Get the maximum ID from the table
      const maxIdResult = await queryRunner.query(
        'SELECT COALESCE(MAX(id), 0) as max_id FROM client_company_assigned_client'
      );
      
      const maxId = maxIdResult[0]?.max_id || 0;
      
      // Reset the sequence to the maximum ID + 1
      await queryRunner.query(
        `SELECT setval('client_company_assigned_client_id_seq', ${maxId + 1}, false)`
      );
      
      await queryRunner.release();
    } catch (error) {
      // Don't throw error, just log it
      console.warn('Could not reset sequence for client_company_assigned_client:', error.message);
    }
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompanyAssignedClient[]; totalCount: number }> {
    const entities = await this.clientCompanyAssignedClientRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['client', 'client.user', 'clientCompany'],
    });

    const totalCount = await this.clientCompanyAssignedClientRepository.count();

    return {
      data: entities.map((entity) => ClientCompanyAssignedClientMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: ClientCompanyAssignedClient['id']): Promise<NullableType<ClientCompanyAssignedClient>> {
    const entity = await this.clientCompanyAssignedClientRepository.findOne({
      where: { id },
    });

    return entity ? ClientCompanyAssignedClientMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ClientCompanyAssignedClient['id'][]): Promise<ClientCompanyAssignedClient[]> {
    const entities = await this.clientCompanyAssignedClientRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ClientCompanyAssignedClientMapper.toDomain(entity));
  }

  async update(id: ClientCompanyAssignedClient['id'], payload: Partial<ClientCompanyAssignedClient>): Promise<ClientCompanyAssignedClient | null> {
    const entity = await this.clientCompanyAssignedClientRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.clientCompanyAssignedClientRepository.save(
      this.clientCompanyAssignedClientRepository.create(
        ClientCompanyAssignedClientMapper.toPersistence({
          ...ClientCompanyAssignedClientMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ClientCompanyAssignedClientMapper.toDomain(updatedEntity);
  }

  async remove(id: ClientCompanyAssignedClient['id']): Promise<void> {
    await this.clientCompanyAssignedClientRepository.delete(id);
  }

  async findByClientId(clientId: number): Promise<ClientCompanyAssignedClient[]> {
    const entities = await this.clientCompanyAssignedClientRepository.find({
      where: { client: { id: clientId } },
      relations: ['client', 'clientCompany'],
    });

    return entities.map((entity) => ClientCompanyAssignedClientMapper.toDomain(entity));
  }

  async findByClientCompanyId(clientCompanyId: number): Promise<ClientCompanyAssignedClient[]> {
    const entities = await this.clientCompanyAssignedClientRepository.find({
      where: { clientCompany: { id: clientCompanyId } },
      relations: ['client', 'clientCompany'],
    });

    return entities.map((entity) => ClientCompanyAssignedClientMapper.toDomain(entity));
  }
}