import React from 'react';
import { BattleState, SoldierObj, SoldierBattleState } from '../utils/soldierUtils';
import { UiEvent, UiEventPayload } from '../utils/gameUtils';
import Grid from '@mui/material/Grid2';

interface BattleArenaProps {
    BattleState: BattleState | null;
    setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>;
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
    playerName: string;
}
const BattleArena: React.FC<BattleArenaProps> = ({ BattleState, setBattleState, UiEventCaller, playerName }) => {
    const [yourSoldierStates, setYourSoldierStates] = React.useState<SoldierBattleState[]>([]);
    const [spectating, setSpectating] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (BattleState) {
            const soldiers = BattleState.states.get(playerName)?.soldiers;
            if (soldiers && soldiers.length > 0) {
                setYourSoldierStates(soldiers);
            }
            if (!Object.keys(BattleState.states).includes(playerName)) {
                setSpectating(true);
            }
        }
    }, [BattleState, playerName]);

    const handleSubmit = () => {};

    const handleRoll = (soldierId: string) => {
        UiEventCaller('rolledSoldierScore', { soldierId: soldierId, rollNum: Math.floor(Math.random() * 6) + 1 });
    };

    return (
        <div style={{ border: '2px solid black', padding: '16px' }}>
            {BattleState && (
                //view if in battle

                <>
                    {yourSoldierStates.length > 0 ? (
                        <CombatView yourSoldierStates={yourSoldierStates} enemySoldierStates={[]} enemyName={'enemy'} handleRoll={handleRoll} />
                    ) : (
                        <SpectatorView BattleState={BattleState} />
                    )}
                </>
            )}
        </div>
        //color border
    );
};

interface CombatViewProps {
    yourSoldierStates: SoldierBattleState[];
    enemySoldierStates: SoldierBattleState[];
    enemyName: string;
    handleRoll: (soldierId: string) => void;
}
const CombatView: React.FC<CombatViewProps> = ({ yourSoldierStates, enemySoldierStates, enemyName, handleRoll }) => {
    
    return (
        <Grid container spacing={2}>
            <Grid container size={12}>
                <Grid size={12}>{enemyName}'s Battle Line Up</Grid>
            </Grid>
            <Grid container size={12}>
                <Grid size={12}>Your Battle Line Up(Drag and drop to sort order)</Grid>
                <Grid container size={12}>
                    {yourSoldierStates.map((soldierState, index) => (
                        <Grid key={index}>
                            <div
                                style={{ border: '2px solid black', padding: '16px' }}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('text/plain', 'settlement')}
                            >
                                {soldierState.rollNum === 0 ? (
                                    <button
                                        onClick={() => {
                                            handleRoll(soldierState.soldier.id);
                                        }}
                                    >
                                        Roll
                                    </button>
                                ) : (
                                    <>{soldierState.rollNum}</>
                                )}
                            </div>
                        </Grid>
                    ))}
                </Grid>
            </Grid>
        </Grid>
    );
};
interface SpectatorViewProps {
    BattleState: BattleState | null;
}
const SpectatorView: React.FC<SpectatorViewProps> = () => {
    return <div>Spectating</div>;
};

export default BattleArena;
