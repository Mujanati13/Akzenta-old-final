import { Module } from '@nestjs/common';
import { ContractualsRepository } from '../contractuals.repository';
import { ContractualsRelationalRepository } from './repositories/contractuals.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractualsEntity } from './entities/contractuals.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContractualsEntity])],
  providers: [
    {
      provide: ContractualsRepository,
      useClass: ContractualsRelationalRepository,
    },
  ],
  exports: [ContractualsRepository],
})
export class RelationalContractualsPersistenceModule {}