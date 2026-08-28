import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProyectoIngenieria } from './entities/proyecto-ingenieria.entity';
import { IngenieriaService } from './ingenieria.service';
import { IngenieriaController } from './ingenieria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProyectoIngenieria])],
  controllers: [IngenieriaController],
  providers: [IngenieriaService],
  exports: [IngenieriaService],
})
export class IngenieriaModule {}
