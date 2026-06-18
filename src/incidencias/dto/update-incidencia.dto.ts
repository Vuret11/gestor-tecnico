import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateIncidenciaDto } from './create-incidencia.dto';
import { EstadoIncidencia } from '../../common/enums/prioridad.enum';

export class UpdateIncidenciaDto extends PartialType(CreateIncidenciaDto) {
  @IsOptional() @IsEnum(EstadoIncidencia)
  estado?: EstadoIncidencia;

  @IsOptional() @IsString()
  resolucion?: string;
}
