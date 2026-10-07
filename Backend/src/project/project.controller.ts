import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './domain/project';
import { FindAllProjectDto } from './dto/find-all-project.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { UsersService } from '../users/users.service';
import { AkzenteService } from '../akzente/akzente.service';
import { AkzenteFavoriteProjectService } from '../akzente-favorite-projects/akzente-favorite-project.service';
import { ClientService } from '../client/client.service';
import { ClientFavoriteProjectService } from '../client-favorite-projects/client-favorite-projects.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { MerchandiserFavoriteProjectService } from '../merchandiser-favorite-projects/merchandiser-favorite-projects.service';

@ApiTags('Project')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'project',
  version: '1',
})
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly usersService: UsersService,
    private readonly akzenteService: AkzenteService,
    private readonly akzenteFavoriteProjectService: AkzenteFavoriteProjectService,
    private readonly clientService: ClientService,
    private readonly clientFavoriteProjectService: ClientFavoriteProjectService,
    private readonly merchandiserService: MerchandiserService,
    private readonly merchandiserFavoriteProjectService: MerchandiserFavoriteProjectService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: Project,
  })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Project),
  })
  async findAll(
    @Query() query: FindAllProjectDto,
  ): Promise<InfinityPaginationResponseDto<Project>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.projectService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(data, { page, limit });
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Project,
  })
  findById(@Param('id') id: number) {
    return this.projectService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Project,
  })
  update(@Param('id') id: number, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Post(':id/toggle-favorite')
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        isFavorite: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async toggleFavorite(
    @Param('id') projectId: number,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    if (!userId) throw new Error('User not authenticated');
    const numericProjectId = Number(projectId);


    // Determine user type by checking if they exist as Akzente, Client, or Merchandiser
    const akzenteEntity = await this.akzenteService.findByUserId(userId);
    const clientEntity = await this.clientService.findByUserId(userId);
    const merchandiserEntity = await this.merchandiserService.findByUserIdNumber(userId);

    if (akzenteEntity) {
      // Handle Akzente user
      
      // Check if already favorite
      const existing = await this.akzenteFavoriteProjectService.findOne({ 
        akzenteId: akzenteEntity.id, 
        projectId: numericProjectId 
      });
      
      if (existing) {
        await this.akzenteFavoriteProjectService.remove(existing.id);
        return { isFavorite: false, message: 'Project Aus den Favoriten entfernt' };
      } else {
        await this.akzenteFavoriteProjectService.create({ 
          akzente: { id: userId }, // Pass user ID as expected by the service
          project: { id: numericProjectId } 
        });
        return { isFavorite: true, message: 'Project Zu den Favoriten hinzugefügt' };
      }
    } else if (clientEntity) {
      // Handle Client user
      
      // Check if already favorite
      const existing = await this.clientFavoriteProjectService.findOne({ 
        clientId: clientEntity.id, 
        projectId: numericProjectId 
      });
      
      if (existing) {
        await this.clientFavoriteProjectService.remove(existing.id);
        return { isFavorite: false, message: 'Project Aus den Favoriten entfernt' };
      } else {
        await this.clientFavoriteProjectService.create({ 
          client: { id: userId }, // Pass user ID as expected by the service
          project: { id: numericProjectId } 
        });
        return { isFavorite: true, message: 'Project Zu den Favoriten hinzugefügt' };
      }
    } else if (merchandiserEntity) {
      // Handle Merchandiser user
      
      // Check if already favorite
      const existing = await this.merchandiserFavoriteProjectService.findOne({ 
        merchandiserId: merchandiserEntity.id, 
        projectId: numericProjectId 
      });
      
      if (existing) {
        await this.merchandiserFavoriteProjectService.remove(existing.id);
        return { isFavorite: false, message: 'Project Aus den Favoriten entfernt' };
      } else {
        await this.merchandiserFavoriteProjectService.create({ 
          merchandiser: { id: merchandiserEntity.id }, // Pass merchandiser ID, not user ID
          project: { id: numericProjectId } 
        });
        return { isFavorite: true, message: 'Project Zu den Favoriten hinzugefügt' };
      }
    } else {
      throw new Error('User not found as Akzente, Client, or Merchandiser');
    }
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.projectService.remove(id);
  }
}
