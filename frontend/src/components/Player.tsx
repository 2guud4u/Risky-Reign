import React from "react"
import { Resource } from "../utils/hexUtils";
import { PlayerObj } from "../utils/playerUtils";
interface PlayerProps extends PlayerObj {
   
}

export const Player: React.FC<PlayerProps> = ({ name, color, resources }) => {
    console.log(Object.entries(resources))
    return (
        <div>
            <h2>{name}</h2>
            <h3>{color}</h3>
            <ul>
                {Object.entries(resources).map(([resource, value]) => (
                <li key={resource}>
                {resource}: {value} 
                </li>
        ))}
            </ul>
        </div>
    );

}