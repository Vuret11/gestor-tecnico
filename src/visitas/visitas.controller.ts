import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { VisitasService } from './visitas.service';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('visitas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('visitas')
export class VisitasController {
  constructor(private readonly service: VisitasService) {}

  @ApiOperation({ summary: 'Programar visita' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post()
  create(@Body() dto: CreateVisitaDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Listar todas las visitas' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Visitas del día de hoy' })
  @Get('hoy')
  findHoy() {
    return this.service.findHoy();
  }

  @ApiOperation({ summary: 'Visitas de una semana' })
  @Get('semana')
  findSemana(@Query('desde') desde: string, @Query('hasta') hasta: string) {
    return this.service.findSemana(new Date(desde), new Date(hasta));
  }

  @ApiOperation({ summary: 'Mis visitas (técnico autenticado)' })
  @Roles(Rol.TECNICO)
  @Get('mis-visitas')
  misVisitas(@CurrentUser() user: any) {
    return this.service.findByTecnico(user.id);
  }

  @ApiOperation({ summary: 'Obtener visita por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Actualizar visita' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVisitaDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Check-in: iniciar visita' })
  @Patch(':id/checkin')
  checkin(@Param('id') id: string) {
    return this.service.checkin(id);
  }

  @ApiOperation({ summary: 'Check-out: finalizar visita' })
  @Patch(':id/checkout')
  checkout(@Param('id') id: string) {
    return this.service.checkout(id);
  }

  @ApiOperation({ summary: 'Cancelar visita' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
