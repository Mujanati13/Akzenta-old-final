import { Module } from '@nestjs/common';
import { ClientCompanyRepository } from '../client-company.repository';
import { ClientCompanyRelationalRepository } from './repositories/client-company.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientCompanyEntity } from './entities/client-company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClientCompanyEntity])],
  providers: [
    {
      provide: ClientCompanyRepository,
      useClass: ClientCompanyRelationalRepository,
    },
  ],
  exports: [ClientCompanyRepository],
})
export class RelationalClientCompanyPersistenceModule {}
