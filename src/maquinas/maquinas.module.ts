import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Maquina } from './entities/maquina.entity';
import { MaquinasService } from './maquinas.service';
import { BuscarFichaService } from './buscar-ficha.service';
import { MaquinasController } from './maquinas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Maquina])],
  providers: [MaquinasService, BuscarFichaService],
  controllers: [MaquinasController],
})
export class MaquinasModule {}
