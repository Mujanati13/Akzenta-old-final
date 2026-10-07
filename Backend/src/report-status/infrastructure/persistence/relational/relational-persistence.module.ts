import { Module } from '@nestjs/common';
import { StatusRepository } from '../status.repository';
import { StatusRelationalRepository } from './repositories/status.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusEntity } from './entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StatusEntity])],
  providers: [
    {
      provide: StatusRepository,
      useClass: StatusRelationalRepository,
    },
  ],
  exports: [StatusRepository],
})
export class RelationalStatusPersistenceModule {}
