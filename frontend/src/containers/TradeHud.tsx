import React from 'react';
import Grid from '@mui/material/Grid2';
import { tradeState, tradeParty } from '../utils/tradeUtils';
import { PlayerObj } from '../utils/playerUtils';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { v4 as uuidv4 } from 'uuid';
interface TradeHudProps {
    tradeStates: tradeState[];
    playerName: string;
    playerMap: Map<string, PlayerObj>;
    UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;


}
type id = string;

const TradeHud: React.FC<TradeHudProps> = ({tradeStates, playerName, playerMap, UiEventCaller}) => {
    const [selectedTrade, setSelectedTrade] = React.useState< tradeState| null>(null);

    const handleTradeSelect = (id: string) => {
        setSelectedTrade(tradeStates.find((trade) => trade.id === id) || null);
    }

    return <div style={{ border: '2px solid black', padding: '16px' }}>
        <Grid container >
            <Grid  size={12}>
                <div>Trade Hud</div>
            </Grid>
            <Grid container size={6}>
                {selectedTrade ? (
                    <Grid container direction={"column"}>
                        <Grid><h1>Detail View</h1></Grid>
                        <Grid>{selectedTrade ? 
                            <TradeView tradeState={selectedTrade} handleSubmit={(hi)=>{}} player={playerMap.get(playerName)}/>
                         : null}</Grid>   
                    </Grid>
                    
                ) : (
                    // <CreateView playerMap={playerMap} playerName={playerName} />
                    <div></div>
                )}
            </Grid>
            <Grid container size={6}>
                <Grid size={12}>
                    <h1>Ongoing</h1>
                </Grid>
                <Grid container alignItems="flex-start" direction={"row"}>
                    {tradeStates.map((trade) => (
                        <MiniTradeView trade={trade} handleTradeSelect={handleTradeSelect} />
                    ))}
                </Grid>
                <Grid>
                    <button onClick={()=>setSelectedTrade(null)}>
                        Create Trade
                    </button>
                </Grid>
            </Grid>
        </Grid>
    </div>;
};

interface MiniTradeViewProps {
    trade: tradeState;
    handleTradeSelect: (id: string) => void;
}

const MiniTradeView: React.FC<MiniTradeViewProps> = ({trade, handleTradeSelect}) => {
    return (
    <Grid onClick={() => handleTradeSelect(trade.id)} style={{ border: '1px solid black', padding: '8px', margin: '8px' }} container size={12}>
        
        <Grid size={5}>
        <MiniTradeCard tradeParty={trade.trader} />
           </Grid>
        <Grid container size={2} alignItems= "flex-end">
            <Grid>For</Grid>
        </Grid>
        <Grid size={5}>
        <MiniTradeCard tradeParty={trade.tradee} />
        </Grid>
    </Grid>
    )
    
};

interface MiniTradeCardProps {
    tradeParty: tradeParty;
}

const MiniTradeCard: React.FC<MiniTradeCardProps> = ({tradeParty}) => {
    return (
        
            <>
            
            <Grid size={12}>
                {tradeParty.name}
            </Grid>
            <Grid>
            {Object.entries(tradeParty.offer).map(([resource, count]) => (
                <>
                    {' '}{count}
                </>
            ))}
            </Grid>
            </>
        
    );
}
interface TradeCardProps {
    tradeParty: tradeParty;
    editMode: boolean;
    handleChange: (name: string,resource: string, count: number) => void;
}

const TradeCard: React.FC<TradeCardProps> = ({tradeParty, editMode, handleChange}) => {

    return (
        
            <>
            
            <Grid size={12}>-------</Grid>
            <Grid container direction={"column"}>

            {Object.entries(tradeParty.offer).map(([resource, count]) => (
                <Grid key={resource} container justifyContent="space-between" direction={"row"}>
                    <Grid>{resource}{":"} {count}</Grid>
                    
                    {editMode ? (<Grid container direction="row">
                    <Grid><button onClick={()=>handleChange(tradeParty.name, resource, count+1)}>+</button></Grid>
                    <Grid><button onClick={()=>handleChange(tradeParty.name, resource, count-1)}>-</button></Grid>
                    </Grid>
                    )
                     : null}
                </Grid>
                
            ))}
            </Grid>
            
            </>
        
    );
}

