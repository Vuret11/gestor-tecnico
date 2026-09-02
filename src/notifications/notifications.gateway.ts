import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

const PUSH_TITULOS: Record<string, string> = {
  'nueva-visita': 'Nueva visita asignada',
  'visita-cancelada': 'Visita cancelada',
  'visita-actualizada': 'Visita actualizada',
  'incidencia-asignada': 'Incidencia asignada',
  'incidencia-desasignada': 'Incidencia desasignada',
};

export interface VisitaNotificacion {
  visitaId: string;
  instalacionNombre: string;
  instalacionDireccion: string;
  fechaProgramada: string;
  tipo: string;
}

export interface IncidenciaNotificacion {
  incidenciaId: string;
  titulo: string;
  prioridad: string;
  instalacionNombre: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class NotificationsGateway {
  @WebSocketServer() server: Server;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  private userSockets = new Map<string, Set<string>>();

  @SubscribeMessage('register')
  handleRegister(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    if (!userId) return;
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId)!.add(client.id);
    client.on('disconnect', () => {
      this.userSockets.get(userId)?.delete(client.id);
    });
  }

  notifyUser(userId: string, event: string, payload: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets?.size) {
      sockets.forEach(socketId => {
        this.server.to(socketId).emit(event, payload);
      });
    }
    // Push a la app móvil (independiente de si hay un socket conectado):
    // no bloqueamos ni propagamos errores, es un aviso best-effort.
    this.sendPush(userId, event, payload).catch(err =>
      console.error('Error enviando push notification:', err),
    );
  }

  private async sendPush(userId: string, event: string, payload: any): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user?.expoPushToken) return;

    const titulo = PUSH_TITULOS[event] ?? 'HomeServe Solar';
    const cuerpo = payload?.titulo ?? payload?.instalacionNombre ?? '';

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: user.expoPushToken,
        title: titulo,
        body: cuerpo,
        data: { event, ...payload },
      }),
    });
  }
}
