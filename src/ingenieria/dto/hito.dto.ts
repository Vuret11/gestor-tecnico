import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Un hito de la obra. La fecha vacía se admite: queda el hito creado, sin día asignado. */
export class HitoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsDateString() fecha?: string | null;
  @IsOptional() @IsBoolean() hecho?: boolean;
}

export class CreateHitoDto {
  @IsNotEmpty() @IsString() nombre: string;
  @IsOptional() @IsDateString() fecha?: string | null;
  @IsOptional() @IsBoolean() hecho?: boolean;
}
