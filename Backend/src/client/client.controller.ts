import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { FindAllClientDto } from './dto/find-all-client.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Client } from './domain/client';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Client')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'client',
  version: '1',
})
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @ApiCreatedResponse({
    type: Client,
  })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientService.create(createClientDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Client),
  })
  async findAll(
    @Query() query: FindAllClientDto,
  ): Promise<InfinityPaginationResponseDto<Client>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }
    const { data } = await this.clientService.findAllWithPagination({
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
    type: Client,
  })
  findById(@Param('id') id: number) {
    return this.clientService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Client,
  })
  update(@Param('id') id: number, @Body() updateClientDto: UpdateClientDto) {
    return this.clientService.update(id, updateClientDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.clientService.remove(id);
  }

  @Get('dashboard/data')
  @ApiOkResponse({
    description: 'Get dashboard data for the current Client user',
    schema: {
      type: 'object',
      properties: {
        assignedProjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              description: { type: 'string' },
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' },
              status: { type: 'string' },
              isFavorite: { type: 'boolean' },
              reportCounts: {
                type: 'object',
                properties: {
                  newReports: { type: 'number', description: 'Count of NEW + ASSIGNED reports' },
                  ongoingReports: { type: 'number', description: 'Count of DRAFT + IN_PROGRESS + DUE + FINISHED + ACCEPTED_BY_CLIENT reports' },
                  completedReports: { type: 'number', description: 'Count of VALID reports' },
                },
              },
              branchesCount: { type: 'number', description: 'Unique number of branches (stores) in this project' },
              clientCompany: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async getDashboard(
    @Request() request: any,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    // Validate user ID
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      throw new Error('Invalid user ID in request');
    }

    const parsedClientCompanyId = clientCompanyId ? Number(clientCompanyId) : undefined;
    return this.clientService.getDashboardData(
      request.user.id,
      parsedClientCompanyId && !isNaN(parsedClientCompanyId) ? parsedClientCompanyId : undefined,
    );
  }

  @Get('projects/list')
  @ApiOkResponse({
    description: 'Get assigned projects for the current Client user',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          description: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string' },
          isFavorite: { type: 'boolean' },
          clientCompany: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getProjectsList(
    @Request() request: any,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    const userId = request.user?.id;
    
    if (!userId || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID in request');
    }
    
    const parsedClientCompanyId = clientCompanyId ? Number(clientCompanyId) : undefined;
    const dashboardData = await this.clientService.getDashboardData(
      userId,
      parsedClientCompanyId && !isNaN(parsedClientCompanyId) ? parsedClientCompanyId : undefined,
    );
    
    return dashboardData.assignedProjects;
  }

  @Get('favorites/list')
  @ApiOkResponse({
    description: 'Get all favorites for the current Client user',
    schema: {
      type: 'object',
      properties: {
        favoriteReports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        favoriteProjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              reportCounts: {
                type: 'object',
                properties: {
                  newReports: { type: 'number', description: 'Count of NEW + ASSIGNED reports' },
                  ongoingReports: { type: 'number', description: 'Count of DRAFT + IN_PROGRESS + DUE + FINISHED + ACCEPTED_BY_CLIENT reports' },
                  completedReports: { type: 'number', description: 'Count of VALID reports' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async getFavorites(@Request() request: any) {
    // Validate user ID
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      throw new Error('Invalid user ID in request');
    }

    return this.clientService.getUserFavorites(request.user.id);
  }
}
