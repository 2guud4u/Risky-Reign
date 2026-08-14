import React, { useState, useEffect } from 'react';
import { VertexNode } from 'common';
import { UiEvent, UiEventPayload, buildRoadPayload, moveSoldierPayload } from '../utils/eventsUtils';
import { SoldierObj } from '../utils/soldierUtils';
import { SettlementObj } from '../utils/settlementUtils';
import Grid from '@mui/material/Grid2';
import { groupBy } from '../utils/helperUtils';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
type Id = string;
interface VertexViewerProps {

}

const VertexViewer: React.FC<VertexViewerProps> = ({  }) => {
    const [settlement, setSettlement] = useState<SettlementObj | undefined>(undefined);
    const [action, setAction] = useState<string>('');
    const [selectedSoldiers, setSelectedSoldiers] = useState<string[]>([]);
    const [selectedEnemy, setSelectedEnemy] = useState<string>('');
    const [viewVertex, setViewVertex] = useState<VertexNode | undefined>(undefined);
    const [soldierGroups, setSoldierGroups] = useState<Record<string, SoldierObj[]>>({});

    const { gameRoom, currentPlayer, selectedVertexId, } = useGameRoom();
    const { socket, buildSettlement, buildRoad } = useSocket();

    //new vertex selected
    useEffect(() => {
        if (selectedVertexId === undefined) {
            return;
        }
        if (gameRoom === null || gameRoom.board === null || gameRoom.board.Vertexs === undefined) {
            return;
        }
        if (action === '') {
            setViewVertex(gameRoom.board.Vertexs.find((vertex) => vertex.id === selectedVertexId));
        }
    }, [gameRoom, action,selectedVertexId]);

    // useEffect(() => {
    //     if (viewVertex === undefined) {
    //         return;
    //     }
    //     setSoldierGroups(groupBy(soldiersMap.get(viewVertex.id) || [], 'owner'));
    //     setSettlement(settlements.find((s) => (viewVertex.settlement !== null ? s.id === viewVertex.settlement : false)));
    // }, [viewVertex, soldiersMap, settlements]);

    const handleBuildSettlement = () => {
        if (selectedVertexId === null || currentPlayer === null || gameRoom === null) {
            return;
        }
        buildSettlement(currentPlayer.id, selectedVertexId, gameRoom.id);
        console.log("client build settlement at vertex:", selectedVertexId);
    };
    const handleBuildRoad = () => {
        if (selectedVertexId === undefined) {
            return;
        }
        setAction('buildRoad');
    };
    const handleUpgradeSettlement = () => {
        if (selectedVertexId === null || currentPlayer === null || gameRoom === null) {
            return;
        }
        buildSettlement(currentPlayer.id, selectedVertexId, gameRoom.id);

    };
    const handleBuildSoldier = () => {
        // UiEventCaller('buildSoldier', { vertexId: vertex?.id });
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
                // UiEventCaller('initiateBattle', {
                //     vertexId: vertex?.id,
                //     friendlyIds: selectedSoldiers,
                //     enemyIds: soldierGroups[selectedEnemy].map((s) => s.id),
                //     enemyName: selectedEnemy,
                // });
                break;
            case 'move':
                if (selectedSoldiers.length === 0) {
                    console.log('no soldiers selected');
                    return;
                }
                if (selectedVertexId === undefined || viewVertex === undefined) {
                    return;
                }
                // UiEventCaller('moveSoldier', {
                //     soldierIds: selectedSoldiers,
                //     endVertexId: vertex.id,
                //     startVertexId: viewVertex.id,
                // } as moveSoldierPayload);

                break;
            case 'buildRoad':
                if (selectedVertexId === undefined || viewVertex === undefined || currentPlayer === null || gameRoom === null) {
                    return;
                }
                // When building road, selectedVertexId is the target vertexion
                const targetId = selectedVertexId as number;
                buildRoad(currentPlayer.id, viewVertex.id, targetId, gameRoom.id);

                break;
            default:
                break;
        }
        setAction('');
        setSelectedSoldiers([]);
        setSelectedEnemy('');
    };
    const handleSelectAll = () => {
        // setSelectedSoldiers(soldierGroups[currentPlayer.name].map((s) => s.id).filter((id) => !exhaustedSoldiers.includes(id)));
    };
    const handleOnClickEnemy = (owner: string) => {
        if (selectedEnemy !== owner) {
            setSelectedEnemy(owner);
        } else {
            setSelectedEnemy('');
        }
    };
    return (
        <Grid container>
            {viewVertex === undefined ? (
                <div>No vertexion selected</div>
            ) : gameRoom && currentPlayer ? (
                <Grid container>
                    <Grid style={{ border: '2px solid black', padding: '16px' }}>
                        <h1>Vertex {viewVertex.id}</h1>

                        {settlement ? (
                            <>
                                <p>Settlement: {settlement.id}</p>
                                {settlement.owner === currentPlayer.name ? (
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
                                            owner !== currentPlayer.name ? (
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
                                    {soldierGroups[currentPlayer.name] ? (
                                        <>
                                            {soldierGroups[currentPlayer.name].map((soldier) => (
                                                <Grid key={soldier.id}>
                                                    {soldier.type}

                                                    {['move', 'battle'].includes(action) ? (
                                                        <>
                                                            {selectedSoldiers.includes(soldier.id) ? (
                                                                <button onClick={() => handleUnselectSoldier(soldier.id)}>Deselect</button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleSelectSoldier(soldier.id)}
                                                                    // disabled={[].includes(soldier.id)}
                                                                >
                                                                    Select
                                                                </button>
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
                    </Grid>

                    <Grid style={{ border: '2px solid black', padding: '16px' }}>
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
                    </Grid>
                </Grid>
            ) : (
                <div>Loading...</div>
            )}
            
        </Grid>
        
    );
};

export default VertexViewer;
