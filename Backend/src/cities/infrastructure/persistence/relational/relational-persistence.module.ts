import { Module } from '@nestjs/common';
import { CitiesRepository } from '../cities.repository';
import { CitiesRelationalRepository } from './repositories/cities.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitiesEntity } from './entities/cities.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CitiesEntity])],
  providers: [
    {
      provide: CitiesRepository,
      useClass: CitiesRelationalRepository,
    },
  ],
  exports: [CitiesRepository],
})
export class RelationalCitiesPersistenceModule {}