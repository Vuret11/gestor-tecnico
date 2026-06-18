import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface VisitaNotificacion {
  visitaId: string;
  instalacionNombre: string;
  instalacionDireccion: string;
  fechaProgramada: string;
  tipo: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class NotificationsGateway {
  @WebSocketServer() server: Server;

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

  notifyUser(userId: string, event: string, payload: VisitaNotificacion) {
    const sockets = this.userSockets.get(userId);
    if (!sockets?.size) return;
    sockets.forEach(socketId => {
      this.server.to(socketId).emit(event, payload);
    });
  }
}
