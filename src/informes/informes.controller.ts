import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { InformesService } from './informes.service';
import { CreateInformeDto } from './dto/create-informe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('informes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('informes')
export class InformesController {
  constructor(private readonly service: InformesService) {}

  @ApiOperation({ summary: 'Crear informe de visita' })
  @Post()
  create(@Body() dto: CreateInformeDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Listar todos los informes' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Obtener informe por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Obtener informe por visita' })
  @Get('visita/:visitaId')
  findByVisita(@Param('visitaId') visitaId: string) {
    return this.service.findByVisita(visitaId);
  }

  @ApiOperation({ summary: 'Actualizar informe' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateInformeDto>) {
    return this.service.update(id, dto);
  }
}
