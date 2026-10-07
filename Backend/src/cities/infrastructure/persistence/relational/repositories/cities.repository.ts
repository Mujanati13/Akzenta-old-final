import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { CitiesEntity } from '../entities/cities.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Cities } from '../../../../domain/cities';
import { CitiesRepository } from '../../cities.repository';
import { CitiesMapper } from '../mappers/cities.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class CitiesRelationalRepository implements CitiesRepository {
  constructor(
    @InjectRepository(CitiesEntity)
    private readonly citiesRepository: Repository<CitiesEntity>,
  ) {}

  async create(data: Cities): Promise<Cities> {
    const persistenceModel = CitiesMapper.toPersistence(data);
    const newEntity = await this.citiesRepository.save(
      this.citiesRepository.create(persistenceModel),
    );
    return CitiesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Cities[]; totalCount: number }> {
    const [entities, totalCount] = await this.citiesRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        name: 'ASC', // Default order by name ascending
      },
    });

    return {
      data: entities.map((entity) => CitiesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Cities['id']): Promise<NullableType<Cities>> {
    const entity = await this.citiesRepository.findOne({
      where: { id },
      relations: ['country'], // Include country relation
    });

    return entity ? CitiesMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Cities['id'][]): Promise<Cities[]> {
    const entities = await this.citiesRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => CitiesMapper.toDomain(entity));
  }

  async findByCountryId(countryId: number): Promise<Cities[]> {
    const entities = await this.citiesRepository.find({
      where: { 
        country: { id: countryId }
      },
      order: {
        name: 'ASC',
      },
    });

    return entities.map((entity) => CitiesMapper.toDomain(entity));
  }

  async findByName(name: string): Promise<Cities | null> {
    const entity = await this.citiesRepository.findOne({ where: { name } });
    return entity ? CitiesMapper.toDomain(entity) : null;
  }

  async findByNameIgnoreCase(name: string): Promise<Cities | null> {
    const entity = await this.citiesRepository.findOne({
      where: { name: ILike(name.trim()) },
      relations: ['country'],
    });
    return entity ? CitiesMapper.toDomain(entity) : null;
  }

  async update(id: Cities['id'], payload: Partial<Cities>): Promise<Cities> {
    const entity = await this.citiesRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.citiesRepository.save(
      this.citiesRepository.create(
        CitiesMapper.toPersistence({
          ...CitiesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return CitiesMapper.toDomain(updatedEntity);
  }

  async remove(id: Cities['id']): Promise<void> {
    await this.citiesRepository.delete(id);
  }
}