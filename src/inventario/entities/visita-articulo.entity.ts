import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { InventarioArticulo } from './inventario-articulo.entity';
import { Almacen } from './almacen.entity';
import { Visita } from '../../visitas/entities/visita.entity';

@Entity('visita_articulos')
export class VisitaArticulo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  visita_id: string;

  @ManyToOne(() => Visita, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  @Column()
  articulo_id: string;

  @ManyToOne(() => InventarioArticulo, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'articulo_id' })
  articulo: InventarioArticulo;

  @Column({ nullable: true })
  almacen_id?: string;

  @ManyToOne(() => Almacen, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'almacen_id' })
  almacen?: Almacen;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  precioUnitario?: number;

  @Column({ type: 'text', nullable: true })
  notas?: string;

  @CreateDateColumn()
  createdAt: Date;
}
