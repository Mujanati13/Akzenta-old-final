import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportMailEntity } from './entities/support-mail.entity';
import { SupportMailRepository } from '../support-mail.repository';
import { SupportMailRelationalRepository } from './repositories/support-mail.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SupportMailEntity])],
  providers: [
    {
      provide: SupportMailRepository,
      useClass: SupportMailRelationalRepository,
    },
  ],
  exports: [SupportMailRepository],
})
export class RelationalSupportMailPersistenceModule {}

