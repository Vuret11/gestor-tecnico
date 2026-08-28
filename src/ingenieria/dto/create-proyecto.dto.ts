import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsUUID } from 'class-validator';
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
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsUUID() tecnico_id?: string;
}
