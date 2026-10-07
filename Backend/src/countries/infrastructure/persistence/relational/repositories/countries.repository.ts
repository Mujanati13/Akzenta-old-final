import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CountriesEntity } from '../entities/countries.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Countries } from '../../../../domain/countries';
import { CountriesRepository } from '../../countries.repository';
import { CountriesMapper } from '../mappers/countries.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class CountriesRelationalRepository implements CountriesRepository {
  constructor(
    @InjectRepository(CountriesEntity)
    private readonly countriesRepository: Repository<CountriesEntity>,
  ) {}

  async create(data: Countries): Promise<Countries> {
    const persistenceModel = CountriesMapper.toPersistence(data);
    const newEntity = await this.countriesRepository.save(
      this.countriesRepository.create(persistenceModel),
    );
    return CountriesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    i18n,
  }: {
    paginationOptions: IPaginationOptions;
    i18n: string;
  }): Promise<{ data: any[]; totalCount: number }> {
    const shouldPaginate =
      !!paginationOptions.limit && paginationOptions.limit > 0;

    // Fetch country data and total count with pagination
    const [entities, totalCount] = await this.countriesRepository.findAndCount({
      skip: shouldPaginate
        ? (paginationOptions.page - 1) * paginationOptions.limit
        : undefined,
      take: shouldPaginate ? paginationOptions.limit : undefined,
    });

    // Map the country entities to include the correct name based on the requested language
    const data = entities.map((entity) => {
      // Get the name in the requested language, defaulting to French ('fr') if not available
      const countryName = entity.name[i18n] || entity.name['fr'];

      return {
        id: entity.id,
        name: countryName,
        flag: entity.flag,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };
    });

    return {
      data,
      totalCount,
    };
  }

  async findById(id: Countries['id']): Promise<NullableType<Countries>> {
    const entity = await this.countriesRepository.findOne({
      where: { id },
    });

    return entity ? CountriesMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Countries['id'][]): Promise<Countries[]> {
    const entities = await this.countriesRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => CountriesMapper.toDomain(entity));
  }

  async findByLocalizedName(name: string): Promise<NullableType<Countries>> {
    const normalized = name.trim();
    if (!normalized) {
      return null;
    }

    const entity = await this.countriesRepository
      .createQueryBuilder('country')
      .where(
        `LOWER(country.name->>'de') = LOWER(:name)
         OR LOWER(country.name->>'en') = LOWER(:name)
         OR LOWER(country.name->>'fr') = LOWER(:name)
         OR LOWER(country.name->>'ar') = LOWER(:name)
         OR LOWER(country.name->>'sp') = LOWER(:name)`,
        { name: normalized },
      )
      .getOne();

    return entity ? CountriesMapper.toDomain(entity) : null;
  }

  async update(
    id: Countries['id'],
    payload: Partial<Countries>,
  ): Promise<Countries> {
    const entity = await this.countriesRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.countriesRepository.save(
      this.countriesRepository.create(
        CountriesMapper.toPersistence({
          ...CountriesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return CountriesMapper.toDomain(updatedEntity);
  }

  async remove(id: Countries['id']): Promise<void> {
    await this.countriesRepository.delete(id);
  }
}
