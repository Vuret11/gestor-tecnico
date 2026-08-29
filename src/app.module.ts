import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { InstalacionesModule } from './instalaciones/instalaciones.module';
import { VisitasModule } from './visitas/visitas.module';
import { InformesModule } from './informes/informes.module';
import { FotosModule } from './fotos/fotos.module';
import { IncidenciasModule } from './incidencias/incidencias.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ClientesModule } from './clientes/clientes.module';
import { StatsModule } from './stats/stats.module';
import { PlanificacionModule } from './planificacion/planificacion.module';
import { RepositorioModule } from './repositorio/repositorio.module';
import { RepoCarpeta } from './repositorio/entities/repo-carpeta.entity';
import { RepoArchivo } from './repositorio/entities/repo-archivo.entity';
import { InventarioModule } from './inventario/inventario.module';
import { InventarioArticulo } from './inventario/entities/inventario-articulo.entity';
import { InventarioStock } from './inventario/entities/inventario-stock.entity';
import { Almacen } from './inventario/entities/almacen.entity';
import { VisitaArticulo } from './inventario/entities/visita-articulo.entity';
import { IngenieriaModule } from './ingenieria/ingenieria.module';
import { ProyectoIngenieria } from './ingenieria/entities/proyecto-ingenieria.entity';
import { PlanProvincia } from './planificacion/entities/plan-provincia.entity';
import { PlanTecnico } from './planificacion/entities/plan-tecnico.entity';
import { PlanCliente } from './planificacion/entities/plan-cliente.entity';
import { PlanObra } from './planificacion/entities/plan-obra.entity';
import { PlanAsignacion } from './planificacion/entities/plan-asignacion.entity';
import { User } from './users/entities/user.entity';
import { Instalacion } from './instalaciones/entities/instalacion.entity';
import { Visita } from './visitas/entities/visita.entity';
import { Informe } from './informes/entities/informe.entity';
import { Foto } from './fotos/entities/foto.entity';
import { Incidencia } from './incidencias/entities/incidencia.entity';
import { Cliente } from './clientes/entities/cliente.entity';
import { ChecklistPlantilla } from './checklists/entities/checklist-plantilla.entity';
import { ChecklistSeccion } from './checklists/entities/checklist-seccion.entity';
import { ChecklistItem } from './checklists/entities/checklist-item.entity';
import { VisitaChecklist } from './checklists/entities/visita-checklist.entity';
import { VisitaRespuesta } from './checklists/entities/visita-respuesta.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 120 },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASS', 'postgres'),
        database: config.get('DB_NAME', 'gestor_tecnico'),
        entities: [User, Cliente, Instalacion, Visita, Informe, Foto, Incidencia, ChecklistPlantilla, ChecklistSeccion, ChecklistItem, VisitaChecklist, VisitaRespuesta, PlanProvincia, PlanTecnico, PlanCliente, PlanObra, PlanAsignacion, RepoCarpeta, RepoArchivo, InventarioArticulo, InventarioStock, Almacen, VisitaArticulo, ProyectoIngenieria],
        synchronize: config.get('DB_SYNC') === 'true' || config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
        ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    AuthModule,
    UsersModule,
    InstalacionesModule,
    VisitasModule,
    InformesModule,
    FotosModule,
    IncidenciasModule,
    ChecklistsModule,
    ClientesModule,
    StatsModule,
    PlanificacionModule,
    RepositorioModule,
    InventarioModule,
    IngenieriaModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
