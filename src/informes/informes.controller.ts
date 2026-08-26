import { Controller, Get, Post, Body, Patch, Param, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  @ApiOperation({ summary: 'Exportar informes a CSV' })
  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="informes-${Date.now()}.csv"`);
    res.send(csv);
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

  @ApiOperation({ summary: 'Generar PDF del informe y guardar URL' })
  @Post(':id/pdf')
  generatePdf(@Param('id') id: string) {
    return this.service.generatePdf(id);
  }
}
