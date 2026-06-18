import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInformeDto {
  @ApiProperty()
  @IsUUID()
  visita_id: string;

  @ApiProperty()
  @IsNotEmpty() @IsString()
  descripcion: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  trabajosRealizados?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  materialesUsados?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  tiempoEmpleado?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  firmaClienteUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  nombreFirmante?: string;
}
