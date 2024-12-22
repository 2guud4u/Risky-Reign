import React, { useState, useEffect } from 'react';
import { IntersectNode } from '../utils/intersectUtils';
import { UiEvent, UiEventPayload } from '../utils/gameUtils';
import { SoldierObj } from '../utils/soldierUtils';

interface IntersectViewerProps {
  intersect?: IntersectNode | undefined; // Assuming `intersect` can be undefined or null
  UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
  setRoadStart: (roadStart: number) => void;
  soldierGroups: Record<string, SoldierObj[]>;

}

const IntersectViewer: React.FC<IntersectViewerProps> = ({ intersect, UiEventCaller, setRoadStart, soldierGroups }) => {
    const handleBuildSettlement = () => {
        UiEventCaller('buildSettlement', {intersectId: intersect?.id});
    }
    const handleBuildRoad = () => {
        if (intersect === undefined) {
            return;
        }
        setRoadStart(intersect.id);
    }
    const handleUpgradeSettlement = () => {
        UiEventCaller('upgradeSettlement', {intersectId: intersect?.id});
    }
    const handleBuildSoldier = () => {
        UiEventCaller('buildSoldier', {intersectId: intersect?.id});
    }
    return (
    <>
        {intersect === undefined ? (
        <div>No intersection selected</div>
        ) : (
        <>
            <h1>Intersection {intersect.id}</h1>
            <p>Settlement: {intersect.settlement}</p>
            {intersect.settlement? (<button onClick={handleUpgradeSettlement}>Upgrade Settlement</button>) : (<button onClick={handleBuildSettlement}>Build Settlement</button>)}
            
            <button onClick={handleBuildRoad}>Build Road</button>
            <button onClick={handleBuildSoldier}>Buy Soldier</button>
            <h2>Soldiers</h2>
            <ul>
                {Object.entries(soldierGroups).map(([owner, soldiers]) => (
                <li key={owner}>
                    {owner}
                    <ul>
                    {soldiers.map((soldier) => (
                        <li key={soldier.id}>{soldier.type}</li>
                    ))}
                    </ul>
                </li>
                ))}
            </ul>
        </>
        
        )}
    </>
    );
};

export default IntersectViewer;
