import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateFotoDto {
  @ApiProperty()
  @IsUUID()
  visita_id: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  url?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  thumbnail?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  latitud?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  longitud?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  descripcion?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  nombre?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tipo?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  informe_id?: string;

  @ApiPropertyOptional({ description: 'Si es false, el técnico no verá este archivo en la app (solo oficina)', default: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  visibleTecnico?: boolean;
}
