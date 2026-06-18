import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty() @IsNotEmpty() @IsString() etiqueta: string;
  @ApiProperty({ enum: ['text', 'number', 'boolean', 'select', 'photo', 'textarea'] }) @IsString() tipo: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() opciones?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() unidad?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() obligatorio?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() orden?: number;
}

export class CreateSeccionDto {
  @ApiProperty() @IsNotEmpty() @IsString() titulo: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() orden?: number;
  @ApiProperty({ type: [CreateItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateItemDto)
  items: CreateItemDto[];
}

export class CreatePlantillaDto {
  @ApiProperty() @IsNotEmpty() @IsString() nombre: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiProperty({ type: [CreateSeccionDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateSeccionDto)
  secciones: CreateSeccionDto[];
}
