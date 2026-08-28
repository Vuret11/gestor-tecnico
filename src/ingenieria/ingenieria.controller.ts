import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngenieriaService } from './ingenieria.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';

@ApiTags('ingenieria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ingenieria')
export class IngenieriaController {
  constructor(private readonly service: IngenieriaService) {}

  @ApiOperation({ summary: 'Listar proyectos de ingeniería' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get()
  findAll(@Query('todos') todos?: string) {
    return this.service.findAll(todos === 'true');
  }

  @ApiOperation({ summary: 'Obtener proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Crear proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post()
  create(@Body() dto: CreateProyectoDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Actualizar proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProyectoDto>) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Archivar proyecto' })
  @Roles(Rol.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
