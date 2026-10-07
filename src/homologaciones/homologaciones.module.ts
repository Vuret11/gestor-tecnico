import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Homologacion } from './entities/homologacion.entity';
import { ProyectoIngenieria } from '../ingenieria/entities/proyecto-ingenieria.entity';
import { HomologacionesService } from './homologaciones.service';
import { HomologacionesController } from './homologaciones.controller';
import { AnalizadorService } from './analizador.service';
import { InformePdfService } from './informe-pdf.service';
import { VerificadorService } from './verificador.service';

@Module({
  imports: [TypeOrmModule.forFeature([Homologacion, ProyectoIngenieria])],
  controllers: [HomologacionesController],
  providers: [HomologacionesService, AnalizadorService, InformePdfService, VerificadorService],
  exports: [HomologacionesService],
})
export class HomologacionesModule {}
