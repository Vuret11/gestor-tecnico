import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { InventarioArticulo } from './inventario-articulo.entity';
import { Almacen } from './almacen.entity';

@Entity('inventario_stocks')
@Unique(['articulo_id', 'almacen_id'])
export class InventarioStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  articulo_id: string;

  @ManyToOne(() => InventarioArticulo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'articulo_id' })
  articulo: InventarioArticulo;

  @Column()
  almacen_id: string;

  @ManyToOne(() => Almacen, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'almacen_id' })
  almacen: Almacen;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockActual: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockMinimo: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
