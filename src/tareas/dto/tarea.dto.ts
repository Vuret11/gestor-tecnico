import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { EstadoTarea } from '../entities/tarea.entity';

export class CreateTareaDto {
  @IsNotEmpty() @IsString() titulo: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsEnum(EstadoTarea) estado?: EstadoTarea;
  @IsOptional() @IsString() disciplina?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) responsables?: string[];
  @IsOptional() @IsDateString() fecha_limite?: string;
  /** El día en que hay que empezar la tarea («Inicio» en el panel). Vacío = sin planificar. */
  @IsOptional() @IsDateString() fecha_inicio?: string;
  @IsOptional() @IsUUID() proyecto_id?: string;
  @IsOptional() @IsUUID() operario_id?: string;
}

export class UpdateTareaDto extends PartialType(CreateTareaDto) {}
