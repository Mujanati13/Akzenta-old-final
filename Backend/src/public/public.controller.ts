import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { JobTypesService } from '../job-types/job-types.service';
import { CountriesRepository } from '../countries/infrastructure/persistence/countries.repository';
import { CitiesService } from '../cities/cities.service';
import { I18n, I18nContext } from 'nestjs-i18n';
import https from 'node:https';

@Controller({
  path: 'public',
  version: '1',
})
export class PublicController {
  constructor(
    private readonly jobTypesService: JobTypesService,
    private readonly countriesRepository: CountriesRepository,
    private readonly citiesService: CitiesService,
  ) {}

  @Get('register-data')
  async getRegisterData(@I18n() i18n: I18nContext) {
    try {
      const countries = await this.countriesRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 },
        i18n: i18n.lang,
      });

      const jobTypes = await this.jobTypesService.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 },
      });

      return {
        countries: countries.data || [],
        jobTypes: jobTypes.data || [],
      };
    } catch (error) {
      throw new HttpException(
        { status: HttpStatus.UNPROCESSABLE_ENTITY, errors: { message: 'Failed to fetch registration data' } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  @Get('countries')
  async getCountries(@I18n() i18n: I18nContext) {
    const countries = await this.countriesRepository.findAllWithPagination({
      paginationOptions: { page: 1, limit: 0 },
      i18n: i18n.lang,
    });
    return countries.data || [];
  }

  @Get('countries/:countryId/cities')
  async getCitiesByCountry(@Param('countryId') countryId: number) {
    return this.citiesService.findByCountryId(countryId);
  }

  @Get('zip-lookup/:countryCode/:zip')
  async zipLookup(@Param('countryCode') countryCode: string, @Param('zip') zip: string) {
    return new Promise((resolve, reject) => {
      https
        .get(`https://api.zippopotam.us/${countryCode}/${zip}`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 404) {
              resolve({ country: null, city: null });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              resolve({
                country: parsed.country || null,
                city: parsed.places?.[0]?.['place name'] || null,
              });
            } catch {
              resolve({ country: null, city: null });
            }
          });
        })
        .on('error', () => resolve({ country: null, city: null }));
    });
  }
}
