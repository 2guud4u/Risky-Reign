import React from 'react';
import {Player} from '../components/Player';
import { PlayerObj } from '../utils/playerUtils';

interface PlayerListProps{
  players: PlayerObj[];
}
const PlayersList: React.FC<PlayerListProps> = ({players}) => {
  
  return (
    <div>
      {players.map((player, index) => (
          <Player key={index} {...player} />
        ))}
    </div>
  );
}

export default PlayersList;