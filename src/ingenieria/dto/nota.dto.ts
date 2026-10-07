import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateNotaDto {
  @IsString()
  @MinLength(1, { message: 'La nota no puede estar vacía' })
  texto: string;

  /** Nombre de quien escribe (lo manda el panel desde la sesión). */
  @IsOptional()
  @IsString()
  autor?: string;

  @IsOptional()
  @IsUUID()
  autor_id?: string;
}

export class NotaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  texto?: string;

  @IsOptional()
  @IsString()
  autor?: string;

  @IsOptional()
  @IsUUID()
  autor_id?: string;
}
