import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

const EndTurnButton: React.FC = () => {
  const [phaseText, setPhaseText] = useState<string>('');
  const { gameRoom, currentPlayer } = useGameRoom();
  const { endTurn: onEndTurn, rollDice: onRollDice } = useSocket();

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
        setPhaseText('End Turn');
    }
  }, [gameRoom]);

  const handleClick = () => {
    if (!gameRoom || !currentPlayer) return;
    // In the Dice phase the meaningful action is rolling; roll then advance
    // to the Trade phase in one click.
    if (gameRoom.turnState.phase === 'Dice') {
      onRollDice(gameRoom.id);
      onEndTurn(currentPlayer.id, gameRoom.id);
    } else {
      onEndTurn(currentPlayer.id, gameRoom.id);
    }
  };

  const isMyTurn = !!(gameRoom && currentPlayer && gameRoom.turnState.player === currentPlayer.name);

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ccc',
    background: isMyTurn ? '#2563eb' : '#e5e7eb',
    color: isMyTurn ? '#fff' : '#6b7280',
    cursor: isMyTurn ? 'pointer' : 'not-allowed',
  };

  return (
    <>
      {gameRoom && gameRoom.turnState && currentPlayer ? (
        isMyTurn ? (
          <button onClick={handleClick} style={buttonStyle}>
            {phaseText}
          </button>
        ) : (
          <button disabled style={buttonStyle}>
            Waiting on {gameRoom.turnState.player}
          </button>
        )
      ) : null}
    </>
  );
};

export default EndTurnButton;
