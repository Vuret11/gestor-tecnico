import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Rol } from './common/enums/rol.enum';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const admin = await usersService.create({
    nombre: 'Administrador',
    email: 'admin@empresa.com',
    password: 'Admin1234!',
    rol: Rol.ADMIN,
    telefono: '600000001',
  }).catch(() => console.log('Admin ya existe'));

  await usersService.create({
    nombre: 'Oficina Central',
    email: 'oficina@empresa.com',
    password: 'Oficina1234!',
    rol: Rol.OFICINA,
    telefono: '600000002',
  }).catch(() => console.log('Oficina ya existe'));

  await usersService.create({
    nombre: 'Técnico García',
    email: 'tecnico1@empresa.com',
    password: 'Tecnico1234!',
    rol: Rol.TECNICO,
    telefono: '600000010',
  }).catch(() => console.log('Técnico 1 ya existe'));

  await usersService.create({
    nombre: 'Técnico Martínez',
    email: 'tecnico2@empresa.com',
    password: 'Tecnico1234!',
    rol: Rol.TECNICO,
    telefono: '600000011',
  }).catch(() => console.log('Técnico 2 ya existe'));

  console.log('Seed completado. Usuarios de prueba:');
  console.log('  admin@empresa.com      / Admin1234!   (admin)');
  console.log('  oficina@empresa.com    / Oficina1234! (oficina)');
  console.log('  tecnico1@empresa.com   / Tecnico1234! (técnico)');
  console.log('  tecnico2@empresa.com   / Tecnico1234! (técnico)');

  await app.close();
}
seed();
