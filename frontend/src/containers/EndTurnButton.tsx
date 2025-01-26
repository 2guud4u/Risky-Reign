import { useEffect, useState } from 'react';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { TurnState } from '../utils/turnUtils';
interface EndTurnButtonProps {
    // TODO
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
    turnObj: TurnState;
    player: string;

}


const EndTurnButton: React.FC<EndTurnButtonProps> = ({UiEventCaller, turnObj, player}) => {
    const [phaseText, setPhaseText] = useState<string>('');
    useEffect(() => {
        switch (turnObj.phase) {
            case 'SetUp':
                setPhaseText('End SetUp');
                break;
            case 'Dice':
                setPhaseText('Roll Dice')
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
    }, [turnObj]);
    const handleClick = () => {
        if (turnObj.phase === 'Dice') {
            UiEventCaller('rollDice', {});
        }
        
        UiEventCaller('endTurn', {});  
    }
    return (
        <>
            {turnObj.player === player && (
                <button onClick={handleClick}>
                    {phaseText}
                </button>
            )}
        </>
        
    );
}

export default EndTurnButton;