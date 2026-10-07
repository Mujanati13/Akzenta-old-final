import {
  // common
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateAkzenteFavoriteReportDto } from './dto/create-akzente-favorite-report.dto';
import { UpdateAkzenteFavoriteReportDto } from './dto/update-akzente-favorite-report.dto';
import { AkzenteFavoriteReportRepository } from './infrastructure/persistence/akzente-favorite-report.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AkzenteFavoriteReport } from './domain/akzente-favorite-report';
import { AkzenteService } from '../akzente/akzente.service';
import { ReportService } from '../report/report.service';

@Injectable()
export class AkzenteFavoriteReportsService {
  constructor(
    // Dependencies here
    private readonly akzenteFavoriteReportRepository: AkzenteFavoriteReportRepository,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {}

  async create(
    createAkzenteFavoriteReportDto: CreateAkzenteFavoriteReportDto,
  ) {
    // Find Akzente by user ID instead of Akzente ID
    const akzente = await this.akzenteService.findByUserId(
      createAkzenteFavoriteReportDto.akzente.id,
    );
    if (!akzente) {
      throw new Error('Akzente not found');
    }

    const report = await this.reportService.findById(
      createAkzenteFavoriteReportDto.report.id,
    );
    if (!report) {
      throw new Error('Report not found');
    }

    return this.akzenteFavoriteReportRepository.create({
      akzente,
      report,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.akzenteFavoriteReportRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: AkzenteFavoriteReport['id']) {
    return this.akzenteFavoriteReportRepository.findById(id);
  }

  findByIds(ids: AkzenteFavoriteReport['id'][]) {
    return this.akzenteFavoriteReportRepository.findByIds(ids);
  }

  findOne(options: { akzenteId: number; reportId: number }) {
    return this.akzenteFavoriteReportRepository.findOne(options);
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteReport[]> {
    return this.akzenteFavoriteReportRepository.findByAkzenteId(akzenteId);
  }

  async findByAkzenteIdAndReportIds(akzenteId: number, reportIds: number[]): Promise<AkzenteFavoriteReport[]> {
    return this.akzenteFavoriteReportRepository.findByAkzenteIdAndReportIds(akzenteId, reportIds);
  }

  async update(
    id: AkzenteFavoriteReport['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateAkzenteFavoriteReportDto: UpdateAkzenteFavoriteReportDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.akzenteFavoriteReportRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: AkzenteFavoriteReport['id']) {
    return this.akzenteFavoriteReportRepository.remove(id);
  }
}
