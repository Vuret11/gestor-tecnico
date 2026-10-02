import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { EstadoLegalizacion } from '../entities/legalizacion.entity';

export class CreateLegalizacionDto {
  @IsOptional() @IsInt() id_externo?: number;
  @IsOptional() @IsString() cliente?: string;
  @IsOptional() @IsString() nif?: string;
  @IsOptional() @IsString() fecha_inicio?: string;
  @IsOptional() @IsString() fecha_fin?: string;
  @IsOptional() @IsString() creado_por?: string;
  @IsOptional() @IsString() tipo_emisor?: string;
  @IsOptional() @IsString() comunidad?: string;
  @IsOptional() @IsNumber() superficie?: number;
  @IsOptional() @IsString() tipo_edificio?: string;
  @IsOptional() @IsNumber() dormitorios?: number;
  @IsOptional() @IsString() clasificacion_emplazamiento?: string;
  @IsOptional() @IsString() clasificacion_local?: string;
  @IsOptional() @IsString() sala_maquinas?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() cp?: string;
  @IsOptional() @IsString() num_obra?: string;
  @IsOptional() @IsString() partner?: string;
  @IsOptional() @IsString() municipio?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() oca?: string;
  @IsOptional() @IsString() maquina?: string;
  @IsOptional() @IsNumber() potencia?: number;
  @IsOptional() @IsBoolean() hidraulica?: boolean;
  @IsOptional() @IsEnum(EstadoLegalizacion) estado?: EstadoLegalizacion;
  @IsOptional() @IsInt() n_listo?: number;
  @IsOptional() @IsInt() n_avisos?: number;
  @IsOptional() @IsInt() n_bloqueado?: number;
  @IsOptional() @IsInt() n_total?: number;
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsInt() dias?: number;
  @IsOptional() @IsBoolean() parado?: boolean;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsString() responsable?: string;
}

export class UpdateLegalizacionDto extends PartialType(CreateLegalizacionDto) {}
