import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { InventarioStock } from './inventario-stock.entity';

@Entity('inventario_articulos')
export class InventarioArticulo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  referencia?: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ default: 'ud' })
  unidad: string;

  @OneToMany(() => InventarioStock, s => s.articulo)
  stocks: InventarioStock[];

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  precioUnitario?: number;

  @Column({ nullable: true })
  categoria?: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
