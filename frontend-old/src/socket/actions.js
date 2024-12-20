
import { socket } from './socket';

export const sendRollDice = (room) => {
    console.log("client rolled")
    socket.emit('rollDice', {roomId: room});
   
}

export const sendBuild = (room, player, location, type) => {
    console.log("client build")

    socket.emit('build', {roomId: room, player: player, location: location, type: type});
}