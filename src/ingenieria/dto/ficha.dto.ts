import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { ESTADOS_RETENCION, PLAZOS_RETENCION } from '../entities/retencion.entity';

/** Fechas de una fase: se pueden rellenar y se pueden dejar vacías (null) para deshacer el dato. */
export class UpdateFaseDto {
  @IsOptional() @IsDateString() fecha_inicio_prevista?: string | null;
  @IsOptional() @IsDateString() fecha_fin_prevista?: string | null;
  @IsOptional() @IsDateString() fecha_inicio_real?: string | null;
  @IsOptional() @IsDateString() fecha_fin_real?: string | null;
}

export class RetencionDto {
  @IsOptional() @IsNumber() importe?: number | null;
  @IsOptional() @IsIn(PLAZOS_RETENCION as unknown as string[]) plazo?: string | null;
  @IsOptional() @IsDateString() fecha_vencimiento?: string | null;
  @IsOptional() @IsIn(ESTADOS_RETENCION as unknown as string[]) estado?: string;
  @IsOptional() @IsDateString() fecha_liberacion?: string | null;
}

export class MedicionDto {
  @IsOptional() @IsString() partida?: string;
  @IsOptional() @IsString() unidad?: string;
  @IsOptional() @IsNumber() cantidad_excel?: number | null;
  @IsOptional() @IsNumber() cantidad_plano?: number | null;
  @IsOptional() @IsNumber() diferencia_pct?: number | null;
  @IsOptional() @IsNumber() impacto_eur?: number | null;
}

/** El informe de mediciones se guarda entero de una vez: reemplaza lo que hubiera de esa obra. */
export class GuardarMedicionesDto {
  @IsNotEmpty() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicionDto)
  mediciones: MedicionDto[];
}
