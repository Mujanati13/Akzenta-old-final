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
import { AkzenteService } from './akzente.service';
import { CreateAkzenteDto } from './dto/create-akzente.dto';
import { UpdateAkzenteDto } from './dto/update-akzente.dto';
import { FindAllAkzenteDto } from './dto/find-all-akzente.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Akzente } from './domain/akzente';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Akzente')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'akzente',
  version: '1',
})
export class AkzenteController {
  constructor(private readonly akzenteService: AkzenteService) {}

  @Post()
  @ApiCreatedResponse({
    type: Akzente,
  })
  create(@Body() createAkzenteDto: CreateAkzenteDto) {
    return this.akzenteService.create(createAkzenteDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Akzente),
  })
  async findAll(
    @Query() query: FindAllAkzenteDto,
  ): Promise<InfinityPaginationResponseDto<Akzente>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }
    const { data } = await this.akzenteService.findAllWithPagination({
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
    type: Akzente,
  })
  findById(@Param('id') id: number) {
    return this.akzenteService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Akzente,
  })
  update(@Param('id') id: number, @Body() updateAkzenteDto: UpdateAkzenteDto) {
    return this.akzenteService.update(id, updateAkzenteDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.akzenteService.remove(id);
  }

  @Get('favorites/list')
  @ApiOkResponse({
    description: 'Get all favorites for the current Akzente user',
    schema: {
      type: 'object',
      properties: {
        favoriteClientCompanies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              website: { type: 'string' },
              address: { type: 'string' },
              postalCode: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
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
      console.error('❌ Invalid user ID:', {
        user: request.user,
        userId: request.user?.id,
        userIdType: typeof request.user?.id,
      });
      throw new Error('Invalid user ID in request');
    }

    return this.akzenteService.getUserFavorites(request.user.id);
  }

  @Get('dashboard/data')
  @ApiOkResponse({
    description: 'Get dashboard data for the current Akzente user',
    schema: {
      type: 'object',
      properties: {
        newReports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              isFavorite: { type: 'boolean' },
              project: {
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
        rejectedReports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              isFavorite: { type: 'boolean' },
              project: {
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

        dashboardClientCompanies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              website: { type: 'string' },
              address: { type: 'string' },
              postalCode: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              isFavorite: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              isMyClient: { type: 'boolean', description: 'Indicates if the client is directly assigned to the current Akzente user' },
              reportCounts: {
                type: 'object',
                properties: {
                  newReports: { type: 'number', description: 'Count of NEW + ASSIGNED reports' },
                  ongoingReports: { type: 'number', description: 'Count of DRAFT + IN_PROGRESS + DUE + FINISHED + ACCEPTED_BY_CLIENT reports' },
                  completedReports: { type: 'number', description: 'Count of VALID reports' },
                },
              },
            },
          },
        },
        totalClientCompaniesCount: {
          type: 'number',
          description: 'Total number of client companies available to the user (pre-pagination)',
        },
        processingTimeMs: {
          type: 'number',
          description: 'Server-side processing time (milliseconds) spent building the dashboard payload',
        },
      },
    },
  })
  async getDashboard(@Request() request: any) {
    // Validate user ID
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      console.error('❌ Invalid user ID in dashboard:', {
        user: request.user,
        userId: request.user?.id,
        userIdType: typeof request.user?.id,
      });
      throw new Error('Invalid user ID in request');
    }
    return this.akzenteService.getDashboardData(request.user.id, request);
  }
}
