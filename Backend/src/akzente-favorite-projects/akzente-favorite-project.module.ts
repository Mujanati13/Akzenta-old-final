import {
  // do not remove this comment
  Module,
  forwardRef,
} from '@nestjs/common';
import { AkzenteFavoriteProjectService } from './akzente-favorite-project.service';
import { AkzenteFavoriteProjectController } from './akzente-favorite-project.controller';
import { RelationalAkzenteFavoriteProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalAkzenteFavoriteProjectPersistenceModule,
    forwardRef(() => AkzenteModule),
    forwardRef(() => ProjectModule),
  ],
  controllers: [AkzenteFavoriteProjectController],
  providers: [AkzenteFavoriteProjectService],
  exports: [
    AkzenteFavoriteProjectService,
    RelationalAkzenteFavoriteProjectPersistenceModule,
  ],
})
export class AkzenteFavoriteProjectModule {}
