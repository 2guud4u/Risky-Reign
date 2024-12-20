import React from 'react';
import { socket } from '../socket/socket';

export function ConnectionManager() {
  function connect() {
    socket.connect();
  }

  function disconnect() {
    socket.disconnect();
  }
  function joinRoom() {
    socket.emit('joinRoom', 'room1');
  }

  return (
    <>
      <button onClick={ connect }>Connect</button>
      <button onClick={ disconnect }>Disconnect</button>
      <button onClick={ joinRoom }>Join Room</button>
    </>
  );
}