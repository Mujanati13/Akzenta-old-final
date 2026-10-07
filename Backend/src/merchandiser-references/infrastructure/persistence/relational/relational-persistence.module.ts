import { Module } from '@nestjs/common';
import { MerchandiserReferencesRepository } from '../merchandiser-references.repository';
import { MerchandiserReferencesRelationalRepository } from './repositories/merchandiser-references.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserReferencesEntity } from './entities/merchandiser-references.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserReferencesEntity])],
  providers: [
    {
      provide: MerchandiserReferencesRepository,
      useClass: MerchandiserReferencesRelationalRepository,
    },
  ],
  exports: [MerchandiserReferencesRepository],
})
export class RelationalMerchandiserReferencesPersistenceModule {}