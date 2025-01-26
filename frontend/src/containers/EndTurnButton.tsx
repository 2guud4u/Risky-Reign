import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { TurnState } from '../utils/turnUtils';
interface EndTurnButtonProps {
    // TODO
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
    turnObj: TurnState;
    player: string;

}


const EndTurnButton: React.FC<EndTurnButtonProps> = ({UiEventCaller, turnObj, player}) => {
    
    return (
        <>
            {turnObj.player === player && (
                <button onClick={() => UiEventCaller('endTurn', {})}>
                    End Turn
                </button>
            )}
        </>
        
    );
}

export default EndTurnButton;