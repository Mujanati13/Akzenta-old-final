import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MerchandiserFavoriteClientCompanyRepository } from '../../merchandiser-favorite-client-company.repository';
import { MerchandiserFavoriteClientCompanyEntity } from '../entities/merchandiser-favorite-client-company.entity';
import { MerchandiserFavoriteClientCompanyMapper } from '../mappers/merchandiser-favorite-client-company.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { DeepPartial } from '../../../../../utils/types/deep-partial.type';
import { MerchandiserFavoriteClientCompany } from '../../../../domain/merchandiser-favorite-client-company';

@Injectable()
export class MerchandiserFavoriteClientCompanyRelationalRepository implements MerchandiserFavoriteClientCompanyRepository {
  constructor(
    @InjectRepository(MerchandiserFavoriteClientCompanyEntity)
    private readonly merchandiserFavoriteClientCompanyRepository: Repository<MerchandiserFavoriteClientCompanyEntity>,
  ) {}

  async create(data: MerchandiserFavoriteClientCompany): Promise<MerchandiserFavoriteClientCompany> {
    const persistenceModel = MerchandiserFavoriteClientCompanyMapper.toPersistence(data);
    const newEntity = await this.merchandiserFavoriteClientCompanyRepository.save(
      this.merchandiserFavoriteClientCompanyRepository.create(persistenceModel),
    );

    return MerchandiserFavoriteClientCompanyMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserFavoriteClientCompany[]; totalCount: number }> {
    const totalCount = await this.merchandiserFavoriteClientCompanyRepository.count();
    
    const entities = await this.merchandiserFavoriteClientCompanyRepository.find({
      relations: ['merchandiser', 'merchandiser.user', 'clientCompany'],
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return {
      data: entities.map((entity) => MerchandiserFavoriteClientCompanyMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserFavoriteClientCompany['id']): Promise<NullableType<MerchandiserFavoriteClientCompany>> {
    const entity = await this.merchandiserFavoriteClientCompanyRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'merchandiser.user', 'clientCompany'],
    });

    return entity ? MerchandiserFavoriteClientCompanyMapper.toDomain(entity) : null;
  }

  async findByIds(ids: MerchandiserFavoriteClientCompany['id'][]): Promise<MerchandiserFavoriteClientCompany[]> {
    const entities = await this.merchandiserFavoriteClientCompanyRepository.find({
      where: { id: In(ids) },
      relations: ['merchandiser', 'merchandiser.user', 'clientCompany'],
    });

    return entities.map((entity) => MerchandiserFavoriteClientCompanyMapper.toDomain(entity));
  }

  async findOne(options: { merchandiserId: number; clientCompanyId: number }): Promise<NullableType<MerchandiserFavoriteClientCompany>> {
    const entity = await this.merchandiserFavoriteClientCompanyRepository.findOne({
      where: {
        merchandiser: { id: options.merchandiserId },
        clientCompany: { id: options.clientCompanyId },
      },
      relations: ['merchandiser', 'merchandiser.user', 'clientCompany'],
    });

    return entity ? MerchandiserFavoriteClientCompanyMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteClientCompany[]> {
    const entities = await this.merchandiserFavoriteClientCompanyRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['merchandiser', 'merchandiser.user', 'clientCompany'],
    });

    return entities.map((entity) => MerchandiserFavoriteClientCompanyMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserFavoriteClientCompany['id'],
    payload: Partial<MerchandiserFavoriteClientCompany>,
  ): Promise<MerchandiserFavoriteClientCompany | null> {
    const entity = await this.merchandiserFavoriteClientCompanyRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserFavoriteClientCompanyRepository.save(
      this.merchandiserFavoriteClientCompanyRepository.create(
        MerchandiserFavoriteClientCompanyMapper.toPersistence({
          ...MerchandiserFavoriteClientCompanyMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserFavoriteClientCompanyMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserFavoriteClientCompany['id']): Promise<void> {
    await this.merchandiserFavoriteClientCompanyRepository.delete(id);
  }
}
