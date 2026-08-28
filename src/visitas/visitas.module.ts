import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitasService } from './visitas.service';
import { VisitasController } from './visitas.controller';
import { Visita } from './entities/visita.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanTecnico } from '../planificacion/entities/plan-tecnico.entity';
import { PlanObra } from '../planificacion/entities/plan-obra.entity';
import { PlanAsignacion } from '../planificacion/entities/plan-asignacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Visita, PlanTecnico, PlanObra, PlanAsignacion]), NotificationsModule],
  controllers: [VisitasController],
  providers: [VisitasService],
  exports: [VisitasService],
})
export class VisitasModule {}
