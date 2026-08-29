import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioArticulo } from './entities/inventario-articulo.entity';
import { InventarioStock } from './entities/inventario-stock.entity';
import { Almacen } from './entities/almacen.entity';
import { VisitaArticulo } from './entities/visita-articulo.entity';
import { Visita } from '../visitas/entities/visita.entity';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventarioArticulo, InventarioStock, Almacen, VisitaArticulo, Visita])],
  controllers: [InventarioController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
