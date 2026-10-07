import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { JobTypesModule } from '../job-types/job-types.module';
import { RelationalCountriesPersistenceModule } from '../countries/infrastructure/persistence/relational/relational-persistence.module';
import { CitiesModule } from '../cities/cities.module';

@Module({
  imports: [
    JobTypesModule,
    RelationalCountriesPersistenceModule,
    CitiesModule,
  ],
  controllers: [PublicController],
})
export class PublicModule {}
