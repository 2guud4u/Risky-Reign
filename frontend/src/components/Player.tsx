import React from "react"
import { Resource } from "../utils/hexUtils";
import { PlayerObj } from "../utils/playerUtils";
interface PlayerProps extends PlayerObj {
   
}

export const Player: React.FC<PlayerProps> = ({ name, color, resources }) => {
    return (
        <div>
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