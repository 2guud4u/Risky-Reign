import React from 'react';
import { PlayerObj } from '../utils/playerUtils';
import Grid from '@mui/material/Grid2';
interface PlayerProps extends PlayerObj {}

export const Player: React.FC<PlayerProps> = ({ name, color, resources }) => {
    return (
        <Grid container direction={'row'}>
            <Grid>
            <h2>{name}</h2>
            <h3>{color}</h3>
            </Grid>
            
            <Grid>
            <ul>
                {Object.entries(resources).map(([resource, value]) => (
                    <li key={resource}>
                        {resource}: {value}
                    </li>
                ))}
            </ul>
            </Grid>
            
        </Grid>
    );
};
