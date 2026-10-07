import { Injectable } from '@nestjs/common';
import { CreateReportStatusDto } from './dto/create-status.dto';
import { UpdateReportStatusDto } from './dto/update-status.dto';
import { StatusRepository } from './infrastructure/persistence/status.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ReportStatus } from './domain/status';

@Injectable()
export class StatusService {
  constructor(private readonly statusRepository: StatusRepository) {}

  async create(createStatusDto: CreateReportStatusDto): Promise<ReportStatus> {
    return this.statusRepository.create({
      name: createStatusDto.name,
      akzenteName: createStatusDto.akzenteName,
      clientName: createStatusDto.clientName,
      merchandiserName: createStatusDto.merchandiserName,
      akzenteColor: createStatusDto.akzenteColor,
      clientColor: createStatusDto.clientColor,
      merchandiserColor: createStatusDto.merchandiserColor,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.statusRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: ReportStatus['id']) {
    return this.statusRepository.findById(id);
  }

  findByIds(ids: ReportStatus['id'][]) {
    return this.statusRepository.findByIds(ids);
  }

  async update(id: ReportStatus['id'], updateStatusDto: UpdateReportStatusDto) {
    return this.statusRepository.update(id, {
      name: updateStatusDto.name,
      akzenteName: updateStatusDto.akzenteName,
      clientName: updateStatusDto.clientName,
      merchandiserName: updateStatusDto.merchandiserName,
      akzenteColor: updateStatusDto.akzenteColor,
      clientColor: updateStatusDto.clientColor,
      merchandiserColor: updateStatusDto.merchandiserColor,
    });
  }

  remove(id: ReportStatus['id']) {
    return this.statusRepository.remove(id);
  }

  // Get status name based on user type
  getStatusNameForUserType(status: ReportStatus, userType: 'akzente' | 'client' | 'merchandiser'): string {
    switch (userType) {
      case 'akzente':
        return status.akzenteName || status.name;
      case 'client':
        return status.clientName || status.name;
      case 'merchandiser':
        return status.merchandiserName || status.name;
      default:
        return status.name;
    }
  }

  // Get status color based on user type
  getStatusColorForUserType(status: any, userType: 'akzente' | 'client' | 'merchandiser'): string | null {
    switch (userType) {
      case 'akzente':
        return status?.color || status.akzenteColor || null;
      case 'client':
        return status?.color || status.clientColor || null;
      case 'merchandiser':
        return status?.color || status.merchandiserColor || null;
      default:
        return null;
    }
  }

  // Get all statuses with user-type-specific names and colors
  async findAllWithUserTypeNames(userType: 'akzente' | 'client' | 'merchandiser') {
    const result = await this.findAllWithPagination({
      paginationOptions: { page: 1, limit: 100 }
    });
    
    return {
      ...result,
      data: result.data.map(status => {
        const userSpecificName = this.getStatusNameForUserType(status, userType);
        const userSpecificColor = this.getStatusColorForUserType(status, userType);
        
        return {
          id: status.id,
          akzenteName: userType === 'akzente' ? userSpecificName : undefined,
          clientName: userType === 'client' ? userSpecificName : undefined,
          merchandiserName: userType === 'merchandiser' ? userSpecificName : undefined,
          akzenteColor: userType === 'akzente' ? userSpecificColor : undefined,
          clientColor: userType === 'client' ? userSpecificColor : undefined,
          merchandiserColor: userType === 'merchandiser' ? userSpecificColor : undefined,
        };
      })
    };
  }
}
