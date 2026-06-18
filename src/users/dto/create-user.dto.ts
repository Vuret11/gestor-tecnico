import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '../../common/enums/rol.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan García' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'juan@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: Rol, default: Rol.TECNICO })
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;
}
