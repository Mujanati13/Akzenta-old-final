import { Module } from '@nestjs/common';
import { ClientFavoriteReportRepository } from '../client-favorite-report.repository';
import { ClientFavoriteReportRelationalRepository } from './repositories/client-favorite-report.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientFavoriteReportEntity } from './entities/client-favorite-report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClientFavoriteReportEntity])],
  providers: [
    {
      provide: ClientFavoriteReportRepository,
      useClass: ClientFavoriteReportRelationalRepository,
    },
  ],
  exports: [ClientFavoriteReportRepository],
})
export class RelationalClientFavoriteReportPersistenceModule {}
