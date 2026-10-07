import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitiesEntity } from '../../../../cities/infrastructure/persistence/relational/entities/cities.entity';
import { CountriesEntity } from '../../../../countries/infrastructure/persistence/relational/entities/countries.entity';
import { GermanCitiesSeedService } from './german-cities-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([CountriesEntity, CitiesEntity])],
  providers: [GermanCitiesSeedService],
  exports: [GermanCitiesSeedService],
})
export class GermanCitiesSeedModule {}
