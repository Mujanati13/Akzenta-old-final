import { Module } from '@nestjs/common';
import { AkzenteFavoriteClientCompanyRepository } from '../akzente-favorite-client-company.repository';
import { AkzenteFavoriteClientCompanyRelationalRepository } from './repositories/akzente-favorite-client-company.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AkzenteFavoriteClientCompanyEntity } from './entities/akzente-favorite-client-company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AkzenteFavoriteClientCompanyEntity])],
  providers: [
    {
      provide: AkzenteFavoriteClientCompanyRepository,
      useClass: AkzenteFavoriteClientCompanyRelationalRepository,
    },
  ],
  exports: [AkzenteFavoriteClientCompanyRepository],
})
export class RelationalAkzenteFavoriteClientCompanyPersistenceModule {}
