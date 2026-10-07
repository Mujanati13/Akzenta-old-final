import { Module } from '@nestjs/common';
import { ReportRepository } from '../report.repository';
import { ReportRelationalRepository } from './repositories/report.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportEntity } from './entities/report.entity';
import { MessageEntity } from '../../../../message/infrastructure/persistence/relational/entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReportEntity, MessageEntity])],
  providers: [
    {
      provide: ReportRepository,
      useClass: ReportRelationalRepository,
    },
  ],
  exports: [ReportRepository, TypeOrmModule],
})
export class RelationalReportPersistenceModule {}
