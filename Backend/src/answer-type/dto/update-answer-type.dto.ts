import { PartialType } from '@nestjs/swagger';
import { CreateAnswerTypeDto } from './create-answer-type.dto';

export class UpdateAnswerTypeDto extends PartialType(CreateAnswerTypeDto) {}