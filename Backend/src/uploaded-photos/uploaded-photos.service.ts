import { Injectable } from '@nestjs/common';
import { CreateUploadedPhotoDto } from './dto/create-uploaded-photo.dto';
import { UpdateUploadedPhotoDto } from './dto/update-uploaded-photo.dto';
import { UploadedPhotoRepository } from './infrastructure/persistence/uploaded-photo.repository';
import { UploadedPhoto } from './domain/uploaded-photo';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { PhotoService } from '../photo/photo.service';
import { FilesService } from '../files/files.service';
import { Photo } from '../photo/domain/photo';
import { FileType } from '../files/domain/file';
import { FilesLocalService } from '../files/infrastructure/uploader/local/files.service';
import { ReportService } from '../report/report.service';

@Injectable()
export class UploadedPhotosService {
  constructor(
    private readonly uploadedPhotoRepository: UploadedPhotoRepository,
    private readonly photoService: PhotoService,
    private readonly filesService: FilesService,
    private readonly filesLocalService: FilesLocalService,
    private readonly reportService: ReportService,
  ) {}

  async create(
    createUploadedPhotoDto: CreateUploadedPhotoDto,
  ): Promise<UploadedPhoto> {
    const photo = await this.photoService.findById(
      createUploadedPhotoDto.photo.id,
    );
    if (!photo) {
      throw new Error('Photo not found');
    }

    const file = await this.filesService.findById(
      createUploadedPhotoDto.file.id,
    );
    if (!file) {
      throw new Error('File not found');
    }
    const report = await this.reportService.findById(createUploadedPhotoDto.report.id);
    if (!report) {
      throw new Error('Report not found');
    }

    return this.uploadedPhotoRepository.create({
      photo,
      file,
      report
    });
  }

  // async uploadFile(
  //   file: Express.Multer.File,
  //   photoId: number,
  //   typeId: number,
  // ): Promise<UploadedPhoto> {
  //   const uploadedFileResponse = await this.filesLocalService.create(file);

  //   const photo = await this.photoService.findById(photoId);
  //   if (!photo) {
  //     throw new Error('Photo not found');
  //   }
  //   const report = await this.reportService.findById(createUploadedPhotoDto.report.id);
  //   if (!report) {
  //     throw new Error('Report not found');
  //   }

  //   return this.uploadedPhotoRepository.create({
  //     photo,
  //     file: uploadedFileResponse.file,
  //     report
  //   });
  // }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.uploadedPhotoRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: UploadedPhoto['id']) {
    return this.uploadedPhotoRepository.findById(id);
  }

  findByIds(ids: UploadedPhoto['id'][]) {
    return this.uploadedPhotoRepository.findByIds(ids);
  }

  async update(
    id: UploadedPhoto['id'],
    updateUploadedPhotoDto: UpdateUploadedPhotoDto,
  ) {
    let photo: Photo | undefined = undefined;
    let file: FileType | undefined = undefined;
    let photoType: any | undefined = undefined;

    if (updateUploadedPhotoDto.photo) {
      const foundPhoto = await this.photoService.findById(
        updateUploadedPhotoDto.photo.id,
      );
      if (!foundPhoto) {
        throw new Error('Photo not found');
      }
      photo = foundPhoto;
    }

    if (updateUploadedPhotoDto.file) {
      const foundFile = await this.filesService.findById(
        updateUploadedPhotoDto.file.id,
      );
      if (!foundFile) {
        throw new Error('File not found');
      }
      file = foundFile;
    }

    return this.uploadedPhotoRepository.update(id, {
      photo,
      file,
    });
  }

  remove(id: UploadedPhoto['id']) {
    return this.uploadedPhotoRepository.remove(id);
  }
}
