import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioArticulo } from './entities/inventario-articulo.entity';
import { VisitaArticulo } from './entities/visita-articulo.entity';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventarioArticulo, VisitaArticulo])],
  controllers: [InventarioController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
