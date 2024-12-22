import React, { useState, useEffect } from 'react';
import { IntersectNode } from '../utils/intersectUtils';
import { UiEvent, UiEventPayload } from '../utils/gameUtils';

interface IntersectViewerProps {
  intersect?: IntersectNode | undefined; // Assuming `intersect` can be undefined or null
  UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
  setRoadStart: (roadStart: number) => void;

}

const IntersectViewer: React.FC<IntersectViewerProps> = ({ intersect, UiEventCaller, setRoadStart }) => {
    const handleBuildSettlement = () => {
        UiEventCaller('buildSettlement', {intersectId: intersect?.id});
    }
    const handleBuildRoad = () => {
        if (intersect === undefined) {
            return;
        }
        setRoadStart(intersect.id);
    }
    return (
    <>
        {intersect === undefined ? (
        <div>No intersection selected</div>
        ) : (
        <>
            <h1>Intersection {intersect.id}</h1>
            <button onClick={handleBuildSettlement}>Build Settlement</button>
            <button onClick={handleBuildRoad}>Build Road</button>
        </>
        
        )}
    </>
    );
};

export default IntersectViewer;
