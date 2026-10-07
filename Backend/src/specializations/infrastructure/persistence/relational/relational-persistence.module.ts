import { Module } from '@nestjs/common';
import { SpecializationsRepository } from '../specializations.repository';
import { SpecializationsRelationalRepository } from './repositories/specializations.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecializationsEntity } from './entities/specializations.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SpecializationsEntity])],
  providers: [
    {
      provide: SpecializationsRepository,
      useClass: SpecializationsRelationalRepository,
    },
  ],
  exports: [SpecializationsRepository],
})
export class RelationalSpecializationsPersistenceModule {}