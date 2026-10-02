import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Legalizacion } from './entities/legalizacion.entity';
import { LegalizacionesService } from './legalizaciones.service';
import { LegalizacionesController } from './legalizaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Legalizacion])],
  controllers: [LegalizacionesController],
  providers: [LegalizacionesService],
  exports: [LegalizacionesService],
})
export class LegalizacionesModule {}
