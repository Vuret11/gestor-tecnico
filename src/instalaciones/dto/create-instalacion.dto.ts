import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInstalacionDto {
  @ApiProperty({ example: 'Centro Comercial Meridiano' })
  @IsNotEmpty() @IsString()
  nombre: string;

  @ApiProperty({ example: 'Meridiano S.L.' })
  @IsNotEmpty() @IsString()
  cliente: string;

  @ApiProperty({ example: 'Calle Mayor 1' })
  @IsNotEmpty() @IsString()
  direccion: string;

  @ApiProperty({ example: 'Sevilla' })
  @IsNotEmpty() @IsString()
  ciudad: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  provincia?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cp?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  telefono?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  latitud?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  longitud?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notas?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  clienteId?: string;
}
