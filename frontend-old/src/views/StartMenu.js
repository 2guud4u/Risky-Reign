import React from 'react';
import { MyForm } from '../components/MyForm';
import { joinRoom, ListenForEvent} from '../socket/events';
import { socket } from '../socket/socket';
import { useNavigate } from 'react-router-dom';

export default function StartMenu() {
    
  
    const navigate = useNavigate();

    const navigateToGameRoom = (roomId) => {
        socket.emit('joinRoom', {roomId});
        navigate(`/play/${roomId}`);
    }

    return (
        
        <div className="StartMenu">
        
        <h1>Start Menu</h1>
        <div>
        Join a room:
        </div>
        <MyForm submitAction={(room)=>{
           navigateToGameRoom(room);
        }
            } />
       
        
        </div>
    );
}