import { Module } from '@nestjs/common';
import { MerchandiserLanguagesRepository } from '../merchandiser-languages.repository';
import { MerchandiserLanguagesRelationalRepository } from './repositories/merchandiser-languages.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserLanguagesEntity } from './entities/merchandiser-languages.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserLanguagesEntity])],
  providers: [
    {
      provide: MerchandiserLanguagesRepository,
      useClass: MerchandiserLanguagesRelationalRepository,
    },
  ],
  exports: [MerchandiserLanguagesRepository],
})
export class RelationalMerchandiserLanguagesPersistenceModule {}