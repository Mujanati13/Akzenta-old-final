import {
  // do not remove this comment
  Module,
  forwardRef,
} from '@nestjs/common';
import { ClientFavoriteProjectService } from './client-favorite-projects.service';
import { ClientFavoriteProjectController } from './client-favorite-projects.controller';
import { RelationalClientFavoriteProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientModule } from '../client/client.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalClientFavoriteProjectPersistenceModule,
    forwardRef(() => ClientModule),
    forwardRef(() => ProjectModule),
  ],
  controllers: [ClientFavoriteProjectController],
  providers: [ClientFavoriteProjectService],
  exports: [
    ClientFavoriteProjectService,
    RelationalClientFavoriteProjectPersistenceModule,
  ],
})
export class ClientFavoriteProjectsModule {}
