import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AnonymousStrategy } from './strategies/anonymous.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { SessionExpiryService } from './session-expiry.service';
import { MailModule } from '../mail/mail.module';
import { SessionModule } from '../session/session.module';
import { UsersModule } from '../users/users.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { JobTypesModule } from '../job-types/job-types.module';
import { CountriesModule } from '../countries/countries.module';
import { CitiesModule } from '../cities/cities.module';
import { ClientModule } from '../client/client.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { ClientCompanyAssignedClientModule } from '../client-company-assigned-client/client-company-assigned-client.module';
import { AkzenteModule } from '../akzente/akzente.module'; // Add this
import { AkzenteFavoriteClientCompaniesModule } from '../akzente-favorite-client-companies/akzente-favorite-client-companies.module'; // Add this
import { ClientCompanyAssignedAkzenteModule } from '../client-company-assigned-akzente/client-company-assigned-akzente.module';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    PassportModule,
    MailModule,
    CitiesModule,
    MerchandiserModule,
    JobTypesModule,
    CountriesModule,
    ClientModule,
    ClientCompanyModule,
    ClientCompanyAssignedClientModule,
    AkzenteModule, // Add this
    AkzenteFavoriteClientCompaniesModule, // Add this
    forwardRef(() => ClientCompanyAssignedAkzenteModule),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    AnonymousStrategy,
    SessionExpiryService,
  ],
  exports: [AuthService, SessionExpiryService],
})
export class AuthModule {}
