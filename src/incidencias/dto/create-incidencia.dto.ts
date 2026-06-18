import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prioridad } from '../../common/enums/prioridad.enum';

export class CreateIncidenciaDto {
  @ApiProperty()
  @IsNotEmpty() @IsString()
  titulo: string;

  @ApiProperty()
  @IsNotEmpty() @IsString()
  descripcion: string;

  @ApiProperty()
  @IsUUID()
  instalacion_id: string;

  @ApiPropertyOptional({ enum: Prioridad })
  @IsOptional() @IsEnum(Prioridad)
  prioridad?: Prioridad;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  visita_id?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  asignado_a_id?: string;
}
