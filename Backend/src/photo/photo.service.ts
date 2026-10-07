import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { PhotoRepository } from './infrastructure/persistence/photo.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Photo } from './domain/photo';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/domain/project';

@Injectable()
export class PhotoService {
  constructor(
    private readonly photoRepository: PhotoRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
  ) {}

  async create(createPhotoDto: CreatePhotoDto): Promise<Photo> {
    const project = await this.projectService.findById(createPhotoDto.project.id);
    if (!project) {
      throw new Error('Project not found');
    }

    return this.photoRepository.create({
      project,
      isBeforeAfter: createPhotoDto.isBeforeAfter,
      isVisibleInReport: createPhotoDto.isVisibleInReport,
      order: createPhotoDto.order,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.photoRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Photo['id']) {
    return this.photoRepository.findById(id);
  }

  findByIds(ids: Photo['id'][]) {
    return this.photoRepository.findByIds(ids);
  }

  async update(id: Photo['id'], updatePhotoDto: UpdatePhotoDto) {
    let project: Project | undefined = undefined;

    if (updatePhotoDto.project) {
      const foundReport = await this.projectService.findById(
        updatePhotoDto.project.id,
      );
      if (!foundReport) {
        throw new Error('Report not found');
      }
      project = foundReport;
    }

    return this.photoRepository.update(id, {
      project,
      isBeforeAfter: updatePhotoDto.isBeforeAfter,
      order: updatePhotoDto.order,
    });
  }

  remove(id: Photo['id']) {
    return this.photoRepository.remove(id);
  }
}
