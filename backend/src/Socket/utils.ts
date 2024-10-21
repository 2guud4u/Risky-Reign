import { Server, Socket } from 'socket.io';
export default function sendError(scope: string, message: string, io: Server, socket: Socket): void {
    if (scope === 'global') {
        io.emit('error', message);
    } 

    if (scope === 'local') {
        socket.emit('error', message);
    }
}