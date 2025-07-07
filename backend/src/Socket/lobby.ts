import { Socket ,Server } from 'socket.io';
import { addPlayer, removePlayer, getPlayers } from '../../../archive/Controller/Game';
import { get } from 'node:http';

export default (io: Server) => {
    io.on('connection', (socket) => {
        socket.on('joinRoom', (payload) => {
            socket.join(payload.roomId);
            console.log("joined room")

        });

        socket.on('leaveRoom', (payload) => {
            socket.leave(payload.room);
            console.log(`User ${socket.id} left room ${payload.room}`);
            removePlayer(payload.room, socket.id).then((res) => {
                console.log(res);
                socket.to(payload.room).emit('message', `User ${socket.id} has left the room`);
            });
            
        });
        
        socket.on("addPlayer", (payload) => {
            addPlayer(payload.room, payload.name, "red").then((res) => {
                console.log(res, payload);
                io.to(payload.room).emit('updatePlayerList', {players: res.players});
                console.log(`User ${socket.id} joined room ${payload.room}`);
            });
            
        });
        
        
      
    });
  };

export const emitUpdatePlayerList = (io: Server ,room: string, players: any[]) => {
    io.to(room).emit('updatePlayerList', {players: players});

};