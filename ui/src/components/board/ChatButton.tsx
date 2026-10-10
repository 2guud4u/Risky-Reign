import React, { useEffect, useRef, useState } from 'react';
import { CHAT_MESSAGE_MAX } from 'common';
import { priceLabel } from '../../utils/price';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';

/**
 * 💬 button in the top-left corner stack (between ℹ️ and 👤). Toggles the room
 * chat: a scrollable log plus an input. Unread messages since the panel was
 * last open show as a red badge. The log is part of the broadcast room state,
 * so everyone sees the same history — including late joiners and reloads.
 * Completed trades (player and bank) appear in the log as 🔄 announcements.
 */
const ChatButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { sendChat } = useSocket();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [draft, setDraft] = useState('');
  // '' = everyone; a player name = whisper (only they see it).
  const [whisperTo, setWhisperTo] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);
  const log = gameRoom?.chatLog ?? [];
  const myName = currentPlayer?.name.trim() || 'Spectator';

  // Keep the newest message in view when the log grows while open.
  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length, open]);

  // Escape closes; only while open, like the other corner popovers.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Spectators can chat too — the server derives the sender name (seat owner
  // → their name, otherwise 'Spectator'). We only need a room.
  if (!gameRoom) return null;

  const unread = open ? 0 : Math.max(0, log.length - seen);
  const toggle = () => {
    setOpen((o) => {
      if (!o) setSeen(log.length);
      return !o;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendChat(gameRoom.id, text, whisperTo || undefined);
    setDraft('');
  };

  // Whisper targets: every other seat (skip self — a whisper to yourself is
  // pointless; the server accepts only real names anyway).
  const whisperTargets = gameRoom.players
    .map((p) => p.name.trim())
    .filter((n) => n && n !== myName);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        onMouseDown={(e) => e.stopPropagation()}
        title={open ? 'Hide chat' : 'Chat'}
        aria-label={open ? 'Hide chat' : 'Show chat'}
        aria-expanded={open}
        className={`absolute top-[120px] left-2 z-20 flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-lg text-2xl leading-none cursor-pointer hover:scale-110 transition-transform ${
          open ? 'bg-blue-100 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-gray-300 hover:border-blue-500'
        }`}
      >
        <span aria-hidden="true">💬</span>
        {unread > 0 && (
          <span
            aria-label={`${unread} unread messages`}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 ring-2 ring-white text-white text-[11px] font-bold flex items-center justify-center"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Room chat"
          // Beside the button so it can overlap the player column without
          // closing it; keep clicks inside from panning the map.
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-[120px] left-[64px] z-30 w-[280px] flex flex-col rounded-lg border border-gray-300 bg-white/95 backdrop-blur-sm shadow-xl"
        >
          <div
            ref={logRef}
            className="flex-1 min-h-[120px] max-h-[320px] overflow-y-auto px-2.5 py-2 space-y-1.5"
          >
            {log.length === 0 ? (
              <p className="text-[12px] text-gray-400 italic text-center py-4">
                No messages yet. Say hi!
              </p>
            ) : (
              log.map((m, i) =>
                m.trade ? (
                  // Server-posted trade announcement: who gave what to whom.
                  <div
                    key={`${m.at}-${i}`}
                    className="text-[12px] leading-snug break-words rounded-md bg-green-50 border border-green-200 px-2 py-1 text-green-900"
                  >
                    <span aria-hidden="true">🔄 </span>
                    <strong>{m.trade.from}</strong> gave <strong>{priceLabel(m.trade.gave)}</strong> to{' '}
                    <strong>{m.trade.to ?? '🏦 the bank'}</strong> for <strong>{priceLabel(m.trade.got)}</strong>
                  </div>
                ) : (
                  <div key={`${m.at}-${i}`} className="text-[13px] leading-snug break-words">
                    {m.to && (
                      <span
                        className="mr-1 text-purple-600 font-semibold"
                        title={m.from === myName ? `Whisper to ${m.to}` : `Whisper to you`}
                      >
                        🤫{m.from === myName ? `→${m.to}` : ''}
                      </span>
                    )}
                    <span
                      className={`font-semibold ${m.from === myName ? 'text-blue-700' : 'text-gray-800'}`}
                    >
                      {m.from}:
                    </span>{' '}
                    <span className="text-gray-700">{m.text}</span>
                  </div>
                )
              )
            )}
          </div>
          {/* Recipient picker: everyone or a private whisper to one seat. */}
          {whisperTargets.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 pt-2 text-[12px] text-gray-500">
              <label htmlFor="chat-to" className="shrink-0">To:</label>
              <select
                id="chat-to"
                value={whisperTo}
                onChange={(e) => setWhisperTo(e.target.value)}
                className="flex-1 min-w-0 px-1.5 py-1 border border-gray-300 rounded-md text-[12px] bg-white"
              >
                <option value="">🌐 Everyone</option>
                {whisperTargets.map((n) => (
                  <option key={n} value={n}>
                    🤫 {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <form onSubmit={submit} className="flex gap-1.5 border-t border-gray-200 p-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MESSAGE_MAX))}
              placeholder="Message…"
              aria-label="Chat message"
              maxLength={CHAT_MESSAGE_MAX}
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-md text-[13px]"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-3 py-1.5 rounded-md text-[13px] font-semibold text-white bg-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatButton;
