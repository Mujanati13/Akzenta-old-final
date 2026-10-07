import { CountriesService } from '../countries/countries.service';
import { Countries } from '../countries/domain/countries';

import {
  forwardRef,
  HttpStatus,
  Inject,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Injectable, Logger } from '@nestjs/common';
import { CreateCitiesDto } from './dto/create-cities.dto';
import { UpdateCitiesDto } from './dto/update-cities.dto';
import { CitiesRepository } from './infrastructure/persistence/cities.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Cities } from './domain/cities';

@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name);

  constructor(
    @Inject(forwardRef(() => CountriesService))
    private readonly countriesService: CountriesService,
    private readonly citiesRepository: CitiesRepository,
  ) {}

  async create(createCitiesDto: CreateCitiesDto) {
    const countryObject = await this.countriesService.findById(
      createCitiesDto.country.id,
    );
    if (!countryObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          country: 'notExists',
        },
      });
    }
    const country = countryObject;

    return this.citiesRepository.create({
      ...createCitiesDto,
      country,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.citiesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Cities['id']) {
    return this.citiesRepository.findById(id);
  }

  findByIds(ids: Cities['id'][]) {
    return this.citiesRepository.findByIds(ids);
  }

  async findByCountryId(countryId: number): Promise<Cities[]> {
    return this.citiesRepository.findByCountryId(countryId);
  }

  async findByName(name: string) {
    return this.citiesRepository.findByName(name);
  }

  async findOrCreateByName(
    name: string,
    countryName?: string | null,
  ): Promise<Cities | null> {
    const normalizedName = name?.trim();
    if (!normalizedName) {
      return null;
    }

    const existing =
      (await this.citiesRepository.findByName(normalizedName)) ??
      (await this.citiesRepository.findByNameIgnoreCase(normalizedName));

    if (existing) {
      return existing;
    }

    const country = await this.countriesService.findOrCreateByLocalizedName(
      countryName?.trim() || 'Deutschland',
    );

    return this.create({
      name: normalizedName,
      coordinates: await this.geocodeCity(normalizedName),
      country: { id: country.id },
    });
  }

  async update(
    id: Cities['id'],
    updateCitiesDto: UpdateCitiesDto,
  ) {
    let country: Countries | undefined = undefined;

    if (updateCitiesDto.country) {
      const countryObject = await this.countriesService.findById(
        updateCitiesDto.country.id,
      );
      if (!countryObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            country: 'notExists',
          },
        });
      }
      country = countryObject;
    }

    return this.citiesRepository.update(id, {
      name: updateCitiesDto.name,
      country,
    });
  }

  remove(id: Cities['id']) {
    return this.citiesRepository.remove(id);
  }

  private async geocodeCity(cityName: string): Promise<[number, number]> {
    const mapboxToken = process.env.MAPBOX_TOKEN;
    if (!mapboxToken) {
      return [0, 0];
    }
    try {
      const encoded = encodeURIComponent(cityName);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxToken}&limit=1&country=DE&language=de`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].center;
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
          return [lat, lng];
        }
      }
      this.logger.warn(`Geocoding returned no results for "${cityName}", using [0, 0]`);
    } catch (error) {
      this.logger.error(`Geocoding failed for "${cityName}":`, error);
    }
    return [0, 0];
  }
}