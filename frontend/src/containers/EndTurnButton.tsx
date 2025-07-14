import { useEffect, useState } from 'react';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { TurnState } from 'common';
interface EndTurnButtonProps {
    // TODO
    onEndTurn: () => void;
    turnState: TurnState;
    player: string;
}

const EndTurnButton: React.FC<EndTurnButtonProps> = ({ onEndTurn, turnState,player }) => {
    const [phaseText, setPhaseText] = useState<string>('');
    useEffect(() => {
        switch (turnState.phase) {
            case 'SetUp':
                setPhaseText('End SetUp');
                break;
            case 'Dice':
                setPhaseText('Roll Dice');
                break;
            case 'Trade':
                setPhaseText('End Trade Phase');
                break;
            case 'Build':
                setPhaseText('End Build Phase');
                break;
            case 'Action':
                setPhaseText('End Action Phase');
                break;
            default:
                break;
        }
    }, [turnState]);
    const handleClick = () => {
        if (turnState.phase === 'Dice') {
            onEndTurn();
        } else{
            onEndTurn();
        }

        
    };
    return <>{turnState.player === player?  <button onClick={handleClick}>{phaseText}</button> : <button disabled>Waiting on {turnState.player}</button>}</>;
};

export default EndTurnButton;
