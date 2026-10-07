import { Module } from '@nestjs/common';
import { CountriesRepository } from '../countries.repository';
import { CountriesRelationalRepository } from './repositories/countries.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountriesEntity } from './entities/countries.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CountriesEntity])],
  providers: [
    {
      provide: CountriesRepository,
      useClass: CountriesRelationalRepository,
    },
  ],
  exports: [CountriesRepository],
})
export class RelationalCountriesPersistenceModule {}
