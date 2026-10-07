import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportEntity } from './entities/support.entity';
import { SupportRepository } from '../support.repository';
import { SupportRelationalRepository } from './repositories/support.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SupportEntity])],
  providers: [
    {
      provide: SupportRepository,
      useClass: SupportRelationalRepository,
    },
  ],
  exports: [SupportRepository],
})
export class RelationalSupportPersistenceModule {}

