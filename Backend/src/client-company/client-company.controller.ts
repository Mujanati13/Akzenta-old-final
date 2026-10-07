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
  UseInterceptors,
  UploadedFile,
  Request,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientCompanyService } from './client-company.service';
import { CreateClientCompanyDto } from './dto/create-client-company.dto';
import { UpdateClientCompanyDto } from './dto/update-client-company.dto';
import { ClientCompany } from './domain/client-company';
import { FindAllClientCompanyDto } from './dto/find-all-client-company.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { ProjectService } from '../project/project.service';
import { BranchService } from '../branch/branch.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import {
  CLIENT_LOGO_MAX_FILE_SIZE_BYTES,
  CLIENT_LOGO_MAX_FILE_SIZE_MESSAGE,
} from './client-company-logo.constants';
import { MulterLogoExceptionFilter } from './multer-logo.exception-filter';

@ApiTags('ClientCompany')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'client-company',
  version: '1',
})
export class ClientCompanyController {
  constructor(
    private readonly clientCompanyService: ClientCompanyService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    @Inject(forwardRef(() => BranchService))
    private readonly branchService: BranchService,
    private readonly merchandiserService: MerchandiserService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: ClientCompany,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Company name',
        },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Company logo file',
        },
        contactIds: {
          type: 'string',
          description: 'JSON array of contact user IDs (Ansprechpartner Kunde)',
        },
        managerIds: {
          type: 'string',
          description: 'JSON array of manager user IDs (Projektleiter Akzente)',
        },
      },
      required: ['name'],
    },
  })
  @UseInterceptors(FileInterceptor('logo'))
  @UseFilters(MulterLogoExceptionFilter)
  async create(
    @Body('name') name: string,
    @Body('contactIds') contactIds?: string,
    @Body('managerIds') managerIds?: string,
    @UploadedFile() logo?: Express.Multer.File,
  ): Promise<ClientCompany> {
    this.assertLogoWithinSizeLimit(logo);

    const createClientCompanyDto: CreateClientCompanyDto = {
      name,
    };

    // Parse user IDs if provided
    let parsedContactUserIds: number[] = [];
    let parsedManagerUserIds: number[] = [];

    if (contactIds) {
      try {
        parsedContactUserIds = JSON.parse(contactIds);
      } catch (error) {
        console.error('Error parsing contactIds:', error);
      }
    }

    if (managerIds) {
      try {
        parsedManagerUserIds = JSON.parse(managerIds);
      } catch (error) {
        console.error('Error parsing managerIds:', error);
      }
    }

    return this.clientCompanyService.createWithRelationships(
      createClientCompanyDto,
      logo,
      parsedContactUserIds,
      parsedManagerUserIds
    );
  }

  @Get('my-client-companies')
  @ApiOkResponse({
    type: InfinityPaginationResponse(ClientCompany),
    description: 'Get client companies assigned to the current Akzente user',
  })
  async findMyCompanies(
    @Query() query: FindAllClientCompanyDto,
    @Request() request: any,
  ): Promise<InfinityPaginationResponseDto<ClientCompany>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 50;
    if (limit > 50) {
      limit = 50;
    }
    // If limit is 0, set it to a large number to get all results
    if (limit === 0) {
      limit = 1000;
    }

    const userId = request.user?.id;
    const userType = request.user?.userType || request.user?.type?.name;

    // Only allow Akzente users to access this endpoint
    if (userType !== 'akzente') {
      throw new ForbiddenException('Only Akzente users can access this endpoint');
    }

    const { data } = await this.clientCompanyService.findAssignedCompaniesForAkzenteUser({
      paginationOptions: {
        page,
        limit,
      },
      userId,
    });

    return infinityPagination(data, { page, limit });
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(ClientCompany),
  })
  async findAll(
    @Query() query: FindAllClientCompanyDto,
    @Request() request: any,
  ): Promise<InfinityPaginationResponseDto<ClientCompany>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 50;
    if (limit > 50) {
      limit = 50;
    }

    const userId = request.user?.id;

    const { data } = await this.clientCompanyService.findAllWithPaginationAndFavorites({
      paginationOptions: {
        page,
        limit,
      },
      userId,
    });

    return infinityPagination(data, { page, limit });
  }

  @Get('users/all')
  @ApiOkResponse({
    description: 'Get all users for client company assignment',
    schema: {
      type: 'object',
      properties: {
        clientUsers: {
          type: 'object',
          properties: {
            data: { type: 'array' }
          }
        },
        akzenteUsers: {
          type: 'object',
          properties: {
            data: { type: 'array' }
          }
        }
      }
    }
  })
  async getAllUsers() {
    const allUsers = await this.clientCompanyService.getAllUsers();
    return allUsers;
  }

  @Get('basic/all')
  @ApiOkResponse({
    description: 'Get all client companies with basic info only (id, name, logo) - no report counts or cities',
  })
  async findAllBasic(
    @Query() query: FindAllClientCompanyDto,
  ): Promise<InfinityPaginationResponseDto<ClientCompany>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 100;
    // Allow higher limit for basic endpoint since it's lightweight
    if (limit > 1000) {
      limit = 1000;
    }
    if (limit === 0) {
      limit = 1000;
    }

    const result = await this.clientCompanyService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(result.data, { page, limit });
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ClientCompany,
  })
  async findById(@Param('id') id: number) {
    if (!id || isNaN(Number(id))) {
      throw new NotFoundException(`Invalid client company ID: ${id}`);
    }
    
    // Get the client company with all relationships
    const result = await this.clientCompanyService.findByIdWithRelationships(Number(id));
    
    if (!result) {
      throw new NotFoundException(`Client company with ID ${id} not found`);
    }
    
    return result;
  }

  @Get(':id/projects')
  async getClientCompanyWithProjects(@Param('id') id: number, @Request() request: any) {
    const clientCompany = await this.clientCompanyService.findById(id);
    if (!clientCompany) {
      throw new NotFoundException('Client company not found');
    }
    
    const userId = request.user?.id;
    const userType = request.user?.userType || request.user?.type?.name;
    
    // Security check: If user is a merchandiser, verify they have at least one report in this client company
    if (userType === 'merchandiser') {
      const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(userId));
      
      if (!merchandiser) {
        throw new ForbiddenException('Merchandiser not found');
      }
      
      // Get projects for this merchandiser in this client company
      const projects = await this.clientCompanyService.getProjectsForUserType(id, userId);
      
      // If merchandiser has no projects (no assigned reports) in this client company, deny access
      if (!projects || projects.length === 0) {
        throw new ForbiddenException('You do not have permission to access this client company');
      }
      
      return { clientCompany, projects };
    }
    
    // For non-merchandiser users (Akzente, Client), get all projects
    const projects = await this.clientCompanyService.getProjectsForUserType(id, userId);
    
    return { clientCompany, projects };
  }

  @Get(':id/branches')
  async getClientCompanyBranches(@Param('id') id: number) {
    return this.branchService.findByClientCompanyId(Number(id));
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ClientCompany,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Company name',
        },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Company logo file',
        },
        contactIds: {
          type: 'string',
          description: 'JSON array of contact user IDs',
        },
        managerIds: {
          type: 'string',
          description: 'JSON array of manager user IDs',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('logo'))
  @UseFilters(MulterLogoExceptionFilter)
  async update(
    @Param('id') id: number,
    @Body('name') name?: string,
    @Body('contactIds') contactIds?: string,
    @Body('managerIds') managerIds?: string,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    this.assertLogoWithinSizeLimit(logo);

    const updateClientCompanyDto: UpdateClientCompanyDto = {};
    
    if (name !== undefined) {
      updateClientCompanyDto.name = name;
    }

    // Parse user IDs if provided
    let parsedContactUserIds: number[] = [];
    let parsedManagerUserIds: number[] = [];

    if (contactIds) {
      try {
        parsedContactUserIds = JSON.parse(contactIds);
      } catch (error) {
        console.error('Error parsing contactIds:', error);
      }
    }

    if (managerIds) {
      try {
        parsedManagerUserIds = JSON.parse(managerIds);
      } catch (error) {
        console.error('Error parsing managerIds:', error);
      }
    }

    return this.clientCompanyService.updateWithRelationships(
      id, 
      updateClientCompanyDto, 
      logo,
      parsedContactUserIds,
      parsedManagerUserIds
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.clientCompanyService.remove(id);
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
        isFavorite: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async toggleFavorite(
    @Param('id') id: number,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const result = await this.clientCompanyService.toggleFavoriteStatus(id, userId);

    return result;
  }

  private assertLogoWithinSizeLimit(logo?: Express.Multer.File): void {
    if (logo && logo.size > CLIENT_LOGO_MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException(CLIENT_LOGO_MAX_FILE_SIZE_MESSAGE);
    }
  }
}
