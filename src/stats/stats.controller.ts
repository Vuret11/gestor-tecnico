import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @ApiOperation({ summary: 'Datos agregados para el dashboard' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Get('dashboard')
  dashboard() {
    return this.service.getDashboard();
  }

  @ApiOperation({ summary: 'KPIs por técnico (visitas, horas, incidencias, instalaciones)' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Get('kpis-tecnicos')
  kpisTecnicos(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.getKpisTecnicos(
      desde ? new Date(desde) : undefined,
      hasta ? new Date(hasta) : undefined,
    );
  }
}
