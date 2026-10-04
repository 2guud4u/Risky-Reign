import { PortType } from 'common';

/** Detail of `OPEN_TRADE_EVENT`: the port clicked (if any) to preset the bank form. */
export interface OpenTradeDetail {
  port?: PortType;
}
