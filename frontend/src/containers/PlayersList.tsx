import React from 'react';
import { Player } from '../components/Player';
import { PlayerObj } from '../utils/playerUtils';
import Grid from '@mui/material/Grid2';
interface PlayerListProps {
    players: PlayerObj[];
}
const PlayersList: React.FC<PlayerListProps> = ({ players }) => {
    return (
        <Grid container direction={'row'}>
            {players.map((player, index) => (
                <Grid>
                    <Player {...player} />
                </Grid>
            ))}
        </Grid>
    );
};

export default PlayersList;