interface TradeViewProps{
    tradeState: tradeState;
    handleSubmit: (tradeState: tradeState) => void;
    player: PlayerObj | undefined;
}

const TradeView: React.FC<TradeViewProps> = ({player, tradeState, handleSubmit}) => {
    const [editMode, setEditMode] = React.useState(false);
    const [tradeStateLocal, setTradeStateLocal] = React.useState<tradeState>(tradeState);
    const [yourOffer, setYourOffer] = React.useState<tradeParty>();
    const [theirOffer, setTheirOffer] = React.useState<tradeParty>();

    React.useEffect(() => {
        if (player) {
            if (tradeStateLocal.trader.name === player.name) {
                setYourOffer(tradeStateLocal.trader);
                setTheirOffer(tradeStateLocal.tradee);
            } else {
                setYourOffer(tradeStateLocal.tradee);
                setTheirOffer(tradeStateLocal.trader);
            }
        }
    }, [player, tradeStateLocal]);

    const handleChange = (name: string, resource: string, count: number) => {
        count = count < 0 ? 0 : count;
        if (name === tradeStateLocal.trader.name) {

            setTradeStateLocal({
                ...tradeStateLocal,
                trader: {
                    ...tradeStateLocal.trader,
                    offer: {
                        ...tradeStateLocal.trader.offer,
                        [resource]: count,
                    }
                }
            })

        } else {
            setTradeStateLocal({
                ...tradeStateLocal,
                tradee: {
                    ...tradeStateLocal.tradee,
                    offer: {
                        ...tradeStateLocal.tradee.offer,
                        [resource]: count,
                    }
                }
            })
        }
    }
    return (
        <Grid container direction={"column"}>
            <Grid container direction={"row"} justifyContent="space-between">
                
                    
                    {yourOffer &&  (
                         <Grid>
                        <div>Your Offer</div>
                        <TradeCard tradeParty={yourOffer} editMode={editMode} handleChange={handleChange}/>
                        </Grid>
                        )}
               
                <Grid>{"----->"}</Grid>
                {theirOffer &&  (
                         <Grid>
                        <div> {theirOffer.name}'s Offer</div>
                        <TradeCard tradeParty={theirOffer} editMode={editMode} handleChange={handleChange}/>
                        </Grid>
                        )}
            </Grid>
            <Grid container>
                <Grid><button>Accept</button></Grid>
                <Grid><button>Decline</button></Grid>
                <Grid><button onClick={()=>(editMode ? setEditMode(false) : setEditMode(true))}>Edit</button></Grid>
                {editMode && (<Grid>
                    <button onClick={()=>handleSubmit(tradeStateLocal)}>Submit Edit</button>
                    </Grid>)}
            </Grid>
        </Grid>
    )
}

// interface CreateViewProps {
//     playerMap: Map<string, PlayerObj>;
//     playerName: string;
// }

// const CreateView: React.FC<CreateViewProps> = ({playerMap, playerName}) => {
//     const [creationState, setCreationState] = React.useState<tradeState>({
//         id: uuidv4(),
//         trader: {
//             name: playerName,
//             offer: {
//                 Brick: 0,
//                 Wood: 0,
//                 Wheat: 0,
//                 Sheep: 0,
//                 Ore: 0,
//             },
//             response: null,
//         },
//         tradee: {
//             name: '',
//             offer: {
//                 Brick: 0,
//                 Wood: 0,
//                 Wheat: 0,
//                 Sheep: 0,
//                 Ore: 0,
//             },
//             response: null,
//         },
//     });
//     return (
//     <Grid container>
//         <Grid size={12}>
//             <h1>Create</h1>
//         </Grid>
//         <Grid size={12}>
//             <div>select who trade</div>
//         </Grid>
//         <TradeView tradeState={creationState} handleSubmit={(hi)=>{}}/>

//     </Grid>
//     )
// }
export default TradeHud;
