import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { TipoProyecto, EstadoProyecto } from '../entities/proyecto-ingenieria.entity';

export class CreateProyectoDto {
  @IsNotEmpty() @IsString() nombre: string;
  @IsNotEmpty() @IsString() cliente: string;
  @IsOptional() @IsEnum(TipoProyecto) tipo?: TipoProyecto;
  @IsOptional() @IsEnum(EstadoProyecto) estado?: EstadoProyecto;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsNumber() potencia_kwp?: number;
  @IsOptional() @IsNumber() presupuesto?: number;
  @IsOptional() @IsDateString() fechaEntregaEstimada?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() num_obra?: string;
  @IsOptional() @IsString() estado_obra?: string;
  @IsOptional() @IsNumber() progreso?: number;
  @IsOptional() @IsString() jefe_obra?: string;
  @IsOptional() @IsString() jefe_obra_contacto?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsUUID() tecnico_id?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) disciplinas?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) responsables?: string[];
  // Importes y márgenes de la obra
  @IsOptional() @IsNumber() margen_previsto?: number;
  @IsOptional() @IsNumber() margen_real?: number;
  @IsOptional() @IsNumber() importe_facturado?: number;
  @IsOptional() @IsString() retencion_estado?: string;
  @IsOptional() @IsDateString() retencion_fecha?: string;
  @IsOptional() @IsNumber() retencion_importe?: number;
  @IsOptional() @IsUUID() cliente_id?: string;
}
