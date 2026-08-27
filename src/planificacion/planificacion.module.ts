import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanificacionController } from './planificacion.controller';
import { PlanificacionService } from './planificacion.service';
import { PlanProvincia } from './entities/plan-provincia.entity';
import { PlanTecnico } from './entities/plan-tecnico.entity';
import { PlanCliente } from './entities/plan-cliente.entity';
import { PlanObra } from './entities/plan-obra.entity';
import { PlanAsignacion } from './entities/plan-asignacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlanProvincia, PlanTecnico, PlanCliente, PlanObra, PlanAsignacion])],
  controllers: [PlanificacionController],
  providers: [PlanificacionService],
  exports: [PlanificacionService],
})
export class PlanificacionModule {}
