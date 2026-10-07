import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Request,
  SerializeOptions,
  Put,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import { MerchandiserService } from './merchandiser.service';
import { CreateMerchandiserDto } from './dto/create-merchandiser.dto';
import { UpdateMerchandiserDto } from './dto/update-merchandiser.dto';
import { QueryMerchandiserDto } from './dto/query-merchandiser.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Merchandiser } from './domain/merchandiser';

import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { Public } from '../roles/public.decorator';
import { I18n, I18nContext } from 'nestjs-i18n';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SessionCheckGuard } from '../roles/session-check.guard';
import { Roles } from '../roles/roles.decorator';
import { MerchandiserFilesService } from '../merchandiser-files/merchandiser-files.service';
import { FilesLocalService } from '../files/infrastructure/uploader/local/files.service';

@ApiTags('Merchandiser')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.user)
@UseGuards(RolesGuard, SessionCheckGuard)
@Controller({
  path: 'merchandiser',
  version: '1',
})
export class MerchandiserController {
  constructor(
    private readonly merchandiserService: MerchandiserService,
    private readonly merchandiserFilesService: MerchandiserFilesService,
    private readonly filesLocalService: FilesLocalService,
  ) {}

  @Get('filter-options')
  @ApiOkResponse({
    description: 'Get filter options for merchandiser search (job types and statuses)',
    schema: {
      type: 'object',
      properties: {
        jobTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
          },
        },
        statuses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getFilterOptions() {
    return this.merchandiserService.getFilterOptions();
  }

  @Post()
  @ApiCreatedResponse({
    type: Merchandiser,
  })
  create(@Body() createMerchandiserDto: CreateMerchandiserDto) {
    return this.merchandiserService.create(createMerchandiserDto);
  }

  @Get('me')
  @ApiOkResponse({
    type: Merchandiser,
    description: 'Get current authenticated merchandiser',
  })
  findCurrentMerchandiser(@Request() request) {
    return this.merchandiserService.findByUserId(request.user);
  }

  @Get('dashboard')
  @ApiOkResponse({
    description: 'Get dashboard data for the current Merchandiser user',
    schema: {
      type: 'object',
      properties: {
        upcomingProjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              date: { type: 'string' },
              clientCompany: { type: 'string' },
              projectName: { type: 'string' },
            },
          },
        },
        upcomingProjectsCount: { type: 'number' },
        newRequestsCount: { type: 'number' },
        newRequests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              createdAt: { type: 'string' },
              branch: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        overdueReports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'object' },
              plannedOn: { type: 'string' },
              branch: { type: 'object' },
              project: { type: 'object' },
              isFavorite: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  async getDashboard(@Request() request: any) {
    // Validate user ID
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      throw new Error('Invalid user ID in request');
    }

    return this.merchandiserService.getDashboardData(request.user, request);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Merchandiser),
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  async findAll(
    @Query() query: QueryMerchandiserDto,
    @Request() request: any,
  ): Promise<InfinityPaginationResponseDto<Merchandiser>> {
    const page = query?.page ?? 1;
    // If limit is not provided (undefined), fetch all records without pagination
    // If limit is explicitly 0, also fetch all records
    // Otherwise, default to 10 and cap at 50 for pagination
    let limit = query?.limit;
    
    if (limit === undefined || limit === 0) {
      // No limit provided or limit is 0 means fetch all records (no pagination)
      limit = 0;
    } else if (limit > 50) {
      // Cap at 50 for regular pagination
      limit = 50;
    }

    const userId = request.user?.id;

    const { data, totalCount } = await this.merchandiserService.findAllWithPaginationAndFavorites({
      paginationOptions: {
        page,
        limit,
      },
      filters: query.filters,
      sort: query.sort,
      userId,
    });

    return infinityPagination(data, { page, limit }, totalCount);
  }

  @Get('reports')
  @ApiOkResponse({
    description: 'Get all reports for the current Merchandiser user',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              color: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          project: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
            },
          },
          merchandiser: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
          isFavorite: { type: 'boolean' },
        },
      },
    },
  })
  async getReports(@Request() request: any) {
    // Validate user ID
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      throw new Error('Invalid user ID in request');
    }

    return this.merchandiserService.getUserReports(request.user);
  }

  @Get('favorites/list')
  @ApiOkResponse({
    description: 'Get all favorites for the current Merchandiser user',
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
    return this.merchandiserService.getUserFavorites(request.user);
  }

  @Get('client-companies')
  @ApiOkResponse({
    description: 'Get all client companies associated with the current Merchandiser through their reports',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          logo: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              path: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getClientCompanies(@Request() request: any) {
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      throw new Error('Invalid user ID in request');
    }
    return this.merchandiserService.getClientCompaniesForUser(request.user);
  }

  @Get('assigned-reports')
  @ApiOkResponse({
    description: 'Get all assigned reports grouped by project for the current Merchandiser',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          project: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              clientCompany: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                  logo: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      path: { type: 'string' },
                    },
                  },
                },
              },
              isFavorite: { type: 'boolean' },
            },
          },
          reports: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                title: { type: 'string' },
                description: { type: 'string' },
                status: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    akzenteName: { type: 'string' },
                    clientName: { type: 'string' },
                    merchandiserName: { type: 'string' },
                    akzenteColor: { type: 'string' },
                    clientColor: { type: 'string' },
                    merchandiserColor: { type: 'string' },
                  },
                },
                branch: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    street: { type: 'string' },
                    zipCode: { type: 'string' },
                    phone: { type: 'string' },
                  },
                },
                street: { type: 'string' },
                zipCode: { type: 'string' },
                plannedOn: { type: 'string', format: 'date' },
                note: { type: 'string' },
                reportTo: { type: 'string', format: 'date' },
                feedback: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          reportCount: { type: 'number' },
        },
      },
    },
  })
  async getAssignedReportsGroupedByProject(@Request() request: any) {
    if (!request.user?.id || isNaN(request.user.id) || request.user.id <= 0) {
      throw new Error('Invalid user ID in request');
    }
    return this.merchandiserService.getAssignedReportsGroupedByProject(request.user);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        user: { $ref: '#/components/schemas/User' },
        birthday: { type: 'string', format: 'date', nullable: true },
        website: { type: 'string', nullable: true },
        street: { type: 'string' },
        zipCode: { type: 'string' },
        City: { $ref: '#/components/schemas/Cities' },
        nationality: { type: 'string', nullable: true },
        jobTypes: { type: 'array', items: { $ref: '#/components/schemas/JobTypes' } },
        languages: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserLanguages' } },
        specializations: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserSpecializations' } },
        references: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserReferences' } },
        education: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserEducation' } },
        files: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserFiles' } },
        reviews: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
        reviewStats: {
          type: 'object',
          properties: {
            averageRating: { type: 'number' },
            reviewCount: { type: 'number' },
          },
        },
        isFavorite: { type: 'boolean', description: 'Whether this merchandiser is favorited by the current user' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async findById(
    @Param('id') id: number,
    @Request() request: any, // Add this parameter
  ) {
    // Validate the ID parameter
    const merchandiserId = Number(id);
    if (isNaN(merchandiserId) || merchandiserId <= 0) {
      throw new Error(`Invalid merchandiser ID: ${id}. Expected a positive integer.`);
    }

    const userId = request.user?.id; // Extract userId from request
    
    const result = await this.merchandiserService.findByIdWithRelations(merchandiserId, userId); // Pass userId
    
    if (!result) {
      throw new Error('Merchandiser not found');
    }

    return result;
  }

  @Public()
  @Get('register')
  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  async MerchandiserRegister(@I18n() i18n: I18nContext) {
    return await this.merchandiserService.merchandiserRegister(i18n);
  }

  @Get('profile/me')
  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  async MerchandiserProfile(@Request() request, @I18n() i18n: I18nContext) {
    return await this.merchandiserService.merchandiserProfile(request.user, i18n);
  }

  @Get(':id/profile')
  @SerializeOptions({
    groups: ['admin'],
  })
  async MerchandiserProfileData(@Param('id') id: number, @Request() request, @I18n() i18n: I18nContext) {
    return await this.merchandiserService.merchandiserProfileData(id, request.user, i18n);
  }

  @Put('me')
  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  async UpdateMerchandiserProfile(
    @Request() request,
    @Body() updateData: any,
    @I18n() i18n: I18nContext
  ) {
    return await this.merchandiserService.updateMerchandiserProfile(request.user, updateData, i18n);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        user: { $ref: '#/components/schemas/User' },
        birthday: { type: 'string', format: 'date', nullable: true },
        website: { type: 'string', nullable: true },
        street: { type: 'string' },
        zipCode: { type: 'string' },
        City: { $ref: '#/components/schemas/Cities' },
        nationality: { type: 'string', nullable: true },
        jobTypes: { 
          type: 'array', 
          items: { 
            type: 'object',
            properties: {
              id: { type: 'number' },
              jobTypeId: { type: 'number' },
              name: { type: 'string' },
              comment: { type: 'string', nullable: true }
            }
          } 
        },
        languages: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserLanguages' } },
        specializations: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserSpecializations' } },
        references: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserReferences' } },
        education: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserEducation' } },
        files: { type: 'array', items: { $ref: '#/components/schemas/MerchandiserFiles' } },
        reviews: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
        reviewStats: {
          type: 'object',
          properties: {
            averageRating: { type: 'number' },
            reviewCount: { type: 'number' },
          },
        },
        isFavorite: { type: 'boolean', description: 'Whether this merchandiser is favorited by the current user' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async update(
    @Param('id') id: number,
    @Body() updateData: any,
    @Request() request: any,
  ) {
    
    // Use the comprehensive update method
    const result = await this.merchandiserService.update(id, updateData);
    
    return result;
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserService.remove(id);
  }

  @Post(':id/toggle-favorite')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async toggleFavorite(
    @Param('id') id: number,
    @Request() request: any,
  ) {
    return this.merchandiserService.toggleFavoriteStatus(id, request.user.id);
  }

  @Post('upload-file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          callback(
            null,
            `${uuid()}.${file.originalname
              .split('.')
              .pop()
              ?.toLowerCase()}`,
          );
        },
      }),
      limits: {
        fileSize: 30 * 1024 * 1024, // 30MB
      },
    }),
  )
  @ApiOkResponse({
    description: 'File uploaded successfully',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() request: any,
  ) {
    const { type, merchandiserId, name } = request.body;

    const merchandiser = await this.merchandiserService.findById(merchandiserId);
    if (!merchandiser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { merchandiser: 'Merchandiser not found' },
      });
    }

    // Handle replacement for singleton types
    if (type === 'portrait' || type === 'full_body_shot' || type === 'resume') {
      await this.merchandiserFilesService.removeExistingFilesByType(
        merchandiser.id,
        type as any,
      );
    }

    const { file: uploadedFile } = await this.filesLocalService.create(file, undefined, undefined, merchandiser.id, 'staf-files');
    const merchandiserFile = await this.merchandiserFilesService.create({
      merchandiser: { id: merchandiser.id },
      file: { id: uploadedFile.id },
      type: type,
      name: name || undefined,
    } as any);

    return merchandiserFile;
  }

  @Patch('files/:fileId')
  @ApiParam({
    name: 'fileId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    description: 'File metadata updated successfully',
  })
  async updateFileMetadata(
    @Param('fileId') fileId: number,
    @Body() body: { name?: string },
  ) {
    return this.merchandiserFilesService.update(fileId, {
      name: body.name,
    } as any);
  }

  @Delete('files/:fileId')
  @ApiParam({
    name: 'fileId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    description: 'File deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async deleteFile(
    @Param('fileId') fileId: number,
  ): Promise<{ success: boolean; message: string }> {

    const result = await this.merchandiserFilesService.deleteMerchandiserFile(fileId);

    return result;
  }
}
