import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { UserDto } from '../../users/dto/user.dto';

export class CreateAkzenteDto {
  @ApiProperty({ type: () => UserDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserDto)
  user: UserDto;
}
