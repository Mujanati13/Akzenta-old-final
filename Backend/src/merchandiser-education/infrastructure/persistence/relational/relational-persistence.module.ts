import { Module } from '@nestjs/common';
import { MerchandiserEducationRepository } from '../merchandiser-education.repository';
import { MerchandiserEducationRelationalRepository } from './repositories/merchandiser-education.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserEducationEntity } from './entities/merchandiser-education.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserEducationEntity])],
  providers: [
    {
      provide: MerchandiserEducationRepository,
      useClass: MerchandiserEducationRelationalRepository,
    },
  ],
  exports: [MerchandiserEducationRepository],
})
export class RelationalMerchandiserEducationPersistenceModule {}