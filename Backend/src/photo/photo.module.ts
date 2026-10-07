import { Module, forwardRef } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { RelationalPhotoPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [RelationalPhotoPersistenceModule, forwardRef(() => ProjectModule)],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService, RelationalPhotoPersistenceModule],
})
export class PhotoModule {}
