import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FotosService } from './fotos.service';
import { FotosController } from './fotos.controller';
import { Foto } from './entities/foto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Foto])],
  controllers: [FotosController],
  providers: [FotosService],
  exports: [FotosService],
})
export class FotosModule {}
