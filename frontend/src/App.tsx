import React from 'react';
import logo from './logo.svg';
import './App.css';
import Board from './containers/CatanBoard';
import Game from './containers/Game';
import {SocketProvider} from './components/SocketProvider';
import GameLogic from './components/GameLogic';
function App() {
    return (
        <SocketProvider>
            <GameLogic/>
        </SocketProvider>
);
}

export default App;
