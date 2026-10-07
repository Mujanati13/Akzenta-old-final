import { Module } from '@nestjs/common';
import { MerchandiserSpecializationsRepository } from '../merchandiser-specializations.repository';
import { MerchandiserSpecializationsRelationalRepository } from './repositories/merchandiser-specializations.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserSpecializationsEntity } from './entities/merchandiser-specializations.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserSpecializationsEntity])],
  providers: [
    {
      provide: MerchandiserSpecializationsRepository,
      useClass: MerchandiserSpecializationsRelationalRepository,
    },
  ],
  exports: [MerchandiserSpecializationsRepository],
})
export class RelationalMerchandiserSpecializationsPersistenceModule {}