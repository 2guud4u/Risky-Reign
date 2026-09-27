import React, { useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { EditorHistorySnapshot, SavePanelProps } from './types';
import { inputClass } from './constants';
import { cloneMap, randomRoomId, toHexLayouts } from './utils';

/**
 * Save & Start panel: for a new room it collects a player name and room id and
 * joins with the custom board; for an existing room it just saves (editBoard).
 * Every save also pushes a snapshot onto a history list that restores the
 * draft when clicked.
 */
const SavePanel: React.FC<SavePanelProps> = ({ roomId, map, validation, missingNumbers, onRestore }) => {
  const [playerName, setPlayerName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [history, setHistory] = useState<EditorHistorySnapshot[]>([]);
  const historyIdRef = useRef(0);
  const { joinRoom, editBoard } = useSocket();

  // Editing an existing room needs a valid layout + no missing numbers; creating
  // a new room also needs a name + room id.
  const canSave =
    validation.allowed && missingNumbers === 0 && (roomId ? true : playerName.trim() !== '' && newRoomId.trim() !== '');

  const handleSave = () => {
    if (!canSave) return;
    // Snapshot the current board into the history stack so the player can
    // click a previous save to go back to it.
    historyIdRef.current += 1;
    const snapshot = {
      id: historyIdRef.current,
      label: `Save #${historyIdRef.current}`,
      time: new Date().toLocaleTimeString(),
      map: cloneMap(map),
    };
    setHistory((h) => [...h, snapshot]);
    const layouts = toHexLayouts(map);
    if (roomId) {
      editBoard(roomId, layouts);
    } else {
      joinRoom(playerName.trim(), newRoomId.trim(), undefined, layouts);
    }
  };

  return (
    <div className="p-3 border border-gray-300 rounded-lg bg-white">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{roomId ? 'Save Board' : 'Save & Start'}</h3>
      <div className="flex flex-col gap-2">
        {!roomId && (
          <>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
            <div className="flex gap-2">
              <input
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                placeholder="Room ID"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={() => setNewRoomId(randomRoomId())}
                title="Generate random room ID"
                className="px-3 border border-gray-300 rounded-md bg-gray-100 cursor-pointer"
              >
                🎲
              </button>
            </div>
          </>
        )}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`py-2 px-4 border-0 rounded-md text-sm font-semibold text-white cursor-pointer ${
            canSave ? 'bg-blue-600' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {roomId ? 'Save Board' : 'Save & Start Game'}
        </button>
        {!validation.allowed && (
          <p className="text-xs text-red-600">{validation.reason}</p>
        )}
        {validation.allowed && missingNumbers > 0 && (
          <p className="text-xs text-red-600">
            {missingNumbers} hex{missingNumbers > 1 ? 'es' : ''} missing a number (Desert/Water are exempt)
          </p>
        )}
        {history.length > 0 && (
          <div className="mt-2">
            <h4 className="text-xs font-semibold text-gray-600 mb-1">History (click to go back)</h4>
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {[...history].reverse().map((snap) => (
                <button
                  key={snap.id}
                  onClick={() => onRestore(snap.map)}
                  className="flex items-center justify-between px-2 py-1 border border-gray-200 rounded-md text-xs cursor-pointer hover:bg-blue-50"
                >
                  <span className="font-semibold text-gray-700">{snap.label}</span>
                  <span className="text-gray-400">{snap.time}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavePanel;
