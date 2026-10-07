import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { BranchEntity } from '../entities/branch.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Branch } from '../../../../domain/branch';
import { BranchRepository } from '../../branch.repository';
import { BranchMapper } from '../mappers/branch.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class BranchRelationalRepository implements BranchRepository {
  constructor(
    @InjectRepository(BranchEntity)
    private readonly branchRepository: Repository<BranchEntity>,
  ) {}

  async create(data: Branch): Promise<Branch> {
    const persistenceModel = BranchMapper.toPersistence(data);
    const entityToSave = this.branchRepository.create(persistenceModel);

    try {
      const newEntity = await this.branchRepository.save(entityToSave);
      return BranchMapper.toDomain(newEntity);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any)?.driverError?.code === '23505' &&
        (error as any)?.driverError?.constraint === 'PK_ad6f8b85c21d59b89d1ef869785'
      ) {
        await this.branchRepository.query(
          `SELECT setval('branche_id_seq', COALESCE((SELECT MAX(id) FROM branche), 0))`,
        );

        (entityToSave as any).id = undefined;
        const retriedEntity = await this.branchRepository.save(entityToSave);
        return BranchMapper.toDomain(retriedEntity);
      }

      throw error;
    }
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Branch[]; totalCount: number }> {
    const shouldPaginate = !!paginationOptions.limit && paginationOptions.limit > 0;

    const [entities, totalCount] = await this.branchRepository.findAndCount({
      skip: shouldPaginate
        ? (paginationOptions.page - 1) * paginationOptions.limit
        : undefined,
      take: shouldPaginate ? paginationOptions.limit : undefined,
      relations: ['client', 'city'],
    });

    return {
      data: entities.map((entity) => BranchMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Branch['id']): Promise<NullableType<Branch>> {
    const entity = await this.branchRepository.findOne({
      where: { id },
      relations: ['client', 'city'],
    });

    return entity ? BranchMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Branch['id'][]): Promise<Branch[]> {
    const entities = await this.branchRepository.find({
      where: { id: { $in: ids } as any },
      relations: ['client', 'city'],
    });
    return entities.map((entity) => BranchMapper.toDomain(entity));
  }

  async findByClientCompanyId(clientCompanyId: number): Promise<Branch[]> {
    const entities = await this.branchRepository.find({
      where: { client: { id: clientCompanyId } as any },
      relations: ['client', 'city'],
    });
    return entities.map((entity) => BranchMapper.toDomain(entity));
  }

  async update(
    id: Branch['id'],
    payload: Partial<Branch>,
  ): Promise<Branch | null> {
    const entity = await this.branchRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.branchRepository.save(
      this.branchRepository.create(
        BranchMapper.toPersistence({
          ...BranchMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return BranchMapper.toDomain(updatedEntity);
  }

  async remove(id: Branch['id']): Promise<void> {
    await this.branchRepository.delete(id);
  }

  async findByNameAndClient(name: string, clientId: number): Promise<Branch | null> {
    const entity = await this.branchRepository.findOne({
      where: {
        name,
        client: { id: clientId },
      },
      relations: ['client', 'city'],
    });
    return entity ? BranchMapper.toDomain(entity) : null;
  }

  async findByBranchNumberAndClient(branchNumber: string, clientId: number): Promise<Branch | null> {
    const entity = await this.branchRepository.findOne({
      where: {
        branchNumber,
        client: { id: clientId },
      },
      relations: ['client', 'city'],
    });
    return entity ? BranchMapper.toDomain(entity) : null;
  }

  async findByNameAndBranchNumberAndClient(
    name: string,
    branchNumber: string,
    clientId: number,
  ): Promise<Branch | null> {
    const entity = await this.branchRepository.findOne({
      where: {
        name,
        branchNumber,
        client: { id: clientId },
      },
      relations: ['client', 'city'],
    });
    return entity ? BranchMapper.toDomain(entity) : null;
  }

  async findByNameStreetZipCodeCityAndProject(
    name: string,
    street: string | null,
    zipCode: string | null,
    cityId: number,
    projectId: number,
  ): Promise<Branch | null> {
    const entity = await this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.city', 'city')
      .leftJoinAndSelect('branch.client', 'client')
      .leftJoin('project_branch', 'pb', 'pb.branche_id = branch.id')
      .where('branch.name = :name', { name })
      .andWhere('branch.street = :street', { street })
      .andWhere('branch.zipCode = :zipCode', { zipCode })
      .andWhere('branch.city.id = :cityId', { cityId })
      .andWhere('pb.project_id = :projectId', { projectId })
      .getOne();

    return entity ? BranchMapper.toDomain(entity) : null;
  }

  async findByNameStreetZipCodeCityAndClient(
    name: string,
    street: string | null,
    zipCode: string | null,
    cityId: number,
    clientId: number,
  ): Promise<Branch | null> {
    const entity = await this.branchRepository.findOne({
      where: {
        name,
        street: street === null ? IsNull() : street,
        zipCode: zipCode === null ? IsNull() : zipCode,
        city: { id: cityId },
        client: { id: clientId },
      },
      relations: ['client', 'city'],
    });

    return entity ? BranchMapper.toDomain(entity) : null;
  }
}
