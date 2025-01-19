import React from 'react';
import { BattleState, SoldierObj, SoldierBattleState } from '../utils/soldierUtils';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import Grid from '@mui/material/Grid2';

interface LineUpViewProps {
    SoldierBattleStates: SoldierBattleState[];
    editable: boolean;
    revealed: boolean;
    handleReorder: (index1: number, index2: number) => void;
    handleRoll: (soldierId: string) => void;
}
const LineUpView: React.FC<LineUpViewProps> = ({ SoldierBattleStates, editable, handleReorder, handleRoll, revealed }) => {
    const [canReorder, setCanReorder] = React.useState<boolean>(false);

    React.useEffect(() => {
        setCanReorder(SoldierBattleStates.every((soldierState) => soldierState.rollNum !== 0));
    }, [SoldierBattleStates, editable, revealed]);

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        let index = parseInt(e.dataTransfer.getData('index'));
        if (canReorder) handleReorder(index, targetIndex);
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    return (
        <>
            {SoldierBattleStates.map((soldierState, index) => (
                <Grid key={index}>
                    <div
                        style={{ border: '2px solid black', padding: '16px', backgroundColor: soldierState.dead ? 'red' : 'white' }}
                        draggable={editable ? true : false}
                        onDragStart={(e) => e.dataTransfer.setData('index', index.toString())}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragOver={handleDragOver}
                    >
                        {revealed ? (
                            soldierState.rollNum === 0 ? (
                                <button
                                    onClick={() => {
                                        handleRoll(soldierState.soldier.id);
                                    }}
                                >
                                    Roll
                                </button>
                            ) : (
                                <>{soldierState.rollNum}</>
                            )
                        ) : (
                            <>?</>
                        )}
                    </div>
                </Grid>
            ))}
        </>
    );
};

export default LineUpView;
