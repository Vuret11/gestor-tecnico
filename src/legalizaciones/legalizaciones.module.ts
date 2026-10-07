import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Legalizacion } from './entities/legalizacion.entity';
import { RegistroEtapaLegalizacion } from './entities/registro-etapa.entity';
import { LegalizacionesService } from './legalizaciones.service';
import { LegalizacionesController } from './legalizaciones.controller';
import { Maquina } from '../maquinas/entities/maquina.entity';
import { User } from '../users/entities/user.entity';
import { ConfigDocumentos } from './documentos/config-documentos.entity';
import { GeneradorDocumentosService } from './documentos/generador.service';
import { CalcularTramiteService } from './documentos/motor/calcular-tramite.service';
import { DocumentosController } from './documentos/documentos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Legalizacion, RegistroEtapaLegalizacion, Maquina, User, ConfigDocumentos]),
  ],
  controllers: [LegalizacionesController, DocumentosController],
  providers: [LegalizacionesService, GeneradorDocumentosService, CalcularTramiteService],
  exports: [LegalizacionesService, GeneradorDocumentosService],
})
export class LegalizacionesModule {}
