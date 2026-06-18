import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoVisita } from '../../common/enums/estado-visita.enum';
import { TipoVisita } from '../../common/enums/tipo-visita.enum';

export class CreateVisitaDto {
  @ApiProperty()
  @IsUUID()
  instalacion_id: string;

  @ApiProperty()
  @IsUUID()
  tecnico_id: string;

  @ApiProperty({ example: '2026-06-20T09:00:00.000Z' })
  @IsDateString()
  fechaProgramada: string;

  @ApiPropertyOptional({ enum: TipoVisita, default: TipoVisita.VISITA_TECNICA_FV })
  @IsOptional()
  @IsEnum(TipoVisita)
  tipo?: TipoVisita;

  @ApiPropertyOptional({ enum: EstadoVisita })
  @IsOptional()
  @IsEnum(EstadoVisita)
  estado?: EstadoVisita;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
