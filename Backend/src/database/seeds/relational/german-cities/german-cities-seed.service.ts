import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { CitiesEntity } from '../../../../cities/infrastructure/persistence/relational/entities/cities.entity';
import { CountriesEntity } from '../../../../countries/infrastructure/persistence/relational/entities/countries.entity';

interface GermanCitySeedEntry {
  name: string;
  coords?: {
    lat?: string;
    lon?: string;
  };
}

@Injectable()
export class GermanCitiesSeedService {
  private readonly logger = new Logger(GermanCitiesSeedService.name);

  constructor(
    @InjectRepository(CountriesEntity)
    private readonly countriesRepository: Repository<CountriesEntity>,
    @InjectRepository(CitiesEntity)
    private readonly citiesRepository: Repository<CitiesEntity>,
  ) {}

  async run() {
    const germany = await this.findGermanyCountry();
    if (!germany) {
      this.logger.warn(
        'Germany (Deutschland) not found in countries table. Skipping German cities seed.',
      );
      return;
    }

    const citiesData = this.loadGermanCitiesData();
    const existingNames = await this.getExistingCityNames(germany.id);
    const citiesToInsert = citiesData.filter(
      (city) => !existingNames.has(city.name.trim().toLowerCase()),
    );

    if (citiesToInsert.length === 0) {
      this.logger.log(
        `German cities already seeded for country id=${germany.id} (${existingNames.size} cities present).`,
      );
      return;
    }

    const batchSize = 250;
    let inserted = 0;

    for (let index = 0; index < citiesToInsert.length; index += batchSize) {
      const batch = citiesToInsert.slice(index, index + batchSize);
      const entities = batch.map((city) =>
        this.citiesRepository.create({
          name: city.name.trim(),
          coordinates: this.resolveCoordinates(city),
          country: germany,
        }),
      );

      await this.citiesRepository.save(entities);
      inserted += entities.length;
      this.logger.log(`Inserted ${inserted}/${citiesToInsert.length} German cities...`);
    }

    this.logger.log(
      `German cities seed complete: ${inserted} inserted, ${existingNames.size} already existed.`,
    );
  }

  private loadGermanCitiesData(): GermanCitySeedEntry[] {
    const filePath = join(__dirname, 'germany.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as GermanCitySeedEntry[];
  }

  private async findGermanyCountry(): Promise<CountriesEntity | null> {
    return this.countriesRepository
      .createQueryBuilder('country')
      .where(
        `LOWER(country.name->>'de') IN ('deutschland', 'germany')
         OR LOWER(country.name->>'en') IN ('deutschland', 'germany')
         OR LOWER(country.name->>'fr') IN ('deutschland', 'germany', 'allemagne')`,
      )
      .getOne();
  }

  private async getExistingCityNames(countryId: number): Promise<Set<string>> {
    const existingCities = await this.citiesRepository.find({
      where: { country: { id: countryId } },
      select: ['name'],
    });

    return new Set(
      existingCities.map((city) => city.name.trim().toLowerCase()),
    );
  }

  private resolveCoordinates(city: GermanCitySeedEntry): [number, number] {
    const lat = Number.parseFloat(city.coords?.lat ?? '');
    const lon = Number.parseFloat(city.coords?.lon ?? '');

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }

    return [0, 0];
  }
}
