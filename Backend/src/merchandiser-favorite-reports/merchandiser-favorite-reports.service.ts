import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateMerchandiserFavoriteReportDto } from './dto/create-merchandiser-favorite-report.dto';
import { MerchandiserFavoriteReportRepository } from './infrastructure/persistence/merchandiser-favorite-report.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserFavoriteReports } from './domain/merchandiser-favorite-reports';
import { ReportService } from '../report/report.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';

@Injectable()
export class MerchandiserFavoriteReportsService {
  constructor(
    private readonly merchandiserFavoriteReportRepository: MerchandiserFavoriteReportRepository,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
  ) {}

  async create(createMerchandiserFavoriteReportDto: CreateMerchandiserFavoriteReportDto): Promise<MerchandiserFavoriteReports> {
    const report = await this.reportService.findById(createMerchandiserFavoriteReportDto.report.id);
    if (!report) {
      throw new Error('Report not found');
    }

    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserFavoriteReportDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    return this.merchandiserFavoriteReportRepository.create({
      report,
      merchandiser,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserFavoriteReportRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserFavoriteReports['id']) {
    return this.merchandiserFavoriteReportRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserFavoriteReportRepository.findByMerchandiserId(merchandiserId);
  }

  findOne({
    merchandiserId,
    reportId,
  }: {
    merchandiserId: number;
    reportId: number;
  }) {
    return this.merchandiserFavoriteReportRepository.findOne({ merchandiserId, reportId });
  }

  remove(id: MerchandiserFavoriteReports['id']) {
    return this.merchandiserFavoriteReportRepository.remove(id);
  }
}