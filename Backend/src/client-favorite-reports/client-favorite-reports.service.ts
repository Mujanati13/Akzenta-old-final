import {
  // common
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateClientFavoriteReportDto } from './dto/create-client-favorite-report.dto';
import { UpdateClientFavoriteReportDto } from './dto/update-client-favorite-report.dto';
import { ClientFavoriteReportRepository } from './infrastructure/persistence/client-favorite-report.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ClientFavoriteReport } from './domain/client-favorite-report';
import { ClientService } from '../client/client.service';
import { ReportService } from '../report/report.service';

@Injectable()
export class ClientFavoriteReportsService {
  constructor(
    // Dependencies here
    private readonly clientFavoriteReportRepository: ClientFavoriteReportRepository,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {}

  async create(
    createClientFavoriteReportDto: CreateClientFavoriteReportDto,
  ) {
    // Find Client by user ID instead of Client ID
    const client = await this.clientService.findByUserId(
      createClientFavoriteReportDto.client.id,
    );
    if (!client) {
      throw new Error('Client not found');
    }

    const report = await this.reportService.findById(
      createClientFavoriteReportDto.report.id,
    );
    if (!report) {
      throw new Error('Report not found');
    }

    return this.clientFavoriteReportRepository.create({
      client,
      report,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.clientFavoriteReportRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: ClientFavoriteReport['id']) {
    return this.clientFavoriteReportRepository.findById(id);
  }

  findByIds(ids: ClientFavoriteReport['id'][]) {
    return this.clientFavoriteReportRepository.findByIds(ids);
  }

  findOne(options: { clientId: number; reportId: number }) {
    return this.clientFavoriteReportRepository.findOne(options);
  }

  async findByClientId(clientId: number): Promise<ClientFavoriteReport[]> {
    return this.clientFavoriteReportRepository.findByClientId(clientId);
  }

  async findByClientIdAndReportIds(clientId: number, reportIds: number[]): Promise<ClientFavoriteReport[]> {
    return this.clientFavoriteReportRepository.findByClientIdAndReportIds(clientId, reportIds);
  }

  async update(
    id: ClientFavoriteReport['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateClientFavoriteReportDto: UpdateClientFavoriteReportDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.clientFavoriteReportRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: ClientFavoriteReport['id']) {
    return this.clientFavoriteReportRepository.remove(id);
  }
}
