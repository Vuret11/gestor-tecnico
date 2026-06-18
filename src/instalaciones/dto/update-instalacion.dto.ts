import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateInstalacionDto } from './create-instalacion.dto';

export class UpdateInstalacionDto extends PartialType(CreateInstalacionDto) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}
