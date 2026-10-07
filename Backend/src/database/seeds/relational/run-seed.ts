import { NestFactory } from '@nestjs/core';
import { GermanCitiesSeedService } from './german-cities/german-cities-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { ReportStatusSeedService } from './report-status/report-status-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // run
  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();
  await app.get(GermanCitiesSeedService).run();
  await app.get(ReportStatusSeedService).run();

  await app.close();
};

void runSeed();
