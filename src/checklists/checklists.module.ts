import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';
import { ChecklistPlantilla } from './entities/checklist-plantilla.entity';
import { ChecklistSeccion } from './entities/checklist-seccion.entity';
import { ChecklistItem } from './entities/checklist-item.entity';
import { VisitaChecklist } from './entities/visita-checklist.entity';
import { VisitaRespuesta } from './entities/visita-respuesta.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChecklistPlantilla,
      ChecklistSeccion,
      ChecklistItem,
      VisitaChecklist,
      VisitaRespuesta,
    ]),
  ],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
