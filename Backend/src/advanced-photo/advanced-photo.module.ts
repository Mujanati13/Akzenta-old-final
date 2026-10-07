import { forwardRef, Module } from '@nestjs/common';
import { AdvancedPhotoService } from './advanced-photo.service';
import { AdvancedPhotoController } from './advanced-photo.controller';
import { RelationalAdvancedPhotoPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [RelationalAdvancedPhotoPersistenceModule, forwardRef(() => ProjectModule)],
  controllers: [AdvancedPhotoController],
  providers: [AdvancedPhotoService],
  exports: [AdvancedPhotoService, RelationalAdvancedPhotoPersistenceModule],
})
export class AdvancedPhotoModule {}
