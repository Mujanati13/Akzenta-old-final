import { Module } from '@nestjs/common';
import { BranchRepository } from '../branch.repository';
import { BranchRelationalRepository } from './repositories/branch.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchEntity } from './entities/branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BranchEntity])],
  providers: [
    {
      provide: BranchRepository,
      useClass: BranchRelationalRepository,
    },
  ],
  exports: [BranchRepository],
})
export class RelationalBranchPersistenceModule {}
