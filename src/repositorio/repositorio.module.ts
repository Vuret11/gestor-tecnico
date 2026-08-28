import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepoCarpeta } from './entities/repo-carpeta.entity';
import { RepoArchivo } from './entities/repo-archivo.entity';
import { RepositorioService } from './repositorio.service';
import { RepositorioController } from './repositorio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RepoCarpeta, RepoArchivo])],
  controllers: [RepositorioController],
  providers: [RepositorioService],
})
export class RepositorioModule {}
