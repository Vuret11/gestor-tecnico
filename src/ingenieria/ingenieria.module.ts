import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProyectoIngenieria } from './entities/proyecto-ingenieria.entity';
import { FaseObra } from './entities/fase-obra.entity';
import { Retencion } from './entities/retencion.entity';
import { MedicionDesviacion } from './entities/medicion-desviacion.entity';
import { DocumentoObra } from './entities/documento-obra.entity';
import { HitoObra } from './entities/hito-obra.entity';
import { NotaObra } from './entities/nota-obra.entity';
import { IngenieriaService } from './ingenieria.service';
import { IngenieriaController } from './ingenieria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    ProyectoIngenieria, FaseObra, HitoObra, Retencion, MedicionDesviacion, DocumentoObra, NotaObra,
  ])],
  controllers: [IngenieriaController],
  providers: [IngenieriaService],
  exports: [IngenieriaService],
})
export class IngenieriaModule {}
