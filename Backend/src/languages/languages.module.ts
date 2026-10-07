import { Module } from '@nestjs/common';
import { LanguagesService } from './languages.service';
import { LanguagesController } from './languages.controller';
import { RelationalLanguagesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalLanguagesPersistenceModule],
  controllers: [LanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService, RelationalLanguagesPersistenceModule],
})
export class LanguagesModule {}