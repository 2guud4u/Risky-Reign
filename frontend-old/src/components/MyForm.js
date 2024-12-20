import React, { useState } from 'react';
import { socket } from '../socket/socket';

export function MyForm({ submitAction }) {
  const [value, setValue] = useState('');
 

  function onSubmit(event) {
    event.preventDefault();
    submitAction(value);
  }

  return (
    <form onSubmit={ onSubmit }>
      <input onChange={ e => setValue(e.target.value) } />

      <button type="submit">Submit</button>
    </form>
  );
}