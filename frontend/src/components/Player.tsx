import React from "react"
import { Resource } from "../utils/hexUtils";
import { PlayerObj } from "../utils/playerUtils";
interface PlayerProps extends PlayerObj {
   
}

export const Player: React.FC<PlayerProps> = ({ id, name, color, resources }) => {
    return (
        <div>
            <h1>Player {id}</h1>
            <h2>{name}</h2>
            <h3>{color}</h3>
            <ul>
                {Array.from(resources.entries()).map(([resource, amount]) => (
                    <li key={resource}>{resource}: {amount}</li>
                ))}
            </ul>
        </div>
    );

}