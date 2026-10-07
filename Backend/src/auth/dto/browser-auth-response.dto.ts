import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/domain/user';

export class BrowserLoginResponseDto {
  @ApiProperty({
    type: () => User,
  })
  user: User;

  @ApiPropertyOptional()
  tokenExpires?: number;
}

export class BrowserRefreshResponseDto {
  @ApiPropertyOptional()
  tokenExpires?: number;
}
