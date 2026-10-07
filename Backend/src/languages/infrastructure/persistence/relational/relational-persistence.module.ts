import { Module } from '@nestjs/common';
import { LanguagesRepository } from '../languages.repository';
import { LanguagesRelationalRepository } from './repositories/languages.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LanguagesEntity } from './entities/languages.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LanguagesEntity])],
  providers: [
    {
      provide: LanguagesRepository,
      useClass: LanguagesRelationalRepository,
    },
  ],
  exports: [LanguagesRepository],
})
export class RelationalLanguagesPersistenceModule {}