import React, { useState, useEffect } from 'react';
import { IntersectNode } from '../utils/intersectUtils';
import { UiEvent, UiEventPayload, buildRoadPayload, moveSoldierPayload } from '../utils/gameUtils';
import { SoldierObj } from '../utils/soldierUtils';
import { SettlementObj } from '../utils/settlementUtils';
import Grid from '@mui/material/Grid2';

interface IntersectViewerProps {
    intersect?: IntersectNode | undefined; // Assuming `intersect` can be undefined or null
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
    //   setRoadStart: (roadStart: number) => void;
    soldierGroups: Record<string, SoldierObj[]>;
    playerName: string;
    settlements: SettlementObj[];
}

const IntersectViewer: React.FC<IntersectViewerProps> = ({ intersect, UiEventCaller, soldierGroups, playerName, settlements }) => {
    const [roadStart, setRoadStart] = useState<number>(-1);
    const [moveSoldier, setMoveSoldier] = useState<[string, number]>(['', -1]);
    const [settlement, setSettlement] = useState<SettlementObj | undefined>(undefined);
    const [action, setAction] = useState<string>('');
    const [selectedSoldiers, setSelectedSoldiers] = useState<string[]>([]);

    //new intersect selected
    useEffect(() => {
        if (intersect === undefined) {
            return;
        }
        if (roadStart !== -1) {
            UiEventCaller('buildRoad', {
                startIntersectId: roadStart,
                endIntersectId: intersect.id,
            } as buildRoadPayload);
            setRoadStart(-1);
        } else if (moveSoldier[1] !== -1) {
            UiEventCaller('moveSoldier', {
                soldierId: moveSoldier[0],
                endIntersectId: intersect.id,
                startIntersectId: moveSoldier[1],
            } as moveSoldierPayload);
            setMoveSoldier(['', -1]);
        }
        
        setSettlement(settlements.find((s) => (intersect.settlement !== null ? s.id === intersect.settlement : false)));

    }, [intersect, UiEventCaller]);

    const handleBuildSettlement = () => {
        UiEventCaller('buildSettlement', { intersectId: intersect?.id });
    };
    const handleBuildRoad = () => {
        if (intersect === undefined) {
            return;
        }
        setRoadStart(intersect.id);
    };
    const handleUpgradeSettlement = () => {
        UiEventCaller('upgradeSettlement', { intersectId: intersect?.id });
    };
    const handleBuildSoldier = () => {
        UiEventCaller('buildSoldier', { intersectId: intersect?.id });
    };
    const handleMoveSoldier = (soldierId: string) => {
        if (intersect === undefined) {
            return;
        }
        setMoveSoldier([soldierId, intersect?.id]);
    };

    const handleUnselectSoldier = (soldierId: string) => {
        setSelectedSoldiers(selectedSoldiers.filter((s) => s !== soldierId));
    };

    const handleSelectSoldier = (soldierId: string) => {
        setSelectedSoldiers([...selectedSoldiers, soldierId]);
    };

    const handleCancel = () => {
        setAction('');
        setSelectedSoldiers([]);
    }

    const handleConfirm = () => {

    }
    return (
        <>
            {intersect === undefined ? (
                <div>No intersection selected</div>
            ) : (
                <>
                <div style={{ border: '2px solid black', padding: '16px' }}>
                    <h1>Intersection {intersect.id}</h1>
                    
                    {settlement ? (<>
                        <p>Settlement: {settlement.id}</p>
                        {settlement.owner === playerName ? (<>
                            <button onClick={handleUpgradeSettlement}>Upgrade Settlement</button>
                            <button onClick={handleBuildSoldier}>Buy Soldier</button>
                            </>
                        ) : (<></>)}
                        
                    </>) : (<>
                        <p>No settlement</p>
                        <button onClick={handleBuildSettlement}>Build Settlement</button>
                        </>

                    )}
                    <button onClick={handleBuildRoad}>Build Road</button>

                    <h2>Armies</h2>
                    <Grid container>
                    
                        <Grid container size={12}>
                        <Grid size={12}><h2>Enemy</h2></Grid>
                            
                            {soldierGroups ? (<>
                                {Object.entries(soldierGroups).map(([owner, soldiers]) => (
                                    owner !== playerName ? (

                                    
                                    <Grid style={{ border: '2px solid black', padding: '16px' }} container key={owner} size={4}>
                                        <Grid size={12}>
                                            {owner}
                                        </Grid>
                                        <Grid container>
                                            {soldiers.map((soldier) => (
                                                <Grid key={soldier.id}>
                                                    {soldier.type}
                                                   
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Grid>
                                    
                                        ) : (<></>)
                                )
                                )
                                }
                            
                            
                            </>) : (<>No enemy soldiers here</>)}
                        </Grid>
                        <Grid container size={12} >
                            <Grid size={12}><h2>You</h2></Grid>
                                <Grid container spacing={1}> 
                                {soldierGroups[playerName] ? (<>
                                {soldierGroups[playerName].map((soldier) => (
                                    <Grid key={soldier.id}>
                                        {soldier.type}
                                        
                                        {action !== "" ? (<>
                                            {selectedSoldiers.includes(soldier.id) ? (
                                                <button onClick={()=>handleUnselectSoldier(soldier.id)}>Deselect</button>
                                            ) : (
                                                <button onClick={()=>handleSelectSoldier(soldier.id)}>Select</button>
                                            )}
                                        </>): (<></>)}
                                        
                                    </Grid>
                                ))}
                                </>) : (<>You have no soldiers here</>)}
                                </Grid>
                           
                        </Grid>
                    </Grid>
                    
                </div>
        
            <div style={{ border: '2px solid black', padding: '16px' }}>
                {action !== "" ? (
                    <>
                    
                    <button onClick={handleCancel}>
                        Cancel
                    </button>
                    <button onClick={handleConfirm}>
                    Confirm
                    </button>
                    </>
                ) :(
                    <>
                        <button onClick={()=>setAction("battle")}>
                            Battle
                        </button>
                        <button onClick={()=>setAction("move")}>
                            Move
                        </button>
                    </>
                    
                )}
                

                
            </div>
            </>
            )}
        </>
    );
};

export default IntersectViewer;
