import { forwardRef, Module } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { CountriesController } from './countries.controller';
import { RelationalCountriesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { CitiesModule } from '../cities/cities.module';

@Module({
  imports: [
    forwardRef(() => CitiesModule),
    // import modules, etc.
    RelationalCountriesPersistenceModule,
  ],
  controllers: [CountriesController],
  providers: [CountriesService],
  exports: [CountriesService, RelationalCountriesPersistenceModule],
})
export class CountriesModule {}
