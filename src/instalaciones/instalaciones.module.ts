import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstalacionesService } from './instalaciones.service';
import { InstalacionesController } from './instalaciones.controller';
import { Instalacion } from './entities/instalacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Instalacion])],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
  exports: [InstalacionesService],
})
export class InstalacionesModule {}
