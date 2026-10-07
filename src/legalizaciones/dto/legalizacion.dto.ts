import {
  IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString,
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
  /** Trozos de la dirección (los puntos 1 y 3 del MOD-315): `direccion` es solo el nombre de la vía. */
  @IsOptional() @IsString() tipo_via?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() bloque?: string;
  @IsOptional() @IsString() portal?: string;
  @IsOptional() @IsString() escalera?: string;
  @IsOptional() @IsString() piso?: string;
  @IsOptional() @IsString() puerta?: string;
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
  // --- datos de los documentos oficiales (2026-10-02) ---
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() oca_cif?: string;
  @IsOptional() @IsBoolean() es_anterior_rd?: boolean;
  /** 'AEROTERMIA' | 'GEOTERMIA' — tipo de energía (nunca las dos). */
  @IsOptional() @IsIn(['AEROTERMIA', 'GEOTERMIA']) tipo_energia?: string;
  /** 'NUEVA' | 'REFORMA' — tipo de instalación (punto 1 de la memoria del 315 y el IF-190). */
  @IsOptional() @IsIn(['NUEVA', 'REFORMA']) tipo_instalacion?: string;
  @IsOptional() @IsInt() viviendas?: number;
  /** 'CLIMATIZACION_ACS' | 'SOLO_ACS' | 'HIBRIDA_CALDERA' | 'SOLO_CLIMATIZACION' — uso declarado. */
  @IsOptional() @IsString() tipo_uso?: string;
  @IsOptional() @IsInt() maquina_id?: number;
  @IsOptional() maquinas_instalacion?: { maquina_id: number; unidades: number }[];
  @IsOptional() datos_obra?: Record<string, unknown>;
  @IsOptional() @IsNumber() qusable_anual_kwh?: number;
  @IsOptional() @IsNumber() eres_anual_kwh?: number;
  @IsOptional() @IsNumber() acs_demanda_diaria_60c?: number;
  @IsOptional() @IsNumber() acs_volumen_acumulador_l?: number;
  @IsOptional() @IsBoolean() tiene_calefaccion?: boolean;
  @IsOptional() @IsBoolean() tiene_acs?: boolean;
  @IsOptional() @IsBoolean() requiere_memoria_tecnica?: boolean;
  /** Observaciones del trámite, una por línea con su fecha delante. */
  @IsOptional() @IsString() observaciones?: string;
  /** Si el trámite está facturado (columna «Facturada» del listado, pedida por Salva el 7-oct-2026). */
  @IsOptional() @IsBoolean() facturada?: boolean;
}

export class UpdateLegalizacionDto extends PartialType(CreateLegalizacionDto) {}
