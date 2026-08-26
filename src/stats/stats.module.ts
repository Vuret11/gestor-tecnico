import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { Visita } from '../visitas/entities/visita.entity';
import { Incidencia } from '../incidencias/entities/incidencia.entity';
import { User } from '../users/entities/user.entity';
import { Instalacion } from '../instalaciones/entities/instalacion.entity';
import { Cliente } from '../clientes/entities/cliente.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Visita, Incidencia, User, Instalacion, Cliente])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
