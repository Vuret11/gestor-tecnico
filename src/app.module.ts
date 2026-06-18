import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InstalacionesModule } from './instalaciones/instalaciones.module';
import { VisitasModule } from './visitas/visitas.module';
import { InformesModule } from './informes/informes.module';
import { FotosModule } from './fotos/fotos.module';
import { IncidenciasModule } from './incidencias/incidencias.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { User } from './users/entities/user.entity';
import { Instalacion } from './instalaciones/entities/instalacion.entity';
import { Visita } from './visitas/entities/visita.entity';
import { Informe } from './informes/entities/informe.entity';
import { Foto } from './fotos/entities/foto.entity';
import { Incidencia } from './incidencias/entities/incidencia.entity';
import { ChecklistPlantilla } from './checklists/entities/checklist-plantilla.entity';
import { ChecklistSeccion } from './checklists/entities/checklist-seccion.entity';
import { ChecklistItem } from './checklists/entities/checklist-item.entity';
import { VisitaChecklist } from './checklists/entities/visita-checklist.entity';
import { VisitaRespuesta } from './checklists/entities/visita-respuesta.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        entities: [User, Instalacion, Visita, Informe, Foto, Incidencia, ChecklistPlantilla, ChecklistSeccion, ChecklistItem, VisitaChecklist, VisitaRespuesta],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
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
  ],
})
export class AppModule {}
