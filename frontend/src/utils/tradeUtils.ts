import { Price } from './gameUtils';

export interface tradeState {
    id: string;
    trader: tradeParty;
    tradee: tradeParty;
    
}

export interface tradeParty {
    name: string;
    offer: Price;
    response: boolean | null;
}
