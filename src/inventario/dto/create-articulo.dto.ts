import { IsOptional, IsString, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateArticuloDto {
  @IsOptional() @IsString()
  referencia?: string;

  @IsString()
  nombre: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsOptional() @IsString()
  unidad?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  stockActual?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  stockMinimo?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  precioUnitario?: number;

  @IsOptional() @IsString()
  categoria?: string;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}
