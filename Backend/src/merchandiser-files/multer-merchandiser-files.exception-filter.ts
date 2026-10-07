import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { MERCHANDISER_PROFILE_MAX_FILE_SIZE_MESSAGE } from './merchandiser-files-upload.constants';

@Catch(MulterError)
export class MulterMerchandiserFilesExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: MERCHANDISER_PROFILE_MAX_FILE_SIZE_MESSAGE,
      });
      return;
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message || 'Invalid file upload.',
    });
  }
}
