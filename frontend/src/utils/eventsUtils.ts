import { SoldierBattleState } from '../utils/soldierUtils';
import { Price } from './gameUtils';
export type UiEvent =
    | 'buildSettlement'
    | 'buildRoad'
    | 'endTurn'
    | 'rollDice'
    | 'trade'
    | 'buyDevCard'
    | 'playDevCard'
    | 'placeRobber'
    | 'upgradeSettlement'
    | 'buildSoldier'
    | 'moveSoldier'
    | 'initiateBattle'
    | 'rolledSoldierScore'
    | 'selectIntersect'
    | 'confirmedLineUp'
    | 'startTrade'
    | 'respondTrade'
    ;

export type UiEventPayload = buildSettlementPayload | buildRoadPayload | rollDicePayload;

export interface startTradePayload {
    trader: string;
    tradee: string;
    give: Price;
    receive: Price;
}
export interface respondTradePayload {
    tradeId: string;
    response: boolean;
}

export interface confirmedLineUpPayload {
    playerName: string;
    lineUp: SoldierBattleState[];
}
export interface rolledSoldierScorePayload {
    soldierId: string;
    rollNum: number;
}
export interface selectIntersectPayload {
    intersectId: number;
}
export interface initiateBattlePayload {
    intersectId: number;
    friendlyIds: string[];
    enemyIds: string[];
    enemyName: string;
}
export interface buildSettlementPayload {
    intersectId: number;
}

export interface upgradeSettlementPayload extends buildSettlementPayload {}

export interface buildSoldierPayload {
    intersectId: number;
}

export interface buildRoadPayload {
    startIntersectId: number;
    endIntersectId: number;
}

export interface rollDicePayload {}

export interface moveSoldierPayload {
    soldierIds: string[];
    startIntersectId: number;
    endIntersectId: number;
}
