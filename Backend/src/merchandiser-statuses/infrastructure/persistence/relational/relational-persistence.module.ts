import { Module } from '@nestjs/common';
import { StatusRepository } from '../status.repository';
import { StatusRelationalRepository } from './repositories/status.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserStatusEntity } from './entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserStatusEntity])],
  providers: [
    {
      provide: StatusRepository,
      useClass: StatusRelationalRepository,
    },
  ],
  exports: [StatusRepository],
})
export class RelationalStatusPersistenceModule {}
