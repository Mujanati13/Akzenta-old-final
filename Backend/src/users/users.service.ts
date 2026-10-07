import {
  HttpStatus,
  Injectable,
  Inject,
  forwardRef,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { FilesService } from '../files/files.service';
import { FileType } from '../files/domain/file';
import { User } from './domain/user';
import { Role } from '../roles/domain/role';
import { GenericStatus } from '../statuses/domain/status';
import { UserType } from '../user-type/domain/user-type';
import { AuthProvidersEnum } from '../auth/auth-providers.enum';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { UserTypeEnum } from '../user-type/user-types.enum';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { NullableType } from '../utils/types/nullable.type';
import * as bcrypt from 'bcryptjs';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientService } from '../client/client.service';
import { ClientCompanyAssignedClientService } from '../client-company-assigned-client/client-company-assigned-client.service';
import { ClientCompanyAssignedAkzenteService } from '../client-company-assigned-akzente/client-company-assigned-akzente.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => ClientCompanyAssignedClientService))
    private readonly clientCompanyAssignedClientService: ClientCompanyAssignedClientService,
    @Inject(forwardRef(() => ClientCompanyAssignedAkzenteService))
    private readonly clientCompanyAssignedAkzenteService: ClientCompanyAssignedAkzenteService,
    private readonly mailService: MailService, // Add this
  ) { }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    let email: string | null = null;

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        createUserDto.email,
      );
      if (userObject) {
        throw new Error('Email already exists');
      }
      email = createUserDto.email.toLowerCase().trim();
    }

    let photo: FileType | null | undefined = undefined;

    if (createUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        createUserDto.photo.id,
      );
      if (!fileObject) {
        throw new Error('File not found');
      }
      photo = fileObject;
    } else if (createUserDto.photo === null) {
      photo = null;
    }

    let role: Role | undefined = undefined;

    if (createUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(createUserDto.role.id));
      if (!roleObject) {
        throw new Error('Role not found');
      }

      role = {
        id: createUserDto.role.id,
      };
    }

    let status: GenericStatus | undefined = undefined;

    if (createUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(createUserDto.status.id));
      if (!statusObject) {
        throw new Error('Status not found');
      }

      status = {
        id: createUserDto.status.id,
      };
    }

    let userType: UserType | undefined = undefined;

    if (createUserDto.type?.id) {
      const userTypeObject = Object.values(UserTypeEnum)
        .map(String)
        .includes(String(createUserDto.type.id));
      if (!userTypeObject) {
        throw new Error('User type not found');
      }

      userType = {
        id: createUserDto.type.id,
      };
    }

    return this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: email,
      password: password,
      gender: createUserDto.gender,
      phone: createUserDto.phone,
      type: userType,
      photo: photo,
      role: role,
      status: status,
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
      socialId: createUserDto.socialId,
    });
  }

  /**
   * Optimized method to populate company relationships for multiple users
   * Only processes akzente and client user types
   */
  private async populateUsersCompanyRelationships(users: User[]): Promise<void> {
    if (users.length === 0) return;

    // Separate users by type - only process akzente and client users
    const akzenteUsers = users.filter(user => 
      user.type?.id === UserTypeEnum.akzente || user.type?.id === 1
    );
    const clientUsers = users.filter(user => 
      user.type?.id === UserTypeEnum.client || user.type?.id === 2
    );

    // Note: Merchandiser users are not processed here as they don't have 
    // favoriteClientCompanies or clientCompanies relationships

    // Process akzente users - populate favoriteClientCompanies
    if (akzenteUsers.length > 0) {
      try {
        const akzenteList = await this.akzenteService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });
        
        const clientCompanyAssignedAkzente = await this.clientCompanyAssignedAkzenteService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });

        // Filter out any null/undefined entries from the arrays
        const validAkzenteList = (akzenteList?.data || []).filter(a => a != null);
        const validAssignments = (clientCompanyAssignedAkzente?.data || []).filter(f => f != null && f.akzente != null);

        for (const user of akzenteUsers) {
          if (!user || !user.id) {
            user.clientCompanies = [];
            continue;
          }
          
          const akzente = validAkzenteList.find(a => a?.user?.id === user.id);
          if (akzente && akzente.id) {
            const userAkzenteAssignments = validAssignments.filter(f => f.akzente?.id === akzente.id);
            user.clientCompanies = userAkzenteAssignments.map(f => f.clientCompany).filter(cc => cc != null);
          } else {
            user.clientCompanies = [];
          }
        }
      } catch (error) {
        console.error('Error loading client companies for akzente users:', error);
        akzenteUsers.forEach(user => {
          if (user) {
            user.clientCompanies = [];
          }
        });
      }
    }

    // Process client users - populate clientCompanies
    if (clientUsers.length > 0) {
      try {
        const clientList = await this.clientService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });
        
        const assignmentsResult = await this.clientCompanyAssignedClientService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });

        for (const user of clientUsers) {
          const client = clientList.data.find(c => c.user.id === user.id);
          if (client) {
            const userAssignments = assignmentsResult.data.filter(a => a.client.id === client.id);
            user.clientCompanies = userAssignments.map(a => a.clientCompany);
            user.isSales = client.isSales === true;
          } else {
            user.clientCompanies = [];
          }
        }
      } catch (error) {
        console.error('Error loading client companies for client users:', error);
        clientUsers.forEach(user => user.clientCompanies = []);
      }
    }
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: User[]; totalCount: number }> {
    // Default filter to exclude merchandisers (only show akzente and client users)
    const defaultFilter: FilterUserDto = {
      userTypeNames: ['akzente', 'client']
    };

    // Merge filters - if no userTypeNames provided, use default to exclude merchandisers
    // But don't apply default if userTypeSearch is present (let userTypeSearch handle it)
    const finalFilter: FilterUserDto = filterOptions ? {
      ...filterOptions,
      userTypeNames: filterOptions.userTypeNames || (filterOptions.userTypeSearch ? undefined : defaultFilter.userTypeNames)
    } : defaultFilter;

    // Handle userTypeSearch - convert partial search to full type name
    if (finalFilter.userTypeSearch) {
      const searchTerm = finalFilter.userTypeSearch.toLowerCase();
      if (searchTerm.includes('akzente') || searchTerm === 'akzente') {
        finalFilter.userTypeNames = ['akzente'];
      } else if (searchTerm.includes('client') || searchTerm === 'kunde') {
        finalFilter.userTypeNames = ['client'];
      } else if (searchTerm.includes('merchandiser') || searchTerm === 'merchandiser') {
        // If user searches for merchandiser, show no results (empty array)
        finalFilter.userTypeNames = [];
      } else {
        // For any other search term, search in user type names but still exclude merchandisers
        // Keep userTypeSearch for LIKE matching, but ensure merchandisers are excluded
        finalFilter.userTypeNames = ['akzente', 'client']; // Always exclude merchandisers
      }
    }

    const result = await this.usersRepository.findManyWithPagination({
      filterOptions: finalFilter,
      sortOptions,
      paginationOptions,
    });

    // Populate company relationships for akzente and client users
    await this.populateUsersCompanyRelationships(result.data);

    // Apply client company filtering after population
    let filteredData = result.data;
    if (filterOptions?.clientCompanySearch) {
      filteredData = this.filterByClientCompanies(result.data, filterOptions.clientCompanySearch);
    }

    return {
      data: filteredData,
      totalCount: result.totalCount,
    };
  }

  /**
   * Filter users by client company names (favoriteClientCompanies or clientCompanies)
   */
  private filterByClientCompanies(users: User[], searchTerm: string): User[] {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return users.filter(user => {
      // Check favoriteClientCompanies for akzente users
      if (user.favoriteClientCompanies && user.favoriteClientCompanies.length > 0) {
        return user.favoriteClientCompanies.some(company => 
          company.name.toLowerCase().includes(lowerSearchTerm)
        );
      }
      
      // Check clientCompanies for client users
      if (user.clientCompanies && user.clientCompanies.length > 0) {
        return user.clientCompanies.some(company => 
          company.name.toLowerCase().includes(lowerSearchTerm)
        );
      }
      
      return false;
    });
  }

  /**
   * Helper method to populate company relationships for a user
   */
  private async populateUserCompanyRelationships(user: User): Promise<void> {
    // Populate favoriteClientCompanies for akzente users
    if (user.type?.id === UserTypeEnum.akzente || user.type?.id === 1) {
      try {
        const akzenteList = await this.akzenteService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });
        
        const akzente = akzenteList.data.find(a => a.user.id === user.id);
        
        if (akzente) {
          const clientCompanyAssignedAkzente = await this.clientCompanyAssignedAkzenteService.findAllWithPagination({
            paginationOptions: { page: 1, limit: 1000 },
          });
          
          const userAkzenteAssignments = clientCompanyAssignedAkzente.data.filter(f => f.akzente.id === akzente.id);
          user.clientCompanies = userAkzenteAssignments.map(f => f.clientCompany);
        } else {
          user.clientCompanies = [];
        }
      } catch (error) {
        console.error('Error loading client companies for user:', user.id, error);
        user.clientCompanies = [];
      }
    }

    // Populate clientCompanies for client users
    if (user.type?.id === UserTypeEnum.client || user.type?.id === 2) {
      try {
        const clientList = await this.clientService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });
        
        const client = clientList.data.find(c => c.user.id === user.id);
        
        if (client) {
          const assignmentsResult = await this.clientCompanyAssignedClientService.findAllWithPagination({
            paginationOptions: { page: 1, limit: 1000 },
          });
          
          const userAssignments = assignmentsResult.data.filter(a => a.client.id === client.id);
          user.clientCompanies = userAssignments.map(a => a.clientCompany);
          user.isSales = client.isSales === true;
        } else {
          user.clientCompanies = [];
        }
      } catch (error) {
        console.error('Error loading client companies for user:', user.id, error);
        user.clientCompanies = [];
      }
    }
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const user = await this.usersRepository.findById(id);
    
    if (!user) {
      return null;
    }

    await this.populateUserCompanyRelationships(user);
    return user;
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) {
      return Promise.resolve(null);
    }

    return this.usersRepository.findByEmail(email.toLowerCase().trim());
  }

  findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    return this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    const shouldSendGeneratedPassword =
      !!updateUserDto.sendGeneratedPasswordInEmail;
    let newPlaintextPassword = updateUserDto.password;
    if (shouldSendGeneratedPassword && !newPlaintextPassword) {
      newPlaintextPassword = this.generateRandomPassword(10);
    }

    let password: string | undefined = undefined;

    if (newPlaintextPassword) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(newPlaintextPassword, salt);
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const normalizedEmail = updateUserDto.email.toLowerCase().trim();
      const userObject = await this.usersRepository.findByEmail(
        normalizedEmail,
      );
      if (userObject && userObject.id !== id) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet.',
        });
      }
      email = normalizedEmail;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let photo: FileType | null | undefined = undefined;

    if (updateUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        updateUserDto.photo.id,
      );
      if (!fileObject) {
        throw new Error('File not found');
      }
      photo = fileObject;
    } else if (updateUserDto.photo === null) {
      photo = null;
    }

    let role: Role | undefined = undefined;

    if (updateUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(updateUserDto.role.id));
      if (!roleObject) {
        throw new Error('Role not found');
      }

      role = {
        id: updateUserDto.role.id,
      };
    }

    let status: GenericStatus | undefined = undefined;

    if (updateUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(updateUserDto.status.id));
      if (!statusObject) {
        throw new Error('Status not found');
      }

      status = {
        id: updateUserDto.status.id,
      };
    }

    let userType: UserType | undefined = undefined;

    if (updateUserDto.type?.id) {
      const userTypeObject = Object.values(UserTypeEnum)
        .map(String)
        .includes(String(updateUserDto.type.id));
      if (!userTypeObject) {
        throw new Error('User type not found');
      }

      userType = {
        id: updateUserDto.type.id,
      };
    }

    const wasPasswordUpdated =
      !!newPlaintextPassword &&
      (!!updateUserDto.password || shouldSendGeneratedPassword);

    if (wasPasswordUpdated && newPlaintextPassword && !updateUserDto.skipPasswordChangeNotification) {
      const existingUser = await this.usersRepository.findById(id);
      const targetEmail =
        email !== undefined ? email : existingUser?.email ?? null;

      if (!targetEmail) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailMissing',
          },
        });
      }

      try {
        const firstName =
          updateUserDto.firstName ?? existingUser?.firstName ?? '';

        const userTypeId = this.resolveUserTypeId(existingUser?.type?.id);

        if (updateUserDto.sendGeneratedPasswordInEmail) {
          await this.mailService.akzentePasswordReset({
            to: targetEmail,
            data: {
              firstName,
              password: newPlaintextPassword,
              userType: userTypeId,
            },
          });
        } else {
          await this.mailService.akzentePasswordChanged({
            to: targetEmail,
            data: { firstName, userType: userTypeId },
          });
        }
      } catch (emailError) {
        console.error('❌ Error sending password email:', emailError);
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailDeliveryFailed',
          },
        });
      }
    }

    const updatedUser = await this.usersRepository.update(id, {
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      email,
      password,
      gender: updateUserDto.gender,
      phone: updateUserDto.phone,
      type: userType,
      photo,
      role,
      status,
      provider: updateUserDto.provider,
      socialId: updateUserDto.socialId,
    });

    if (!updatedUser) {
      return null;
    }

    // Get the full user with relationships to ensure we have the type
    const fullUser = await this.usersRepository.findById(id);
    if (!fullUser) {
      return updatedUser;
    }

    // Handle favorite client companies for akzente users
    if (updateUserDto.clientCompanies !== undefined) {
      // Check if user type is akzente (using string comparison or enum value)
      const isAkzenteUser = fullUser.type?.id === UserTypeEnum.akzente ||
        fullUser.type?.id === 'akzente' ||
        (typeof fullUser.type?.id === 'string' && fullUser.type.id.toLowerCase() === 'akzente');

      if (isAkzenteUser) {
        await this.updateAkzenteAssignments(
          fullUser.id,
          updateUserDto.clientCompanies,
        );
      }
    }

    // Handle client company assignments for client users
    if (updateUserDto.clientCompanies !== undefined) {
      // Check if user type is client (using string comparison or enum value)
      const isClientUser = fullUser.type?.id === UserTypeEnum.client ||
        fullUser.type?.id === 'client' ||
        (typeof fullUser.type?.id === 'string' && fullUser.type.id.toLowerCase() === 'client');

      if (isClientUser) {
        await this.updateClientCompanyAssignments(
          fullUser.id,
          updateUserDto.clientCompanies,
        );
      }
    }

    if (updateUserDto.isSales !== undefined) {
      const isClientUser = fullUser.type?.id === UserTypeEnum.client ||
        fullUser.type?.id === 'client' ||
        (typeof fullUser.type?.id === 'string' && fullUser.type.id.toLowerCase() === 'client');

      if (isClientUser) {
        const clientList = await this.clientService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 },
        });
        const client = clientList.data.find((c) => c.user.id === fullUser.id);
        if (client) {
          await this.clientService.update(client.id, {
            isSales: updateUserDto.isSales,
          });
          fullUser.isSales = updateUserDto.isSales;
        }
      }
    }

    return fullUser;
  }

  private async updateAkzenteAssignments(
    userId: User['id'],
    clientCompanies: { id: number }[],
  ) {
    try {
      // Find the akzente record for this user
      const akzenteList = await this.akzenteService.findAllWithPagination({
        paginationOptions: { page: 1, limit: 1000 },
      });
      
      const akzente = akzenteList.data.find(a => a.user.id === userId);
      if (!akzente) {
        throw new Error('Akzente profile not found for user');
      }

      // Get existing favorites using the more efficient method
      const existingClientCompanyAssignments = await this.clientCompanyAssignedAkzenteService.findByAkzenteId(akzente.id);

      // Remove existing favorites
      for (const clientCompanyAssignment of existingClientCompanyAssignments) {
        await this.clientCompanyAssignedAkzenteService.remove(clientCompanyAssignment.id);
      }

      // Add new favorites
      for (const clientCompany of clientCompanies) {
        await this.clientCompanyAssignedAkzenteService.create({
          akzente: { id: akzente.id },
          clientCompany: { id: clientCompany.id },
        });
      }
    } catch (error) {
      console.error('Error updating client company assignments:', error);
      throw new Error('Failed to update client company assignments');
    }
  }

  private async updateClientCompanyAssignments(
    userId: User['id'],
    clientCompanies: { id: number }[],
  ) {
    try {
      // Find the client record for this user
      const clientList = await this.clientService.findAllWithPagination({
        paginationOptions: { page: 1, limit: 1000 },
      });

      const client = clientList.data.find(c => c.user.id === userId);
      if (!client) {
        throw new Error('Client profile not found for user');
      }

      // Get existing assignments using the more efficient method
      const existingAssignments = await this.clientCompanyAssignedClientService.findByClientId(client.id);

      // Remove existing assignments
      for (const assignment of existingAssignments) {
        await this.clientCompanyAssignedClientService.remove(assignment.id);
      }

      // Add new assignments
      for (const clientCompany of clientCompanies) {
        await this.clientCompanyAssignedClientService.create({
          client: { id: client.id },
          clientCompany: { id: clientCompany.id },
        });
      }
    } catch (error) {
      console.error('Error updating client company assignments:', error);
      throw new Error('Failed to update client company assignments');
    }
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.remove(id);
  }

  private resolveUserTypeId(typeId: unknown): number | undefined {
    if (typeId == null || typeId === '') {
      return undefined;
    }

    const numericTypeId = Number(typeId);
    return Number.isFinite(numericTypeId) ? numericTypeId : undefined;
  }

  private generateRandomPassword(length: number = 10): string {
    const passwordLength = Math.min(length, 10);
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const allChars = lowercase + uppercase + numbers;

    let generated = '';
    generated += lowercase[Math.floor(Math.random() * lowercase.length)];
    generated += uppercase[Math.floor(Math.random() * uppercase.length)];
    generated += numbers[Math.floor(Math.random() * numbers.length)];

    for (let i = generated.length; i < passwordLength; i++) {
      generated += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return generated.split('').sort(() => Math.random() - 0.5).join('');
  }

  async findAkzenteUsers({
    filterOptions,
    paginationOptions,
    sortOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    paginationOptions: IPaginationOptions;
    sortOptions?: SortUserDto[] | null;
  }): Promise<{ data: User[]; totalCount: number }> {
    // Default filter for akzente users
    const defaultFilter: FilterUserDto = {
      userTypeNames: ['akzente', 'client']
    };

    // If filters are provided, merge them with defaults
    const finalFilter: FilterUserDto = filterOptions ? {
      ...filterOptions,
      // If no userTypeNames provided, use default
      userTypeNames: filterOptions.userTypeNames || defaultFilter.userTypeNames
    } : defaultFilter;

    // Handle userTypeSearch - convert partial search to full type name
    if (finalFilter.userTypeSearch) {
      const searchTerm = finalFilter.userTypeSearch.toLowerCase();
      if (searchTerm.includes('akzente') || searchTerm === 'akzente') {
        finalFilter.userTypeNames = ['akzente'];
      } else if (searchTerm.includes('client') || searchTerm === 'kunde') {
        finalFilter.userTypeNames = ['client'];
      }
      // Remove the userTypeSearch since we've converted it to userTypeNames
      delete finalFilter.userTypeSearch;
    }

    const result = await this.usersRepository.findManyWithPagination({
      filterOptions: finalFilter,
      sortOptions,
      paginationOptions,
    });

    // Populate company relationships only for akzente and client users
    await this.populateUsersCompanyRelationships(result.data);

    // Apply client company filtering after population
    let filteredData = result.data;
    if (filterOptions?.clientCompanySearch) {
      filteredData = this.filterByClientCompanies(result.data, filterOptions.clientCompanySearch);
    }

    return {
      data: filteredData,
      totalCount: result.totalCount,
    };
  }
}
