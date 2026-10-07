import { Injectable, UnprocessableEntityException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { CreateMerchandiserFilesDto } from './dto/create-merchandiser-files.dto';
import { UpdateMerchandiserFilesDto } from './dto/update-merchandiser-files.dto';
import { MerchandiserFilesRepository } from './infrastructure/persistence/merchandiser-files.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserFiles, MerchandiserFileType } from './domain/merchandiser-files';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { FilesLocalService } from '../files/infrastructure/uploader/local/files.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { FilesService } from '../files/files.service';

@Injectable()
export class MerchandiserFilesService {
  constructor(
    private readonly merchandiserFilesRepository: MerchandiserFilesRepository,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    private readonly filesLocalService: FilesLocalService,
    private readonly filesService: FilesService,
  ) {}

  async create(createMerchandiserFilesDto: CreateMerchandiserFilesDto): Promise<MerchandiserFiles> {
    if (!createMerchandiserFilesDto.merchandiser || !createMerchandiserFilesDto.merchandiser.id) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { merchandiser: 'Merchandiser information is required' },
      });
    }

    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserFilesDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { merchandiser: 'Merchandiser not found' },
      });
    }

    const file = await this.filesService.findById(
      createMerchandiserFilesDto.file.id,
    );
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'File not found' },
      });
    }

    return this.merchandiserFilesRepository.create({
      merchandiser,
      file,
      type: createMerchandiserFilesDto.type,
      name: createMerchandiserFilesDto.name,
    });
  }

  async uploadFiles(
    userJwtPayload: JwtPayloadType,
    files: {
      portrait?: Express.Multer.File[];
      full_body_shot?: Express.Multer.File[];
      resume?: Express.Multer.File[];
      additional_attachments?: Express.Multer.File[];
    },
  ): Promise<MerchandiserFiles[]> {
    try {
      const merchandiser = await this.merchandiserService.findByUserId(userJwtPayload);
      
      if (!merchandiser) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { merchandiser: 'Merchandiser profile not found' },
        });
      }

      const uploadedFiles: MerchandiserFiles[] = [];

      // Process each file type individually - only replace if new file is provided
      if (files.portrait && files.portrait.length > 0) {
        // Remove existing portrait files only
        await this.removeExistingFilesByType(merchandiser.id, MerchandiserFileType.PORTRAIT);
        
        const { file: uploadedFile } = await this.filesLocalService.create(files.portrait[0], undefined, undefined, merchandiser.id);
        const merchandiserFile = await this.merchandiserFilesRepository.create({
          merchandiser,
          file: uploadedFile,
          type: MerchandiserFileType.PORTRAIT,
        });
        uploadedFiles.push(merchandiserFile);
      }

      if (files.full_body_shot && files.full_body_shot.length > 0) {
        // Remove existing full body shot files only
        await this.removeExistingFilesByType(merchandiser.id, MerchandiserFileType.FULL_BODY_SHOT);
        
        const { file: uploadedFile } = await this.filesLocalService.create(files.full_body_shot[0], undefined, undefined, merchandiser.id);
        const merchandiserFile = await this.merchandiserFilesRepository.create({
          merchandiser,
          file: uploadedFile,
          type: MerchandiserFileType.FULL_BODY_SHOT,
        });
        uploadedFiles.push(merchandiserFile);
      }

      if (files.resume && files.resume.length > 0) {
        // Remove existing resume files only
        await this.removeExistingFilesByType(merchandiser.id, MerchandiserFileType.RESUME);
        
        const { file: uploadedFile } = await this.filesLocalService.create(files.resume[0], undefined, undefined, merchandiser.id);
        const merchandiserFile = await this.merchandiserFilesRepository.create({
          merchandiser,
          file: uploadedFile,
          type: MerchandiserFileType.RESUME,
        });
        uploadedFiles.push(merchandiserFile);
      }

      if (files.additional_attachments && files.additional_attachments.length > 0) {
        // DON'T remove existing additional attachments - just add new ones
        // This allows users to upload additional files incrementally
        
        for (const attachment of files.additional_attachments) {
          const { file: uploadedFile } = await this.filesLocalService.create(attachment, undefined, undefined, merchandiser.id);
          const merchandiserFile = await this.merchandiserFilesRepository.create({
            merchandiser,
            file: uploadedFile,
            type: MerchandiserFileType.ADDITIONAL_ATTACHMENTS,
          });
          uploadedFiles.push(merchandiserFile);
        }
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Error uploading files:', error);

      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Beim Hochladen der Datei ist ein Fehler aufgetreten.';

      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        errors: {
          message,
        },
      });
    }
  }

  async findByCurrentUser(userJwtPayload: JwtPayloadType): Promise<MerchandiserFiles[]> {
    const merchandiser = await this.merchandiserService.findByUserId(userJwtPayload);
    
    if (!merchandiser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { merchandiser: 'Merchandiser profile not found' },
      });
    }

    return this.findByMerchandiserId(merchandiser.id);
  }

  private async removeExistingFiles(merchandiserId: number): Promise<void> {
    const existingFiles = await this.findByMerchandiserId(merchandiserId);
    
    for (const existingFile of existingFiles) {
      // Remove from database
      await this.merchandiserFilesRepository.remove(existingFile.id);
      
      // Remove physical file
      try {
        await this.filesLocalService.delete(existingFile.file.id);
      } catch (error) {
        console.warn(`Failed to remove file ${existingFile.file.id}:`, error);
        // Continue with other files even if one fails
      }
    }
  }

  /**
   * Remove existing files by type only
   */
  async removeExistingFilesByType(merchandiserId: number, fileType: MerchandiserFileType): Promise<void> {
    const existingFiles = await this.findByMerchandiserIdAndType(merchandiserId, fileType);
    
    for (const existingFile of existingFiles) {
      // Remove from database
      await this.merchandiserFilesRepository.remove(existingFile.id);
      
      // Remove physical file
      try {
        await this.filesLocalService.delete(existingFile.file.id);
      } catch (error) {
        console.warn(`Failed to remove file ${existingFile.file.id}:`, error);
      }
    }
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserFilesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserFiles['id']) {
    return this.merchandiserFilesRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserFilesRepository.findByMerchandiserId(merchandiserId);
  }

  findByMerchandiserIdAndType(merchandiserId: number, type: MerchandiserFileType) {
    return this.merchandiserFilesRepository.findByMerchandiserIdAndType(merchandiserId, type);
  }

  findByMerchandiserIdsAndType(merchandiserIds: number[], type: MerchandiserFileType) {
    return this.merchandiserFilesRepository.findByMerchandiserIdsAndType(merchandiserIds, type);
  }

  findByType(type: MerchandiserFileType) {
    return this.merchandiserFilesRepository.findByType(type);
  }

  async update(id: MerchandiserFiles['id'], updateMerchandiserFilesDto: UpdateMerchandiserFilesDto) {
    let merchandiser: any = undefined;
    let file: any = undefined;

    if (updateMerchandiserFilesDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        updateMerchandiserFilesDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { merchandiser: 'Merchandiser not found' },
        });
      }
      merchandiser = foundMerchandiser;
    }

    if (updateMerchandiserFilesDto.file) {
      const foundFile = await this.filesService.findById(
        updateMerchandiserFilesDto.file.id,
      );
      if (!foundFile) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { file: 'File not found' },
        });
      }
      file = foundFile;
    }

    return this.merchandiserFilesRepository.update(id, {
      merchandiser,
      file,
      type: updateMerchandiserFilesDto.type,
      name: updateMerchandiserFilesDto.name,
    });
  }

  remove(id: MerchandiserFiles['id']) {
    return this.merchandiserFilesRepository.remove(id);
  }

  async deleteMerchandiserFile(fileId: number): Promise<{ success: boolean; message: string }> {
    try {
      const fileToDelete = await this.findById(fileId);
      
      if (!fileToDelete) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { file: 'File not found' },
        });
      }
      // Delete physical file
      try {
        await this.filesLocalService.delete(fileToDelete.file.id);
      } catch (error) {
        console.warn(`Failed to delete physical file ${fileToDelete.file.id}:`, error);
        // Continue with database deletion even if physical file deletion fails
      }

      // Delete from database
      await this.merchandiserFilesRepository.remove(fileId);

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { 
          message: error.message || 'An error occurred while deleting the file',
        },
      });
    }
  }

  async deleteCurrentUserFile(userJwtPayload: JwtPayloadType, fileId: number): Promise<{ success: boolean; message: string }> {
    try {
      const merchandiser = await this.merchandiserService.findByUserId(userJwtPayload);
      
      if (!merchandiser) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { merchandiser: 'Merchandiser profile not found' },
        });
      }

      // Find the file to ensure it belongs to the current user
      const fileToDelete = await this.findById(fileId);
      
      if (!fileToDelete) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { file: 'File not found' },
        });
      }

      // Verify that the file belongs to this merchandiser
      const userFiles = await this.findByMerchandiserId(merchandiser.id);
      const fileExists = userFiles.some(f => f.id === fileId);
      
      if (!fileExists) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { file: 'File does not belong to this user' },
        });
      }

      // Delete physical file
      try {
        await this.filesLocalService.delete(fileToDelete.file.id);
      } catch (error) {
        console.warn(`Failed to delete physical file ${fileToDelete.file.id}:`, error);
        // Continue with database deletion even if physical file deletion fails
      }

      // Delete from database
      await this.merchandiserFilesRepository.remove(fileId);

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { 
          message: error.message || 'An error occurred while deleting the file',
        },
      });
    }
  }
}