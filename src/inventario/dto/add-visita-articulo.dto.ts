import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddVisitaArticuloDto {
  @IsUUID()
  articulo_id: string;

  @Type(() => Number) @IsNumber() @Min(0.001)
  cantidad: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  precioUnitario?: number;

  @IsOptional() @IsString()
  notas?: string;
}
