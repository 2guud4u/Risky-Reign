import { PortType } from 'common';

/** Payload of the `openTrade` effect: the port clicked (if any) to preset the bank form. */
export interface OpenTradeDetail {
  port?: PortType;
}
