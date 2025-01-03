import React from 'react';
import { BattleState, SoldierObj, SoldierBattleState } from '../utils/soldierUtils';
import { UiEvent, UiEventPayload } from '../utils/gameUtils';
import Grid from '@mui/material/Grid2';
import LineUpView from '../components/LineUpView';

interface BattleArenaProps {
    BattleState: BattleState | null;
    setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>;
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
    playerName: string;
}
const BattleArena: React.FC<BattleArenaProps> = ({ BattleState, setBattleState, UiEventCaller, playerName }) => {
    const [bottomSoldierStates, setBottomSoldierStates] = React.useState<SoldierBattleState[]>([]);
    const [topSoldierStates, setTopSoldierStates] = React.useState<SoldierBattleState[]>([]);
    const [spectating, setSpectating] = React.useState<boolean>(false);
    const [editing, setEditing] = React.useState<boolean>(false);
    const [revealed, setRevealed] = React.useState<boolean>(false);
    const [confirmed, setConfirmed] = React.useState<boolean>(false);
    const [topPlayerName, setTopPlayerName] = React.useState<string>('');
    const [bottomPlayerName, setBottomPlayerName] = React.useState<string>('');

    React.useEffect(() => {
        if (BattleState) {
            let participants = Array.from(BattleState.states.keys());
            let bottomSoldiers: SoldierBattleState[] | undefined = [];
            let topSoldiers: SoldierBattleState[] | undefined = [];
            let topPlayerName: string = '';
            let bottomPlayerName: string = '';
            if (!participants.includes(playerName)) {
                setSpectating(true);
                bottomSoldiers = BattleState.states.get(participants[0])?.soldiers;
                bottomPlayerName = participants[0];
                topSoldiers = BattleState.states.get(participants[1])?.soldiers;
                topPlayerName = participants[1];
            } else {
                setSpectating(false);
                const enemyName = participants.filter((name) => name !== playerName)[0];
                bottomSoldiers = BattleState.states.get(playerName)?.soldiers;
                topSoldiers = BattleState.states.get(enemyName)?.soldiers;
                bottomPlayerName = playerName;
                topPlayerName = enemyName;
            }
            if (topSoldiers && topSoldiers.length > 0 && bottomSoldiers && bottomSoldiers.length > 0 && !editing) {
                setBottomSoldierStates(bottomSoldiers);
                setTopSoldierStates(topSoldiers);
                setTopPlayerName(topPlayerName);
                setBottomPlayerName(bottomPlayerName);
            }
            setConfirmed(BattleState.states.get(playerName)?.submitted ?? false);
            setRevealed(Array.from(BattleState.states.values()).every((state) => state.submitted));
        }
    }, [BattleState, playerName, editing]);

    const handleConfirm = () => {
        UiEventCaller('confirmedLineUp', { playerName: playerName, lineUp: bottomSoldierStates });
        setEditing(false);
    };

    const handleReorder = (index1: number, index2: number) => {
        const newSoldierStates = [...bottomSoldierStates];
        const temp = newSoldierStates[index1];
        newSoldierStates[index1] = newSoldierStates[index2];
        newSoldierStates[index2] = temp;
        setBottomSoldierStates(newSoldierStates);
        setEditing(true);
    };

    const handleRoll = (soldierId: string) => {
        UiEventCaller('rolledSoldierScore', { soldierId: soldierId, rollNum: Math.floor(Math.random() * 6) + 1 });
    };

    return (
        <div style={{ border: '2px solid black', padding: '16px' }}>
            {BattleState && (
                <>
                    <Grid container spacing={2}>
                        <Grid container size={12}>
                            <Grid size={12}>{topPlayerName}'s Battle Line Up</Grid>
                            <Grid container size={12}>
                                <LineUpView
                                    SoldierBattleStates={topSoldierStates}
                                    editable={false}
                                    handleReorder={handleReorder}
                                    handleRoll={handleRoll}
                                    revealed={revealed}
                                />
                            </Grid>
                        </Grid>
                        <Grid container size={12}>
                            <Grid size={12}>
                                {spectating ? <>{bottomPlayerName}'s Battle Line Up</> : <>Your Battle Line Up(Drag and drop to sort order)</>}
                            </Grid>
                            <Grid container size={12}>
                                <LineUpView
                                    SoldierBattleStates={bottomSoldierStates}
                                    editable={spectating ? false : !confirmed}
                                    handleReorder={handleReorder}
                                    handleRoll={handleRoll}
                                    revealed={spectating ? revealed : true}
                                />
                            </Grid>
                            <Grid size={12}>{!confirmed && <button onClick={() => handleConfirm()}>Confirm Line Up</button>}</Grid>
                        </Grid>
                    </Grid>
                </>
            )}
        </div>
        //color border
    );
};

export default BattleArena;
