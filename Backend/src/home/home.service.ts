import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { UserRepository } from '../users/infrastructure/persistence/user.repository';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { ClientCompanyService } from '../client-company/client-company.service';
import { UserTypeEnum } from '../user-type/user-types.enum';
import { ClientService } from '../client/client.service';
import { ClientCompanyAssignedClientService } from '../client-company-assigned-client/client-company-assigned-client.service';
import { ProjectAssignedClientService } from '../project-assigned-client/project-assigned-client.service';
import { ClientFavoriteProjectService } from '../client-favorite-projects/client-favorite-projects.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';

@Injectable()
export class HomeService {
  constructor(
    private configService: ConfigService<AllConfigType>,
    private readonly userRepository: UserRepository,
    private readonly clientCompanyService: ClientCompanyService,
    private readonly clientService: ClientService,
    private readonly clientCompanyAssignedClientService: ClientCompanyAssignedClientService,
    private readonly projectAssignedClientService: ProjectAssignedClientService,
    private readonly clientFavoriteProjectService: ClientFavoriteProjectService,
    private readonly merchandiserService: MerchandiserService,
  ) { }

  appInfo() {
    return { name: this.configService.get('app.name', { infer: true }) };
  }

  /**
   * Helper method to add favorite status to projects for client users
   */
  private async addFavoriteStatusToProjects(projects: any[], clientId: number): Promise<any[]> {
    if (!clientId) {
      // If no client ID, all projects are not favorited
      return projects.map(project => ({ ...project, isFavorite: false }));
    }

    try {
      // Get all favorite projects for this Client user
      const allFavorites = await this.clientFavoriteProjectService.findByClientId(clientId);
      const favoriteProjectIds = allFavorites.map(fav => fav.project.id);

      // Add isFavorite field to each project
      return projects.map(project => ({
        ...project,
        isFavorite: favoriteProjectIds.includes(project.id)
      }));
    } catch (error) {
      // If there's an error, assume all projects are not favorited
      console.error('Error adding favorite status to projects:', error);
      return projects.map(project => ({ ...project, isFavorite: false }));
    }
  }

  async initialData(userJwtPayload: JwtPayloadType, i18n: any) {
    const data: any = {};
    try {
      if (userJwtPayload && userJwtPayload.id) {
        const currentUser = await this.userRepository.findById(userJwtPayload.id);

        if (!currentUser) {
          throw new UnprocessableEntityException({
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            errors: {
              user: 'userNotFound',
            },
          });
        }
        data.user = currentUser;

        if (currentUser.type?.id === UserTypeEnum.akzente) {
          const clientCompaniesResult = await this.clientCompanyService.findAllWithPagination({
            paginationOptions: {
              page: 1,
              limit: 100, // Limit to 100 to prevent slow load
            },
          });
          data.clientCompanies = clientCompaniesResult.data
        } else if (currentUser.type?.id === UserTypeEnum.client) {
          
          // For client users, get only their assigned client companies
          const client = await this.clientService.findByUserId(currentUser.id);
          
          if (client) {
            
            // Get client companies assigned to this client
            const clientAssignments = await this.clientCompanyAssignedClientService.findByClientId(client.id);
            
            // Extract client companies from assignments
            const assignedClientCompanies = clientAssignments.map(assignment => assignment.clientCompany);
            
            data.clientCompanies = assignedClientCompanies;
            
            // Get projects assigned to this client
            const projectAssignments = await this.projectAssignedClientService.findByClientId(client.id);
            
            // Extract projects from assignments
            const assignedProjects = projectAssignments.map(assignment => assignment.project);
            
            // Add favorite status to projects
            const assignedProjectsWithFavorites = await this.addFavoriteStatusToProjects(assignedProjects, client.id);
            
            data.assignedProjects = assignedProjectsWithFavorites;
          } else {
            console.warn('❌ No client record found for user:', currentUser.id);
            data.clientCompanies = [];
            data.assignedProjects = [];
          }
        } else if (currentUser.type?.id === UserTypeEnum.merchandiser) {
          
          try {
            // For merchandiser users, get client companies they have reports for
            const clientCompanies = await this.merchandiserService.getClientCompaniesForUser(userJwtPayload);
            
            data.clientCompanies = clientCompanies;
          } catch (error) {
            console.error('❌ Error fetching client companies for merchandiser:', error);
            data.clientCompanies = [];
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in initialData:', error);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          message: error.message || 'An error occurred while fetching the data',
        },
      });
    }

    return data;
  }
}