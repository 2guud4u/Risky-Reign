import React from 'react';
import logo from './logo.svg';
import './App.css';
import Board from './containers/CatanBoard';
import Game from './containers/Game';
import {SocketProvider} from './contexts/SocketContext';
import { GameRoomProvider } from './contexts/GameContext';
import GameLogic from './components/GameLogic';
function App() {
    return (
        <GameRoomProvider>
            <SocketProvider>
                <GameLogic/>
            </SocketProvider>
        </GameRoomProvider>
);
}

export default App;
