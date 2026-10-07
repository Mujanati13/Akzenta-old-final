import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserLanguagesService } from './merchandiser-languages.service';
import { MerchandiserLanguagesController } from './merchandiser-languages.controller';
import { RelationalMerchandiserLanguagesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { LanguagesModule } from '../languages/languages.module';

@Module({
  imports: [
    RelationalMerchandiserLanguagesPersistenceModule,
    forwardRef(() => MerchandiserModule),
    LanguagesModule,
  ],
  controllers: [MerchandiserLanguagesController],
  providers: [MerchandiserLanguagesService],
  exports: [MerchandiserLanguagesService, RelationalMerchandiserLanguagesPersistenceModule],
})
export class MerchandiserLanguagesModule {}