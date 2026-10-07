import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateUploadedAdvancedPhotoDto } from './dto/create-uploaded-advanced-photo.dto';
import { UpdateUploadedAdvancedPhotoDto } from './dto/update-uploaded-advanced-photo.dto';
import { UploadedAdvancedPhotoRepository } from './infrastructure/persistence/uploaded-advanced-photo.repository';
import { UploadedAdvancedPhoto } from './domain/uploaded-advanced-photo';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AdvancedPhotoService } from '../advanced-photo/advanced-photo.service';
import { FilesService } from '../files/files.service';
import { AdvancedPhoto } from '../advanced-photo/domain/advanced-photo';
import { FileType } from '../files/domain/file';
import { FilesLocalService } from '../files/infrastructure/uploader/local/files.service';
import { ReportService } from '../report/report.service';

@Injectable()
export class UploadedAdvancedPhotosService {
  constructor(
    private readonly uploadedAdvancedPhotoRepository: UploadedAdvancedPhotoRepository,
    private readonly advancedPhotoService: AdvancedPhotoService,
    private readonly filesService: FilesService,
    private readonly filesLocalService: FilesLocalService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {}

  /**
   * Optimized create method that accepts pre-fetched report data to avoid heavy database calls
   */
  async createOptimized(
    createUploadedAdvancedPhotoDto: CreateUploadedAdvancedPhotoDto,
    existingReport?: any,
  ): Promise<UploadedAdvancedPhoto> {
    const advancedPhoto = await this.advancedPhotoService.findById(
      createUploadedAdvancedPhotoDto.advancedPhoto.id,
    );
    if (!advancedPhoto) {
      throw new Error('Advanced Photo not found');
    }

    const file = await this.filesService.findById(
      createUploadedAdvancedPhotoDto.file.id,
    );
    if (!file) {
      throw new Error('File not found');
    }
    
    // Use existing report data if provided, otherwise fetch it
    let report;
    if (existingReport) {
      report = existingReport;
    } else {
      report = await this.reportService.findById(createUploadedAdvancedPhotoDto.report.id);
      if (!report) {
        throw new Error('Report not found');
      }
    }

    return this.uploadedAdvancedPhotoRepository.create({
      advancedPhoto,
      file,
      report,
      label: createUploadedAdvancedPhotoDto.label,
      beforeAfterType: createUploadedAdvancedPhotoDto.beforeAfterType,
      order: createUploadedAdvancedPhotoDto.order ?? 0,
    });
  }

  async create(
    createUploadedAdvancedPhotoDto: CreateUploadedAdvancedPhotoDto,
  ): Promise<UploadedAdvancedPhoto> {
    const advancedPhoto = await this.advancedPhotoService.findById(
      createUploadedAdvancedPhotoDto.advancedPhoto.id,
    );
    if (!advancedPhoto) {
      throw new Error('Advanced Photo not found');
    }

    const file = await this.filesService.findById(
      createUploadedAdvancedPhotoDto.file.id,
    );
    if (!file) {
      throw new Error('File not found');
    }
    const report = await this.reportService.findById(createUploadedAdvancedPhotoDto.report.id);
    if (!report) {
      throw new Error('Report not found');
    }

    return this.uploadedAdvancedPhotoRepository.create({
      advancedPhoto,
      file,
      report,
      label: createUploadedAdvancedPhotoDto.label,
      beforeAfterType: createUploadedAdvancedPhotoDto.beforeAfterType,
      order: createUploadedAdvancedPhotoDto.order ?? 0,
    });
  }

  // async uploadFile(
  //   file: Express.Multer.File,
  //   advancedPhotoId: number,
  // ): Promise<UploadedAdvancedPhoto> {
  //   // Use the existing Files service to handle file upload
  //   const uploadedFileResponse = await this.filesLocalService.create(file);

  //   const advancedPhoto =
  //     await this.advancedPhotoService.findById(advancedPhotoId);
  //   if (!advancedPhoto) {
  //     throw new Error('Advanced Photo not found');
  //   }

  //   return this.uploadedAdvancedPhotoRepository.create({
  //     advancedPhoto,
  //     file: uploadedFileResponse.file, // Extract the file from the response object
  //   });
  // }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.uploadedAdvancedPhotoRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: UploadedAdvancedPhoto['id']) {
    return this.uploadedAdvancedPhotoRepository.findById(id);
  }

  findByFileId(fileId: string) {
    return this.uploadedAdvancedPhotoRepository.findByFileId(fileId);
  }

  findByIds(ids: UploadedAdvancedPhoto['id'][]) {
    return this.uploadedAdvancedPhotoRepository.findByIds(ids);
  }

  async update(
    id: UploadedAdvancedPhoto['id'],
    updateUploadedAdvancedPhotoDto: UpdateUploadedAdvancedPhotoDto,
  ) {
    let advancedPhoto: AdvancedPhoto | undefined = undefined;
    let file: FileType | undefined = undefined;

    if (updateUploadedAdvancedPhotoDto.advancedPhoto) {
      const foundAdvancedPhoto = await this.advancedPhotoService.findById(
        updateUploadedAdvancedPhotoDto.advancedPhoto.id,
      );
      if (!foundAdvancedPhoto) {
        throw new Error('Advanced Photo not found');
      }
      advancedPhoto = foundAdvancedPhoto;
    }

    if (updateUploadedAdvancedPhotoDto.file) {
      const foundFile = await this.filesService.findById(
        updateUploadedAdvancedPhotoDto.file.id,
      );
      if (!foundFile) {
        throw new Error('File not found');
      }
      file = foundFile;
    }

    const updatePayload: Partial<UploadedAdvancedPhoto> = {};

    // Only update label if it's explicitly provided (including null/empty string)
    if (updateUploadedAdvancedPhotoDto.label !== undefined) {
      updatePayload.label = updateUploadedAdvancedPhotoDto.label;
    }

    // Only update beforeAfterType if it's explicitly provided
    if (updateUploadedAdvancedPhotoDto.beforeAfterType !== undefined) {
      updatePayload.beforeAfterType = updateUploadedAdvancedPhotoDto.beforeAfterType;
    }

    if (typeof updateUploadedAdvancedPhotoDto.order === 'number') {
      updatePayload.order = updateUploadedAdvancedPhotoDto.order;
    }

    if (advancedPhoto) {
      updatePayload.advancedPhoto = advancedPhoto;
    }

    if (file) {
      updatePayload.file = file;
    }

    return this.uploadedAdvancedPhotoRepository.update(id, updatePayload);
  }

  remove(id: UploadedAdvancedPhoto['id']) {
    return this.uploadedAdvancedPhotoRepository.remove(id);
  }
}
