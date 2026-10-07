import { Module } from '@nestjs/common';
import { AkzenteFavoriteReportRepository } from '../akzente-favorite-report.repository';
import { AkzenteFavoriteReportRelationalRepository } from './repositories/akzente-favorite-report.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AkzenteFavoriteReportEntity } from './entities/akzente-favorite-report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AkzenteFavoriteReportEntity])],
  providers: [
    {
      provide: AkzenteFavoriteReportRepository,
      useClass: AkzenteFavoriteReportRelationalRepository,
    },
  ],
  exports: [AkzenteFavoriteReportRepository],
})
export class RelationalAkzenteFavoriteReportPersistenceModule {}
