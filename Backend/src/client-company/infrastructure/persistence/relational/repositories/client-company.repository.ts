import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientCompanyEntity } from '../entities/client-company.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ClientCompany } from '../../../../domain/client-company';
import { ClientCompanyRepository } from '../../client-company.repository';
import { ClientCompanyMapper } from '../mappers/client-company.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ClientCompanyRelationalRepository implements ClientCompanyRepository {
  constructor(
    @InjectRepository(ClientCompanyEntity)
    private readonly clientCompanyRepository: Repository<ClientCompanyEntity>,
  ) {}

  async create(data: ClientCompany): Promise<ClientCompany> {
    const persistenceModel = ClientCompanyMapper.toPersistence(data);
    const newEntity = await this.clientCompanyRepository.save(
      this.clientCompanyRepository.create(persistenceModel),
    );
    return ClientCompanyMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompany[]; totalCount: number }> {
    // Get total count for pagination
    const totalCount = await this.clientCompanyRepository.count();
    
    // Get paginated entities with default ordering
    const entities = await this.clientCompanyRepository.find({
      relations: {
        logo: true,
      },
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        id: 'ASC', // Default order by id ascending
      },
    });

    return {
      data: entities.map((entity) => ClientCompanyMapper.toDomain(entity)),
      totalCount, // Add the missing totalCount property
    };
  }

  async findById(id: ClientCompany['id']): Promise<NullableType<ClientCompany>> {
    const entity = await this.clientCompanyRepository.findOne({
      where: { id },
      relations: {
        logo: true,
      },
    });

    return entity ? ClientCompanyMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ClientCompany['id'][]): Promise<ClientCompany[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    // Fix: Use the proper TypeORM In operator
    const entities = await this.clientCompanyRepository.find({
      where: { 
        id: In(ids) // This is the correct way to use IN clause with TypeORM
      },
      relations: {
        logo: true,
      },
      order: {
        id: 'ASC', // Same ordering as findAllWithPagination
      },
    });

    return entities.map((entity) => ClientCompanyMapper.toDomain(entity));
  }

  async findByNormalizedName(
    name: string,
  ): Promise<NullableType<ClientCompany>> {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      return null;
    }

    const entity = await this.clientCompanyRepository
      .createQueryBuilder('clientCompany')
      .leftJoinAndSelect('clientCompany.logo', 'logo')
      .where('LOWER(TRIM(clientCompany.name)) = :normalizedName', {
        normalizedName,
      })
      .getOne();

    return entity ? ClientCompanyMapper.toDomain(entity) : null;
  }

  async update(id: ClientCompany['id'], payload: Partial<ClientCompany>): Promise<ClientCompany> {
    const entity = await this.clientCompanyRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('ClientCompany not found');
    }

    // Fix: Create a proper payload for toPersistence that excludes undefined id
    const updatePayload: ClientCompany = {
      ...entity,
      ...ClientCompanyMapper.toDomain(entity),
      ...payload,
      id: entity.id, // Ensure id is always defined
    } as ClientCompany;

    const updatedEntity = await this.clientCompanyRepository.save(
      this.clientCompanyRepository.merge(entity, ClientCompanyMapper.toPersistence(updatePayload)),
    );

    return ClientCompanyMapper.toDomain(updatedEntity);
  }

  async remove(id: ClientCompany['id']): Promise<void> {
    await this.clientCompanyRepository.delete(id);
  }
}
