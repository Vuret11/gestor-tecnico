import { IsOptional, IsString } from 'class-validator';

export class CreateCarpetaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
