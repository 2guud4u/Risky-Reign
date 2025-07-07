import { Server } from 'socket.io';
import {generateBoardAndSave} from '../../../archive/Controller/Game';
import {rollDice} from '../utils/utils';
import {handleDiceRollPhase} from '../../../archive/Controller/Phases/DiceRoll';
import { isBuildType } from '../types/Pieces';
import { handleBuild } from '../../../archive/Controller/Phases/Build';

export default (io: Server) => {
    io.on('connection', (socket) => {
        socket.on("rollDice", (payload) => {
            const { roomId } = payload;
            const roll1 = rollDice();
            const roll2 = rollDice();
            handleDiceRollPhase(roomId, (roll1 + roll2).toString());
            console.log("Dice rolled");
        });
       
        socket.on('startGame', (payload) => {
            console.log('Game started');
            io.to(payload.room).emit('gameStarted');
        });

        socket.on("generateBoard", (payload) => {
            const { radius, roomId } = payload;
            console.log("Generating board");
            generateBoardAndSave(roomId, radius).then((board) => {
            if(board){
                io.to(roomId).emit('generateBoardResult', board);

            }
            console.log(board);
        });
        
        socket.on("build", (payload) => {
            const {roomId, player, location, type} = payload;
            console.log("Building");
            if(isBuildType(type)){
                handleBuild(player, roomId, location, type);
            }
            
        });

        });
    });
  };


function updateGameState(){
    return;
}