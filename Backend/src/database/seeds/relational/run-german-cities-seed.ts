import { NestFactory } from '@nestjs/core';
import { GermanCitiesSeedService } from './german-cities/german-cities-seed.service';
import { SeedModule } from './seed.module';

const runGermanCitiesSeed = async () => {
  const app = await NestFactory.create(SeedModule);
  await app.get(GermanCitiesSeedService).run();
  await app.close();
};

void runGermanCitiesSeed();
