import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusSeedService } from './status-seed.service';
import { GenericStatusEntity } from '../../../../statuses/infrastructure/persistence/relational/entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GenericStatusEntity])],
  providers: [StatusSeedService],
  exports: [StatusSeedService],
})
export class StatusSeedModule {}
