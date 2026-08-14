import { useEffect, useState } from 'react';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { TurnState } from '../common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from 'src/contexts/SocketContext';
interface EndTurnButtonProps {
}

const EndTurnButton: React.FC<EndTurnButtonProps> = () => {
    const [phaseText, setPhaseText] = useState<string>('');
    const { gameRoom, currentPlayer } = useGameRoom();
    const { socket, endTurn: onEndTurn } = useSocket();
    useEffect(() => {
        if (!gameRoom || !gameRoom.turnState) return;
        switch (gameRoom.turnState.phase) {
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
    }, [gameRoom]);
    const handleClick = () => {
        if (gameRoom && currentPlayer) {
            console.log(`Ending turn for player: ${currentPlayer.name}`);
            onEndTurn(currentPlayer.id, gameRoom.id);
        }

        
    };
    return <>{(gameRoom != null && gameRoom.turnState != null && currentPlayer != null) &&(gameRoom.turnState.player === currentPlayer.name?  <button onClick={handleClick}>{phaseText}</button> : <button disabled>Waiting on {gameRoom.turnState.player}</button>)}</>;
};

export default EndTurnButton;
