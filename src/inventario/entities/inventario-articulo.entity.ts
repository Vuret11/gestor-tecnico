import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockActual: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockMinimo: number;

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
