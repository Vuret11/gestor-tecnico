import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FotosService } from './fotos.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('fotos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fotos')
export class FotosController {
  constructor(private readonly service: FotosService) {}

  @ApiOperation({ summary: 'Registrar foto de visita' })
  @Post()
  create(@Body() dto: CreateFotoDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Fotos de una visita' })
  @Get('visita/:visitaId')
  findByVisita(@Param('visitaId') visitaId: string) {
    return this.service.findByVisita(visitaId);
  }

  @ApiOperation({ summary: 'Obtener foto por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Eliminar foto' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
