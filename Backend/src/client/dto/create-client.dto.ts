import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested, IsBoolean, IsOptional } from 'class-validator';
import { UserDto } from '../../users/dto/user.dto';

export class CreateClientDto {
  @ApiProperty({ type: () => UserDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserDto)
  user: UserDto;

  @ApiPropertyOptional({ 
    type: Boolean, 
    description: 'Indicates if the client user is in sales',
    default: false 
  })
  @IsOptional()
  @IsBoolean()
  isSales?: boolean;
}
