import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { EstadoHomologacion } from '../entities/homologacion.entity';
import type { InformesHomologacion, ArchivoObra } from '../entities/homologacion.entity';

export class CreateHomologacionDto {
  @IsOptional() @IsString() num_obra?: string;
  /** Obra del registro de Ingeniería a la que pertenece el trámite. */
  @IsOptional() @IsString() proyecto_id?: string;
  @IsOptional() @IsString() proyecto_nombre?: string;
  @IsOptional() @IsString() cliente?: string;
  @IsOptional() @IsString() partner?: string;
  @IsOptional() @IsString() nif?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() cp?: string;
  @IsOptional() @IsString() municipio?: string;
  @IsOptional() @IsString() provincia?: string;

  /** Instalaciones de la obra: una o varias de clima / fontaneria / pci / teleco / electricidad. */
  @IsOptional() @IsArray() @IsString({ each: true }) instalaciones?: string[];

  @IsOptional() @IsEnum(EstadoHomologacion) estado?: EstadoHomologacion;
  @IsOptional() @IsString() creado_por?: string;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsString() fecha_inicio?: string;
  @IsOptional() @IsString() fecha_fin?: string;

  @IsOptional() @IsArray() archivos?: ArchivoObra[];
  @IsOptional() @IsObject() informes?: InformesHomologacion;

  @IsOptional() @IsInt() n_incumplimientos?: number;
  @IsOptional() @IsInt() n_dudas?: number;
  @IsOptional() @IsInt() n_observaciones?: number;
  @IsOptional() @IsNumber() impacto_favor?: number;
  @IsOptional() @IsNumber() impacto_contra?: number;
  @IsOptional() @IsInt() n_no_asociados?: number;

  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsBoolean() parado?: boolean;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateHomologacionDto extends PartialType(CreateHomologacionDto) {}
