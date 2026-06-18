import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitasService } from './visitas.service';
import { VisitasController } from './visitas.controller';
import { Visita } from './entities/visita.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Visita])],
  controllers: [VisitasController],
  providers: [VisitasService],
  exports: [VisitasService],
})
export class VisitasModule {}
