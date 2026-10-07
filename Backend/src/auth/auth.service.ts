import {
  ConflictException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import ms from 'ms';
import crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { AuthProvidersEnum } from './auth-providers.enum';
import { SocialInterface } from '../social/interfaces/social.interface';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { NullableType } from '../utils/types/nullable.type';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayloadType } from './strategies/types/jwt-refresh-payload.type';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
import { RoleEnum } from '../roles/roles.enum';
import { Session } from '../session/domain/session';
import { SessionService } from '../session/session.service';
import { StatusEnum } from '../statuses/statuses.enum';
import { UserTypeEnum } from '../user-type/user-types.enum';
import { User } from '../users/domain/user';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { JobTypesService } from '../job-types/job-types.service';
import { CountriesService } from '../countries/countries.service';
import { CitiesService } from '../cities/cities.service';
import { AuthRegisterClientDto } from './dto/auth-register-client.dto';
import { ClientService } from '../client/client.service';
import { ClientCompanyService } from '../client-company/client-company.service';
import { ClientCompanyAssignedClientService } from '../client-company-assigned-client/client-company-assigned-client.service';
import { AuthRegisterAkzenteDto } from './dto/auth-register-akzente.dto';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientCompanyAssignedAkzenteService } from '../client-company-assigned-akzente/client-company-assigned-akzente.service';
import { SessionExpiryService } from './session-expiry.service';
import {
  getRequestOrigin,
  parseAuthScopeHeader,
  resolvePasswordResetFrontendDomain,
} from './auth-cookie.util';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private sessionExpiryService: SessionExpiryService,
    private mailService: MailService,
    private configService: ConfigService<AllConfigType>,
    private citiesService: CitiesService,
    private merchandiserService: MerchandiserService,
    private jobTypesService: JobTypesService,
    private countriesService: CountriesService,
    private clientService: ClientService,
    private clientCompanyService: ClientCompanyService,
    private clientCompanyAssignedClientService: ClientCompanyAssignedClientService,
    private akzenteService: AkzenteService,
    @Inject(forwardRef(() => ClientCompanyAssignedAkzenteService))
    private readonly clientCompanyAssignedAkzenteService: ClientCompanyAssignedAkzenteService,
  ) {}

  async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'notFound',
        },
      });
    }

    if (user.provider !== AuthProvidersEnum.email) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: `needLoginViaProvider:${user.provider}`,
        },
      });
    }

    if (user.status?.id?.toString() === StatusEnum.inactive.toString()) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          status: 'unconfirmedProfile',
        },
      });
    }

    if (!user.password) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: 'incorrectPassword',
        },
      });
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: 'incorrectPassword',
        },
      });
    }

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = await this.sessionService.create({
      user,
      hash,
    });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: user.role,
      sessionId: session.id,
      hash,
      sessionActivityAt:
        session.lastActivityAt ?? session.updatedAt ?? session.createdAt,
    });

    return {
      refreshToken,
      token,
      tokenExpires,
      user,
    };
  }

  async validateSocialLogin(
    authProvider: string,
    socialData: SocialInterface,
  ): Promise<LoginResponseDto> {
    let user: NullableType<User> = null;
    const socialEmail = socialData.email?.toLowerCase();
    let userByEmail: NullableType<User> = null;

    if (socialEmail) {
      userByEmail = await this.usersService.findByEmail(socialEmail);
    }

    if (socialData.id) {
      user = await this.usersService.findBySocialIdAndProvider({
        socialId: socialData.id,
        provider: authProvider,
      });
    }

    if (user) {
      if (socialEmail && !userByEmail) {
        user.email = socialEmail;
      }
      await this.usersService.update(user.id, user);
    } else if (userByEmail) {
      user = userByEmail;
    } else if (socialData.id) {
      const role = {
        id: RoleEnum.user,
      };
      const status = {
        id: StatusEnum.active,
      };

      user = await this.usersService.create({
        email: socialEmail ?? null,
        firstName: socialData.firstName ?? null,
        lastName: socialData.lastName ?? null,
        socialId: socialData.id,
        provider: authProvider,
        role,
        status,
      });

      user = await this.usersService.findById(user.id);
    }

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = await this.sessionService.create({
      user,
      hash,
    });

    const {
      token: jwtToken,
      refreshToken,
      tokenExpires,
    } = await this.getTokensData({
      id: user.id,
      role: user.role,
      sessionId: session.id,
      hash,
      sessionActivityAt:
        session.lastActivityAt ?? session.updatedAt ?? session.createdAt,
    });

    return {
      refreshToken,
      token: jwtToken,
      tokenExpires,
      user,
    };
  }

  async register(dto: AuthRegisterLoginDto): Promise<{ confirmationEmailSent: boolean }> {
    // Check if email already exists before proceeding
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailAlreadyExists',
        },
      });
    }

    // Validate job types exist
    if (!dto.jobTypeIds || dto.jobTypeIds.length === 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          jobTypeIds: 'At least one job type is required',
        },
      });
    }

    const jobTypes = await this.jobTypesService.findByIds(dto.jobTypeIds);
    if (jobTypes.length !== dto.jobTypeIds.length) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          jobTypeIds: 'Some job types not found',
        },
      });
    }

    const normalizedCountryName = dto.countryName?.trim();
    const normalizedCityName = dto.cityName?.trim();

    // Country can be selected by id or entered manually by name.
    if (!dto.countryId && !normalizedCountryName) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          country: 'Country is required',
        },
      });
    }

    let resolvedCountryId = dto.countryId;

    if (resolvedCountryId) {
      const existingCountry = await this.countriesService.findById(resolvedCountryId);
      if (!existingCountry) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            countryId: 'Country not found',
          },
        });
      }
    } else if (normalizedCountryName) {
      const createdCountry = await this.countriesService.create({
        name: {
          de: normalizedCountryName,
          en: normalizedCountryName,
          fr: normalizedCountryName,
          ar: normalizedCountryName,
          sp: normalizedCountryName,
        },
      });
      resolvedCountryId = createdCountry.id;
    }

    // City can be selected by id or entered manually by name.
    if (!dto.cityId && !normalizedCityName) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          city: 'City is required',
        },
      });
    }

    let resolvedCityId = dto.cityId;

    if (resolvedCityId) {
      const existingCity = await this.citiesService.findById(resolvedCityId);
      if (!existingCity) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            cityId: 'City not found',
          },
        });
      }
    } else if (normalizedCityName) {
      const createdCity = await this.citiesService.findOrCreateByName(
        normalizedCityName,
        normalizedCountryName || 'Deutschland',
      );
      resolvedCityId = createdCity?.id;
    }

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone || '',
      role: {
        id: RoleEnum.user,
      },
      status: {
        id: StatusEnum.inactive,
      },
      type: {
        id: UserTypeEnum.merchandiser,
      },
      provider: AuthProvidersEnum.email,
    });

    // Create merchandiser profile with job types
    await this.merchandiserService.create({
      user: { id: Number(user.id) },
      street: '',
      zipCode: dto.zipCode || '',
      city: { id: resolvedCityId! },
      jobTypeIds: dto.jobTypeIds,
    });

    const hash = await this.jwtService.signAsync(
      {
        confirmEmailUserId: user.id,
      },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );

    try {
      await this.mailService.merchandiserSignUp({
        to: dto.email,
        data: {
          hash,
          firstName: dto.firstName,
        },
      });
      return { confirmationEmailSent: true };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.warn(
        `Merchandiser signup confirmation email failed for ${dto.email}: ${errMsg}${stack ? ` | ${stack}` : ''}`,
      );
      return { confirmationEmailSent: false };
    }
  }

  async registerClient(dto: AuthRegisterClientDto, akzenteUserId: User['id']): Promise<void> {
    // Verify the requesting user is an Akzente user
    const akzenteUser = await this.usersService.findById(akzenteUserId);
    if (!akzenteUser || akzenteUser.type?.id !== UserTypeEnum.akzente) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'unauthorizedUserType',
        },
      });
    }

    // Check if email already exists
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailAlreadyExists',
        },
      });
    }

    // Validate client companies exist
    const clientCompanyIds = dto.clientCompanies.map(cc => cc.id);
    const clientCompanies = await this.clientCompanyService.findByIds(clientCompanyIds);
    if (clientCompanies.length !== clientCompanyIds.length) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          clientCompanies: 'Some client companies not found',
        },
      });
    }

    // Always auto-generate password; never accept a manual password on registration.
    const generatedPassword = this.generateRandomPassword(10);

    // Create user with generated or provided password
    const user = await this.usersService.create({
      email: dto.email,
      password: generatedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone || '', // Handle optional phone
      gender: dto.gender,
      role: {
        id: RoleEnum.user,
      },
      status: {
        id: StatusEnum.active, // Set to active so user can login immediately
      },
      type: {
        id: UserTypeEnum.client,
      },
    });
    
    // Verify the password was stored correctly by checking the user
    const createdUser = await this.usersService.findById(user.id);
    if (createdUser?.password) {
      const passwordMatches = await bcrypt.compare(generatedPassword, createdUser.password);
      if (!passwordMatches) {
        console.error('❌ CRITICAL: Generated password does not match stored hash!');
        console.error('Generated:', generatedPassword);
        console.error('Stored hash:', createdUser.password);
      }
    }

    // Create client profile
    const client = await this.clientService.create({
      user: { id: Number(user.id) },
      isSales: dto.isSales ?? false, // Pass isSales from DTO
    });

    // Create client assignments to companies
    for (const clientCompany of clientCompanies) {
      await this.clientCompanyAssignedClientService.create({
        client: { id: client.id },
        clientCompany: { id: clientCompany.id },
      });
    }

    this.mailService.akzenteWelcome({
      to: dto.email,
      data: {
        firstName: dto.firstName,
        password: generatedPassword,
        userType: UserTypeEnum.client,
      },
    }).catch((emailError: any) => {
      const errMsg =
        emailError instanceof Error ? emailError.message : String(emailError);
      this.logger.warn(
        `Client welcome email failed for ${dto.email}: ${errMsg}`,
      );
    });
  }

  async registerAkzente(dto: AuthRegisterAkzenteDto, adminUserId: User['id']): Promise<void> {

    // Verify the requesting user is an admin or has permission
    const adminUser = await this.usersService.findById(adminUserId);
    if (!adminUser || adminUser.role?.id !== RoleEnum.admin) {
      console.error('❌ Unauthorized: User is not an admin');
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'unauthorizedUserRole',
        },
      });
    }

    // Validate that favorite client companies exist
    const clientCompanyIds = dto.clientCompanies.map(company => company.id);
    const existingCompanies = await this.clientCompanyService.findByIds(clientCompanyIds);
    
    if (existingCompanies.length !== clientCompanyIds.length) {
      console.error('❌ Some favorite client companies not found');
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          clientCompanies: 'Some client companies were not found',
        },
      });
    }


    try {
      // Check if user with email already exists
      const existingUser = await this.usersService.findByEmail(dto.email);
      if (existingUser) {
        console.error('❌ User with email already exists');
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'Email already exists',
          },
        });
      }

      const generatedPassword = this.generateRandomPassword(10);

      // Create user with Akzente type (password hashed in usersService.create)
      const user = await this.usersService.create({
        email: dto.email,
        password: generatedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        phone: dto.phone || '', // Handle optional phone
        type: {
          id: UserTypeEnum.akzente,
        },
        role: {
          id: RoleEnum.user,
        },
        status: {
          id: StatusEnum.active, // Akzente users are active by default
        },
      });

      // Create Akzente profile
      const akzenteProfile = await this.akzenteService.create({
        user: { id: Number(user.id) },
      });

      // Create favorite client company relationships
      const clientCompanyPromises = existingCompanies.map(company =>
        this.clientCompanyAssignedAkzenteService.create({
          akzente: { id: akzenteProfile.id },
          clientCompany: { id: company.id },
        })
      );

      await Promise.all(clientCompanyPromises);

      this.mailService.akzenteWelcome({
        to: dto.email,
        data: {
          firstName: dto.firstName,
          password: generatedPassword,
          userType: UserTypeEnum.akzente,
        },
      }).catch((emailError: any) => {
        const errMsg =
          emailError instanceof Error ? emailError.message : String(emailError);
        this.logger.warn(
          `Akzente welcome email failed for ${dto.email}: ${errMsg}`,
        );
      });
    } catch (error) {
    console.error('❌ Error during Akzente user registration:', error);
    throw error;
  }
}

  async confirmEmail(hash: string): Promise<void> {
    let userId: User['id'];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
      });

      userId = jwtData.confirmEmailUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    if (user?.status?.id?.toString() !== StatusEnum.inactive.toString()) {
      throw new ConflictException({
        status: HttpStatus.CONFLICT,
        error: 'alreadyActive',
      });
    }

    await this.usersService.update(user.id, {
      status: {
        id: StatusEnum.active,
      },
    });
  }

  async confirmNewEmail(hash: string): Promise<void> {
    let userId: User['id'];
    let newEmail: User['email'];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
        newEmail: User['email'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
      });

      userId = jwtData.confirmEmailUserId;
      newEmail = jwtData.newEmail;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    user.email = newEmail;
    user.status = {
      id: StatusEnum.active,
    };

    await this.usersService.update(user.id, user);
  }

  async forgotPassword(
    email: string,
    userType?: number,
    request?: ExpressRequest,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotExists',
        },
      });
    }

    const resolvedUserTypeId = this.resolveUserTypeId(user.type);

    // If userType is specified, verify the user has that type
    if (
      userType !== undefined &&
      resolvedUserTypeId !== undefined &&
      Number(userType) !== resolvedUserTypeId
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotExists',
        },
      });
    }

    const tokenExpiresIn = this.configService.getOrThrow('auth.forgotExpires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      {
        forgotUserId: user.id,
        passwordFingerprint: this.createPasswordFingerprint(user.password),
        userType: resolvedUserTypeId,
      },
      {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
        expiresIn: tokenExpiresIn,
      },
    );

    const frontendBaseUrl = resolvePasswordResetFrontendDomain(
      this.configService,
      {
        userTypeId: resolvedUserTypeId,
        requestOrigin: request ? getRequestOrigin(request) : undefined,
        authScope: request ? parseAuthScopeHeader(request) : undefined,
      },
    );

    await this.mailService.forgotPassword({
      to: email,
      data: {
        hash,
        tokenExpires,
        userType: resolvedUserTypeId,
        frontendBaseUrl,
      },
    });
  }

  async validateResetPasswordHash(
    hash: string,
    userType?: number,
  ): Promise<User> {
    let userId: User['id'];
    let passwordFingerprintFromToken: string | undefined;
    let tokenUserType: number | undefined;

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        forgotUserId: User['id'];
        passwordFingerprint?: string;
        userType?: number;
      }>(hash, {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
      });

      userId = jwtData.forgotUserId;
      passwordFingerprintFromToken = jwtData.passwordFingerprint;
      tokenUserType =
        jwtData.userType !== undefined && jwtData.userType !== null
          ? Number(jwtData.userType)
          : undefined;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `notFound`,
        },
      });
    }

    const actualUserType = this.resolveUserTypeId(user.type);
    const requestedUserType =
      userType !== undefined && userType !== null ? Number(userType) : undefined;

    if (tokenUserType !== undefined && actualUserType !== undefined && tokenUserType !== actualUserType) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const effectiveUserType = tokenUserType ?? actualUserType;

    if (
      requestedUserType !== undefined &&
      effectiveUserType !== undefined &&
      requestedUserType !== effectiveUserType
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidUserType`,
        },
      });
    }

    if (
      tokenUserType === undefined &&
      requestedUserType !== undefined &&
      actualUserType !== undefined &&
      requestedUserType !== actualUserType
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidUserType`,
        },
      });
    }

    if (
      passwordFingerprintFromToken &&
      passwordFingerprintFromToken !== this.createPasswordFingerprint(user.password)
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    return user;
  }

  async resetPassword(hash: string, password: string, userType?: number): Promise<void> {
    const user = await this.validateResetPasswordHash(hash, userType);

    if (user.password) {
      const isSamePassword = await bcrypt.compare(password, user.password);
      if (isSamePassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            password: 'sameAsOldPassword',
          },
        });
      }
    }

    await this.sessionService.deleteByUserId({
      userId: user.id,
    });

    await this.usersService.update(user.id, {
      password,
      skipPasswordChangeNotification: true,
    });
  }

  private createPasswordFingerprint(password: string | null | undefined): string {
    return crypto
      .createHash('sha256')
      .update(password ?? '')
      .digest('hex');
  }

  private resolveUserTypeId(type: User['type']): number | undefined {
    if (type?.id === undefined || type?.id === null) {
      return undefined;
    }

    if (typeof type.id === 'number') {
      return type.id;
    }

    const normalizedName = String(type.id).toLowerCase();
    if (normalizedName === 'akzente') {
      return UserTypeEnum.akzente;
    }
    if (normalizedName === 'client') {
      return UserTypeEnum.client;
    }
    if (normalizedName === 'merchandiser') {
      return UserTypeEnum.merchandiser;
    }

    const parsed = Number(type.id);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.id);
  }

  async update(
    userJwtPayload: JwtPayloadType,
    userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.id);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'missingOldPassword',
          },
        });
      }

      if (!currentUser.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      }

      const isValidOldPassword = await bcrypt.compare(
        userDto.oldPassword,
        currentUser.password,
      );

      if (!isValidOldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      } else {
        await this.sessionService.deleteByUserIdWithExclude({
          userId: currentUser.id,
          excludeSessionId: userJwtPayload.sessionId,
        });
      }
    }

    if (userDto.email && userDto.email !== currentUser.email) {
      const userByEmail = await this.usersService.findByEmail(userDto.email);

      if (userByEmail && userByEmail.id !== currentUser.id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailExists',
          },
        });
      }

      const hash = await this.jwtService.signAsync(
        {
          confirmEmailUserId: currentUser.id,
          newEmail: userDto.email,
        },
        {
          secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
            infer: true,
          }),
        },
      );

      await this.mailService.confirmNewEmail({
        to: userDto.email,
        data: {
          hash,
          userType: this.resolveUserTypeId(currentUser.type),
        },
      });
    }

    delete userDto.email;
    delete userDto.oldPassword;

    await this.usersService.update(userJwtPayload.id, userDto);

    return this.usersService.findById(userJwtPayload.id);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, 'sessionId' | 'hash'>,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    const session = await this.sessionService.findById(data.sessionId);

    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.hash !== data.hash) {
      throw new UnauthorizedException();
    }

    const sessionActivityAt =
      session.lastActivityAt ?? session.updatedAt ?? session.createdAt;

    if (this.sessionExpiryService.isExpired(sessionActivityAt)) {
      await this.sessionService.deleteById(session.id);
      throw new UnauthorizedException('Session has expired. Please log in again.');
    }

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const user = await this.usersService.findById(session.user.id);

    if (!user?.role) {
      throw new UnauthorizedException();
    }

    const refreshedAt = new Date();

    await this.sessionService.update(session.id, {
      hash,
      lastActivityAt: refreshedAt,
    });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.user.id,
      role: {
        id: user.role.id,
      },
      sessionId: session.id,
      hash,
      sessionActivityAt: refreshedAt,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.remove(user.id);
  }

  async logout(data: Pick<JwtRefreshPayloadType, 'sessionId'>) {
    return this.sessionService.deleteById(data.sessionId);
  }

  async touchSession(sessionId: Session['id']): Promise<void> {
    await this.sessionService.touchActivity(sessionId, 0);
  }

  async resendConfirmationEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotExists',
        },
      });
    }

    // Check if user is already confirmed
    if (user.status?.id?.toString() === StatusEnum.active.toString()) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailAlreadyConfirmed',
        },
      });
    }

    // Check if user is inactive (unconfirmed)
    if (user.status?.id?.toString() !== StatusEnum.inactive.toString()) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'invalidAccountStatus',
        },
      });
    }

    const hash = await this.jwtService.signAsync(
      {
        confirmEmailUserId: user.id,
      },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );

    // Use merchandiser-specific template if user is a merchandiser
    if (user.type?.id === UserTypeEnum.merchandiser) {
      await this.mailService.merchandiserSignUp({
        to: email,
        data: {
          hash,
          firstName: user.firstName || '',
        },
      });
    } else {
      await this.mailService.userSignUp({
        to: email,
        data: {
          hash,
          userType: this.resolveUserTypeId(user.type),
        },
      });
    }
  }

  private async getTokensData(data: {
    id: User['id'];
    role: User['role'];
    sessionId: Session['id'];
    hash: Session['hash'];
    sessionActivityAt: Session['lastActivityAt'] | Session['updatedAt'] | Session['createdAt'];
  }) {
    const configuredTokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });
    const configuredRefreshExpiresIn = this.configService.getOrThrow(
      'auth.refreshExpires',
      {
        infer: true,
      },
    );

    const remainingSessionMs = this.getRemainingSessionMs(data.sessionActivityAt);
    if (remainingSessionMs <= 0) {
      throw new UnauthorizedException('Session has expired. Please log in again.');
    }

    const tokenExpiresIn = this.getCappedExpiry(
      configuredTokenExpiresIn,
      remainingSessionMs,
    );
    const refreshExpiresIn = this.getCappedExpiry(
      configuredRefreshExpiresIn,
      remainingSessionMs,
    );

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    // Determine user type for JWT payload
    const userType = await this.determineUserType(Number(data.id));

    const roleId = data.role?.id;
    if (roleId == null || roleId === '') {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'missingRoleAssignment',
        },
      });
    }

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: { id: Number(roleId) },
          userType: userType,
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async validateAkzenteLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    this.logger.log(
      `[AKZ_DEBUG][validateAkzenteLogin] attempt email=${loginDto.email}`,
    );
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      this.logger.warn(
        `[AKZ_DEBUG][validateAkzenteLogin] user not found email=${loginDto.email}`,
      );
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'notFound',
        },
      });
    }

    // Check if user type is akzente
    const userTypeId = this.resolveUserTypeId(user.type);
    if (userTypeId !== UserTypeEnum.akzente) {
      this.logger.warn(
        `[AKZ_DEBUG][validateAkzenteLogin] user type mismatch userId=${user.id} type=${String(
          userTypeId,
        )}`,
      );
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          userType: 'unauthorizedUserType',
        },
      });
    }

    return this.performLogin(user, loginDto.password);
  }

  async validateClientLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'notFound',
        },
      });
    }

    // Check if user type is client
    const userTypeId = this.resolveUserTypeId(user.type);
    if (userTypeId !== UserTypeEnum.client) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          userType: 'unauthorizedUserType',
        },
      });
    }

    return this.performLogin(user, loginDto.password);
  }

  async validateMerchandiserLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'notFound',
        },
      });
    }

    const userTypeId = this.resolveUserTypeId(user.type);
    if (userTypeId !== UserTypeEnum.merchandiser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          userType: 'unauthorizedUserType',
        },
      });
    }

    return this.performLogin(user, loginDto.password);
  }

  private async performLogin(user: User, password: string): Promise<LoginResponseDto> {
    this.logger.log(
      `[AKZ_DEBUG][performLogin] start userId=${user.id} provider=${String(user.provider)} status=${String(
        user.status?.id,
      )} role=${String(user.role?.id)}`,
    );
    if (user.provider !== AuthProvidersEnum.email) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: `needLoginViaProvider:${user.provider}`,
        },
      });
    }

    if (user.status?.id?.toString() === StatusEnum.inactive.toString()) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          status: 'unconfirmedProfile',
        },
      });
    }

    if (!user.password) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: 'incorrectPassword',
        },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      this.logger.warn(
        `[AKZ_DEBUG][performLogin] invalid password userId=${user.id}`,
      );
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: 'incorrectPassword',
        },
      });
    }

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = await this.sessionService.create({
      user,
      hash,
    });
    this.logger.log(
      `[AKZ_DEBUG][performLogin] session created userId=${user.id} sessionId=${session.id} createdAt=${String(
        session.createdAt,
      )}`,
    );

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: user.role,
      sessionId: session.id,
      hash,
      sessionActivityAt:
        session.lastActivityAt ?? session.updatedAt ?? session.createdAt,
    });
    this.logger.log(
      `[AKZ_DEBUG][performLogin] tokens generated userId=${user.id} tokenExpires=${tokenExpires}`,
    );

    return {
      refreshToken,
      token,
      tokenExpires,
      user,
    };
  }

  /**
   * Generate a new password for an existing user and email it.
   * Only Akzente staff may trigger this action.
   */
  async sendGeneratedPasswordToUser(
    targetUserId: User['id'],
    requestingUserId: User['id'],
  ): Promise<void> {
    const requester = await this.usersService.findById(requestingUserId);
    if (!requester || requester.type?.id !== UserTypeEnum.akzente) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'unauthorizedUserType',
        },
      });
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    await this.usersService.update(targetUserId, {
      sendGeneratedPasswordInEmail: true,
    });
  }

  /**
   * Generate a random password of specified length (max 10 characters)
   * @param length - Length of password (default: 10, max: 10)
   * @returns Random password string
   */
  private generateRandomPassword(length: number = 10): string {
    // Ensure length doesn't exceed 10
    const passwordLength = Math.min(length, 10);
    
    // Character sets for password generation
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const allChars = lowercase + uppercase + numbers;
    
    let password = '';
    
    // Ensure at least one character from each set for better security
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < passwordLength; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password to randomize character positions
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Determine user type based on user ID
   * This method checks which entity (akzente, client, merchandiser) the user belongs to
   */
  private async determineUserType(userId: number): Promise<'akzente' | 'client' | 'merchandiser'> {
    try {
      // Make all calls in parallel for better performance
      const [akzenteEntity, clientEntity, merchandiserEntity] = await Promise.all([
        this.akzenteService.findByUserId(userId).catch(() => null),
        this.clientService.findByUserId(userId).catch(() => null),
        this.merchandiserService.findByUserIdNumber(userId).catch(() => null),
      ]);

      // Determine user type based on which entity exists
      if (akzenteEntity) {
        return 'akzente';
      } else if (clientEntity) {
        return 'client';
      } else if (merchandiserEntity) {
        return 'merchandiser';
      }

      // Default to akzente if no specific type found
      return 'akzente';
    } catch (error) {
      console.error('Error determining user type:', error);
      // Default to akzente if there's an error
      return 'akzente';
    }
  }

  private getRemainingSessionMs(
    sessionActivityAt:
      | Session['lastActivityAt']
      | Session['updatedAt']
      | Session['createdAt'],
  ): number {
    return this.sessionExpiryService.getRemainingMs(sessionActivityAt);
  }

  private getCappedExpiry(
    configuredExpiresIn: ms.StringValue,
    remainingSessionMs: number,
  ): ms.StringValue {
    const configuredExpiresInMs = ms(configuredExpiresIn);
    const effectiveExpiresInMs = Math.max(
      1,
      Math.min(configuredExpiresInMs, remainingSessionMs),
    );
    return `${effectiveExpiresInMs}ms` as ms.StringValue;
  }
}
