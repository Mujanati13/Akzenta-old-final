import { Module, forwardRef } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { ClientModule } from '../client/client.module';
import { ClientCompanyAssignedClientModule } from '../client-company-assigned-client/client-company-assigned-client.module';
import { ProjectAssignedClientModule } from '../project-assigned-client/project-assigned-client.module';
import { ClientFavoriteProjectsModule } from '../client-favorite-projects/client-favorite-projects.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    ClientCompanyModule,
    ClientModule,
    ClientCompanyAssignedClientModule,
    ProjectAssignedClientModule,
    ClientFavoriteProjectsModule,
    forwardRef(() => MerchandiserModule),
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
