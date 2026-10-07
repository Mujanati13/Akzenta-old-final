import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AkzenteFavoriteClientCompanyEntity } from '../entities/akzente-favorite-client-company.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AkzenteFavoriteClientCompany } from '../../../../domain/akzente-favorite-client-company';
import { AkzenteFavoriteClientCompanyRepository } from '../../akzente-favorite-client-company.repository';
import { AkzenteFavoriteClientCompanyMapper } from '../mappers/akzente-favorite-client-company.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AkzenteFavoriteClientCompanyRelationalRepository
  implements AkzenteFavoriteClientCompanyRepository
{
  constructor(
    @InjectRepository(AkzenteFavoriteClientCompanyEntity)
    private readonly favoriteClientCompanyRepository: Repository<AkzenteFavoriteClientCompanyEntity>,
  ) {}

  async create(data: AkzenteFavoriteClientCompany): Promise<AkzenteFavoriteClientCompany> {
    const persistenceModel = AkzenteFavoriteClientCompanyMapper.toPersistence(data);
    const newEntity = await this.favoriteClientCompanyRepository.save(
      this.favoriteClientCompanyRepository.create(persistenceModel),
    );
    return AkzenteFavoriteClientCompanyMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AkzenteFavoriteClientCompany[]; totalCount: number }> {
    const entities = await this.favoriteClientCompanyRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['akzente', 'clientCompany'],
    });

    const totalCount = await this.favoriteClientCompanyRepository.count();

    return {
      data: entities.map((entity) =>
        AkzenteFavoriteClientCompanyMapper.toDomain(entity),
      ),
      totalCount,
    };
  }

  async findById(
    id: AkzenteFavoriteClientCompany['id'],
  ): Promise<NullableType<AkzenteFavoriteClientCompany>> {
    const entity = await this.favoriteClientCompanyRepository.findOne({
      where: { id },
    });

    return entity ? AkzenteFavoriteClientCompanyMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: AkzenteFavoriteClientCompany['id'][],
  ): Promise<AkzenteFavoriteClientCompany[]> {
    const entities = await this.favoriteClientCompanyRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) =>
      AkzenteFavoriteClientCompanyMapper.toDomain(entity),
    );
  }

  async update(
    id: AkzenteFavoriteClientCompany['id'],
    payload: Partial<AkzenteFavoriteClientCompany>,
  ): Promise<AkzenteFavoriteClientCompany> {
    const entity = await this.favoriteClientCompanyRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.favoriteClientCompanyRepository.save(
      this.favoriteClientCompanyRepository.create(
        AkzenteFavoriteClientCompanyMapper.toPersistence({
          ...AkzenteFavoriteClientCompanyMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AkzenteFavoriteClientCompanyMapper.toDomain(updatedEntity);
  }

  async remove(id: AkzenteFavoriteClientCompany['id']): Promise<void> {
    await this.favoriteClientCompanyRepository.delete(id);
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteClientCompany[]> {
    const entities = await this.favoriteClientCompanyRepository.find({
      where: { akzente: { id: akzenteId } },
      relations: ['akzente', 'clientCompany'],
    });

    return entities.map((entity) => AkzenteFavoriteClientCompanyMapper.toDomain(entity));
  }
}
