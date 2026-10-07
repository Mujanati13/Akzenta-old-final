import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateAdvancedPhotoDto } from './dto/create-advanced-photo.dto';
import { UpdateAdvancedPhotoDto } from './dto/update-advanced-photo.dto';
import { AdvancedPhotoRepository } from './infrastructure/persistence/advanced-photo.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AdvancedPhoto } from './domain/advanced-photo';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/domain/project';

@Injectable()
export class AdvancedPhotoService {
  constructor(
    private readonly advancedPhotoRepository: AdvancedPhotoRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
  ) {}

  async create(
    createAdvancedPhotoDto: CreateAdvancedPhotoDto,
  ): Promise<AdvancedPhoto> {
    const project = await this.projectService.findById(
      createAdvancedPhotoDto.project.id,
    );
    if (!project) {
      throw new Error('Project not found');
    }

    return this.advancedPhotoRepository.create({
      project,
      isVisibleInReport: createAdvancedPhotoDto.isVisibleInReport,
      isBeforeAfter: createAdvancedPhotoDto.isBeforeAfter,
      labels: createAdvancedPhotoDto.labels,
      beforeImageCount: createAdvancedPhotoDto.beforeImageCount,
      afterImageCount: createAdvancedPhotoDto.afterImageCount,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.advancedPhotoRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: AdvancedPhoto['id']) {
    return this.advancedPhotoRepository.findById(id);
  }

  findByProjectId(projectId: number) {
    return this.advancedPhotoRepository.findByProjectId(projectId);
  }

  findByIds(ids: AdvancedPhoto['id'][]) {
    return this.advancedPhotoRepository.findByIds(ids);
  }

  async update(
    id: AdvancedPhoto['id'],
    updateAdvancedPhotoDto: UpdateAdvancedPhotoDto,
  ) {
    let project: Project | undefined = undefined;

    if (updateAdvancedPhotoDto.project) {
      const foundReport = await this.projectService.findById(
        updateAdvancedPhotoDto.project.id,
      );
      if (!foundReport) {
        throw new Error('Project not found');
      }
      project = foundReport;
    }

    return this.advancedPhotoRepository.update(id, {
      project,
      isBeforeAfter: updateAdvancedPhotoDto.isBeforeAfter,
      isVisibleInReport: updateAdvancedPhotoDto.isVisibleInReport,
      labels: updateAdvancedPhotoDto.labels,
      beforeImageCount: updateAdvancedPhotoDto.beforeImageCount,
      afterImageCount: updateAdvancedPhotoDto.afterImageCount,
    });
  }

  remove(id: AdvancedPhoto['id']) {
    return this.advancedPhotoRepository.remove(id);
  }
}
