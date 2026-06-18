import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidenciasService } from './incidencias.service';
import { IncidenciasController } from './incidencias.controller';
import { Incidencia } from './entities/incidencia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incidencia])],
  controllers: [IncidenciasController],
  providers: [IncidenciasService],
  exports: [IncidenciasService],
})
export class IncidenciasModule {}
