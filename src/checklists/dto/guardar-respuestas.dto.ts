import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespuestaItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valor?: string;
}

export class GuardarRespuestasDto {
  @ApiProperty({ type: [RespuestaItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => RespuestaItemDto)
  respuestas: RespuestaItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() firmante?: string;
}
