import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileRepository } from '../../persistence/file.repository';
import { AllConfigType } from '../../../../config/config.type';
import { FileType } from '../../../domain/file';
import { promises as fs } from 'fs';
import path, { join } from 'path';
import sharp from 'sharp';

@Injectable()
export class FilesLocalService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fileRepository: FileRepository,
  ) {}

  async create(file: Express.Multer.File, reportId?: string | number, clientId?: string | number, merchandiserId?: number | string, customDir?: string): Promise<{ file: FileType }> {
    try {
      if (!file) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            file: 'selectFile',
          },
        });
      }

      // Check if the file is an image
      const isImage = file.mimetype.startsWith('image/');

      let finalFilePath = file.path;

      if (isImage) {
        // Only process images with Sharp
        const isWebP = file.mimetype === 'image/webp';

        if (!isWebP) {
          // Define a temporary path for the compressed file
          const tempFilePath = path.join(
            path.dirname(file.path),
            `temp_${file.filename.split('.')[0]}.webp`,
          );

          try {
            // Compress and save to the temporary path as WebP
            // .rotate() applies EXIF orientation so mobile photos are not saved rotated
            await sharp(file.path)
              .rotate()
              .resize(1024, 1024, {
                fit: sharp.fit.inside,
                withoutEnlargement: true,
              })
              .toFormat('webp', { quality: 50 })
              .toFile(tempFilePath);

            // Define the new WebP file path
            const newWebPFilePath = file.path.replace(/\.[^/.]+$/, '.webp');

            // Replace the original file with the compressed WebP file
            await fs.rename(tempFilePath, newWebPFilePath);
            finalFilePath = newWebPFilePath;

            // Delete the original file with retry mechanism (Windows file locking issue)
            await this.deleteFileWithRetry(file.path, 3, 500).catch((err) => {
              // Silently ignore - file deletion failure is not critical
              // The original file has already been replaced by the WebP version
            });
          } catch (sharpError) {
            console.error('Sharp processing error:', sharpError);
            // If Sharp processing fails, keep the original file
            finalFilePath = file.path;
          }
        }
      }
      // For non-image files (PDF, DOC, DOCX), keep the original file without processing

      let relativePath: string;

      let normalizedPath: string;

      if (customDir && merchandiserId) {
        const staffDir = `uploads/${customDir}/${merchandiserId}`;
        const staffDirAbsolute = path.join(process.cwd(), staffDir);
        await fs.mkdir(staffDirAbsolute, { recursive: true });

        const fileName = path.basename(finalFilePath);
        const destPath = path.join(staffDirAbsolute, fileName);
        await fs.rename(finalFilePath, destPath);

        normalizedPath = path.join(staffDir, fileName).replace(/\\/g, '/');
      } else if (clientId) {
        const logoDir = `uploads/logo-client/${clientId}`;
        const logoDirAbsolute = path.join(process.cwd(), logoDir);
        await fs.mkdir(logoDirAbsolute, { recursive: true });

        const fileName = path.basename(finalFilePath);
        const destPath = path.join(logoDirAbsolute, fileName);
        await fs.rename(finalFilePath, destPath);

        normalizedPath = path.join(logoDir, fileName).replace(/\\/g, '/');
      } else if (reportId) {
        const reportDir = `uploads/report/${reportId}`;
        const reportDirAbsolute = path.join(process.cwd(), reportDir);
        await fs.mkdir(reportDirAbsolute, { recursive: true });

        const fileName = path.basename(finalFilePath);
        const destPath = path.join(reportDirAbsolute, fileName);
        await fs.rename(finalFilePath, destPath);

        normalizedPath = path.join(reportDir, fileName).replace(/\\/g, '/');
      } else if (merchandiserId) {
        const profileDir = `uploads/merchandiser-profile/${merchandiserId}`;
        const profileDirAbsolute = path.join(process.cwd(), profileDir);
        await fs.mkdir(profileDirAbsolute, { recursive: true });

        const fileName = path.basename(finalFilePath);
        const destPath = path.join(profileDirAbsolute, fileName);
        await fs.rename(finalFilePath, destPath);

        normalizedPath = path.join(profileDir, fileName).replace(/\\/g, '/');
      } else {
        const uploadsBasePath = path.join(process.cwd(), 'uploads');
        normalizedPath = path.relative(uploadsBasePath, finalFilePath);
        normalizedPath = path.join('uploads', normalizedPath).replace(/\\/g, '/');
      }

      // Introduce a small delay to ensure the file is no longer in use
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      // Save the file path in the database
      return {
        file: await this.fileRepository.create({
          path: `/${this.configService.get('app.apiPrefix', {
            infer: true,
          })}/v1/${normalizedPath}`,
        }),
      };
    } catch (error) {
      console.error('File upload error:', error);
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : '';
      const isImageTooLarge =
        errorMessage.includes('pixel limit') ||
        errorMessage.includes('memory') ||
        errorMessage.includes('too large');
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: isImageTooLarge
          ? 'Das Bild ist zu groß oder hat zu viele Pixel. Bitte verwenden Sie ein kleineres Bild (max. 30 MB).'
          : errorMessage.includes('sharp')
            ? 'Die Bildverarbeitung ist fehlgeschlagen. Bitte versuchen Sie ein anderes Bild.'
            : 'Der Datei-Upload ist fehlgeschlagen.',
        errors: {
          file: isImageTooLarge
            ? 'imageTooLarge'
            : errorMessage.includes('sharp')
              ? 'imageProcessingFailed'
              : 'uploadFailed',
        },
      });
    }
  }

  async delete(fileId: string): Promise<void> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'fileNotFound',
        },
      });
    }

    // Extract the relative file path from the stored file path
    const relativeFilePath = file.path.split('/v1/')[1];

    try {
      // Delete the file from the file system
      await fs.unlink(relativeFilePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            file: 'deletionFailed',
          },
        });
      }
    }

    // Delete the file record from the repository (even if physical file was already gone)
    await this.fileRepository.delete(fileId);
  }

  async deleteByPath(filePath: string): Promise<void> {
    try {
      const relativeFilePath = filePath.split('/v1/')[1];

      await this.deleteFileWithRetry(relativeFilePath, 3, 500);

      await this.fileRepository.deleteByPath(filePath);
    } catch (error) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'deletionFailed',
        },
      });
    }
  }

  /**
   * Delete a file with retry mechanism to handle Windows file locking issues
   * @param filePath - Path to the file to delete
   * @param maxRetries - Maximum number of retry attempts
   * @param retryDelay - Delay in milliseconds between retries
   */
  private async deleteFileWithRetry(
    filePath: string,
    maxRetries: number = 3,
    retryDelay: number = 500,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait a bit before attempting deletion (helps with Windows file locking)
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        }

        await fs.unlink(filePath);
        return; // Success, exit the function
      } catch (error: any) {
        lastError = error;
        
        // If it's not a permission error or file not found, throw immediately
        if (error.code !== 'EPERM' && error.code !== 'EBUSY' && error.code !== 'ENOENT') {
          throw error;
        }

        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    // If we get here, all retries failed
    if (lastError) {
      throw lastError;
    }
  }
}
