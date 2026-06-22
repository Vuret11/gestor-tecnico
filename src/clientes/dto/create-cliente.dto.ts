import { IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({ example: 'Meridiano S.L.' })
  @IsNotEmpty() @IsString()
  nombre: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  nif?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  telefono?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  direccion?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notas?: string;
}
