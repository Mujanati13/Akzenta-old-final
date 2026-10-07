
import {
  forwardRef,
  HttpStatus,
  Inject,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Injectable } from '@nestjs/common';
import { CreateCountriesDto } from './dto/create-countries.dto';
import { UpdateCountriesDto } from './dto/update-countries.dto';
import { CountriesRepository } from './infrastructure/persistence/countries.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Countries } from './domain/countries';
import { CitiesService } from '../cities/cities.service';
import { Cities } from '../cities/domain/cities';

@Injectable()
export class CountriesService {
  constructor(
    @Inject(forwardRef(() => CitiesService))
    private readonly citiesService: CitiesService,
    // Dependencies here
    private readonly countriesRepository: CountriesRepository,
  ) {}

  async create(createCountriesDto: CreateCountriesDto) {
    // Do not remove comment below.
    // <creating-property />

    let cities: Cities[] | null | undefined = undefined;

    if (createCountriesDto.cities) {
      const citiesObjects = await this.citiesService.findByIds(
        createCountriesDto.cities.map((entity) => entity.id),
      );
      if (citiesObjects.length !== createCountriesDto.cities.length) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            cities: 'notExists',
          },
        });
      }
      cities = citiesObjects;
    } else if (createCountriesDto.cities === null) {
      cities = null;
    }

    return this.countriesRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      flag: createCountriesDto.flag,

      ...createCountriesDto,
      cities,
    });
  }

  findAllWithPagination({
    paginationOptions,
    i18n,
  }: {
    paginationOptions: IPaginationOptions;
    i18n: string;
  }) {
    return this.countriesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      i18n,
    });
  }

  findById(id: Countries['id']) {
    return this.countriesRepository.findById(id);
  }

  findByIds(ids: Countries['id'][]) {
    return this.countriesRepository.findByIds(ids);
  }

  async findOrCreateByLocalizedName(name: string): Promise<Countries> {
    const normalizedName = name?.trim();
    if (!normalizedName) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          country: 'nameRequired',
        },
      });
    }

    const existing = await this.countriesRepository.findByLocalizedName(
      normalizedName,
    );
    if (existing) {
      return existing;
    }

    return this.create({
      name: {
        de: normalizedName,
        en: normalizedName,
        fr: normalizedName,
        ar: normalizedName,
        sp: normalizedName,
      },
    });
  }

  async update(
    id: Countries['id'],

    updateCountriesDto: UpdateCountriesDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    let cities: Cities[] | null | undefined = undefined;

    if (updateCountriesDto.cities) {
      const citiesObjects = await this.citiesService.findByIds(
        updateCountriesDto.cities.map((entity) => entity.id),
      );
      if (citiesObjects.length !== updateCountriesDto.cities.length) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            cities: 'notExists',
          },
        });
      }
      cities = citiesObjects;
    } else if (updateCountriesDto.cities === null) {
      cities = null;
    }

    return this.countriesRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      flag: updateCountriesDto.flag,

      name: updateCountriesDto.name,

      cities,
    });
  }

  remove(id: Countries['id']) {
    return this.countriesRepository.remove(id);
  }
}
