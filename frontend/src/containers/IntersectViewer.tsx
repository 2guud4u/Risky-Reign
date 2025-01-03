import React, { useState, useEffect } from 'react';
import { IntersectNode } from '../utils/intersectUtils';
import { UiEvent, UiEventPayload, buildRoadPayload, moveSoldierPayload } from '../utils/gameUtils';
import { SoldierObj } from '../utils/soldierUtils';
import { SettlementObj } from '../utils/settlementUtils';
import Grid from '@mui/material/Grid2';
import { groupBy } from '../utils/helperUtils';

interface IntersectViewerProps {
    intersect?: IntersectNode | undefined; // Assuming `intersect` can be undefined or null
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
    playerName: string;
    settlements: SettlementObj[];
    soldiersMap: Map<number, SoldierObj[]>;
}

const IntersectViewer: React.FC<IntersectViewerProps> = ({ intersect, soldiersMap, UiEventCaller, playerName, settlements }) => {
    const [settlement, setSettlement] = useState<SettlementObj | undefined>(undefined);
    const [action, setAction] = useState<string>('');
    const [selectedSoldiers, setSelectedSoldiers] = useState<string[]>([]);
    const [selectedEnemy, setSelectedEnemy] = useState<string>('');
    const [viewIntersect, setViewIntersect] = useState<IntersectNode | undefined>(undefined);
    const [soldierGroups, setSoldierGroups] = useState<Record<string, SoldierObj[]>>({});
    //new intersect selected
    useEffect(() => {
        if (intersect === undefined) {
            return;
        }
        if (action === '') {
            setViewIntersect(intersect);
        }
    }, [intersect, action]);

    useEffect(() => {
        if (viewIntersect === undefined) {
            return;
        }
        setSoldierGroups(groupBy(soldiersMap.get(viewIntersect.id) || [], 'owner'));
        setSettlement(settlements.find((s) => (viewIntersect.settlement !== null ? s.id === viewIntersect.settlement : false)));
    }, [viewIntersect, soldiersMap, settlements]);

    const handleBuildSettlement = () => {
        UiEventCaller('buildSettlement', { intersectId: intersect?.id });
    };
    const handleBuildRoad = () => {
        if (intersect === undefined) {
            return;
        }
        setAction('buildRoad');
    };
    const handleUpgradeSettlement = () => {
        UiEventCaller('upgradeSettlement', { intersectId: intersect?.id });
    };
    const handleBuildSoldier = () => {
        UiEventCaller('buildSoldier', { intersectId: intersect?.id });
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
        setSelectedEnemy('');
    };

    const handleConfirm = () => {
        switch (action) {
            case 'battle':
                if (selectedSoldiers.length === 0) {
                    console.log('no soldiers selected');
                    return;
                }
                if (selectedEnemy === '') {
                    console.log('no enemy selected');
                    return;
                }
                UiEventCaller('initiateBattle', {
                    intersectId: intersect?.id,
                    friendlyIds: selectedSoldiers,
                    enemyIds: soldierGroups[selectedEnemy].map((s) => s.id),
                    enemyName: selectedEnemy,
                });
                break;
            case 'move':
                if (selectedSoldiers.length === 0) {
                    console.log('no soldiers selected');
                    return;
                }
                if (intersect === undefined || viewIntersect === undefined) {
                    return;
                }
                UiEventCaller('moveSoldier', {
                    soldierIds: selectedSoldiers,
                    endIntersectId: intersect.id,
                    startIntersectId: viewIntersect.id,
                } as moveSoldierPayload);

                break;
            case 'buildRoad':
                if (intersect === undefined || viewIntersect === undefined) {
                    return;
                }
                UiEventCaller('buildRoad', {
                    startIntersectId: viewIntersect.id,
                    endIntersectId: intersect.id,
                } as buildRoadPayload);

                break;
            default:
                break;
        }
        setAction('');
        setSelectedSoldiers([]);
        setSelectedEnemy('');
    };
    const handleSelectAll = () => {
        setSelectedSoldiers(soldierGroups[playerName].map((s) => s.id));
    };
    const handleOnClickEnemy = (owner: string) => {
        if (selectedEnemy !== owner) {
            setSelectedEnemy(owner);
        } else {
            setSelectedEnemy('');
        }
    };
    return (
        <>
            {viewIntersect === undefined ? (
                <div>No intersection selected</div>
            ) : (
                <>
                    <div style={{ border: '2px solid black', padding: '16px' }}>
                        <h1>Intersection {viewIntersect.id}</h1>

                        {settlement ? (
                            <>
                                <p>Settlement: {settlement.id}</p>
                                {settlement.owner === playerName ? (
                                    <>
                                        <button onClick={handleUpgradeSettlement}>Upgrade Settlement</button>
                                        <button onClick={handleBuildSoldier}>Buy Soldier</button>
                                    </>
                                ) : (
                                    <></>
                                )}
                            </>
                        ) : (
                            <>
                                <p>No settlement</p>
                                <button onClick={handleBuildSettlement}>Build Settlement</button>
                            </>
                        )}
                        <button onClick={handleBuildRoad}>Build Road</button>

                        <h2>Armies</h2>
                        <Grid container>
                            <Grid container size={12}>
                                <Grid size={12}>
                                    <h2>Enemy</h2>
                                </Grid>

                                {soldierGroups ? (
                                    <>
                                        {Object.entries(soldierGroups).map(([owner, soldiers]) =>
                                            owner !== playerName ? (
                                                <Grid
                                                    style={{
                                                        backgroundColor: selectedEnemy !== owner ? 'white' : 'grey',
                                                        border: '2px solid black',
                                                        padding: '16px',
                                                    }}
                                                    container
                                                    key={owner}
                                                    size={4}
                                                    onClick={() => handleOnClickEnemy(owner)}
                                                >
                                                    <Grid size={12}>{owner}</Grid>
                                                    <Grid container>
                                                        {soldiers.map((soldier) => (
                                                            <Grid key={soldier.id}>{soldier.type}</Grid>
                                                        ))}
                                                    </Grid>
                                                </Grid>
                                            ) : (
                                                <></>
                                            )
                                        )}
                                    </>
                                ) : (
                                    <>No enemy soldiers here</>
                                )}
                            </Grid>
                            <Grid container size={12}>
                                <Grid size={12}>
                                    <h2>You</h2>
                                </Grid>
                                <Grid container spacing={4}>
                                    {soldierGroups[playerName] ? (
                                        <>
                                            {soldierGroups[playerName].map((soldier) => (
                                                <Grid key={soldier.id}>
                                                    {soldier.type}

                                                    {['move', 'battle'].includes(action) ? (
                                                        <>
                                                            {selectedSoldiers.includes(soldier.id) ? (
                                                                <button onClick={() => handleUnselectSoldier(soldier.id)}>Deselect</button>
                                                            ) : (
                                                                <button onClick={() => handleSelectSoldier(soldier.id)}>Select</button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <></>
                                                    )}
                                                </Grid>
                                            ))}
                                        </>
                                    ) : (
                                        <>You have no soldiers here</>
                                    )}
                                </Grid>
                            </Grid>
                        </Grid>
                    </div>

                    <div style={{ border: '2px solid black', padding: '16px' }}>
                        {action !== '' ? (
                            <>
                                {['move', 'battle'].includes(action) && (
                                    <>
                                        <button onClick={handleSelectAll}>Select All</button>
                                        <button onClick={() => setSelectedSoldiers([])}>Deselect All</button>
                                    </>
                                )}
                                <button onClick={handleConfirm}>Confirm Select</button>
                                <button onClick={handleCancel}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setAction('battle')}>Battle</button>
                                <button onClick={() => setAction('move')}>Move</button>
                            </>
                        )}
                    </div>
                </>
            )}
        </>
    );
};

export default IntersectViewer;
