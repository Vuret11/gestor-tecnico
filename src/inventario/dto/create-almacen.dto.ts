import { IsString } from 'class-validator';

export class CreateAlmacenDto {
  @IsString()
  nombre: string;
}
