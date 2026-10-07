import { CountriesModule } from '../countries/countries.module';
import { forwardRef, Module } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';
import { RelationalCitiesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    forwardRef(() => CountriesModule),
    SessionModule,
    RelationalCitiesPersistenceModule,
  ],
  controllers: [CitiesController],
  providers: [CitiesService],
  exports: [CitiesService, RelationalCitiesPersistenceModule],
})
export class CitiesModule {}