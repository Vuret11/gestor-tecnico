import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateVisitaDto } from './create-visita.dto';

export class UpdateVisitaDto extends PartialType(CreateVisitaDto) {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
