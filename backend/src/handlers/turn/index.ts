import { HandlerContext } from '../context';
import { registerTurnFlowHandlers } from './flow';
import { registerDiceHandlers } from './dice';
import { registerRobberHandlers } from './robber';

/**
 * Turn handlers: ending the turn, undoing the most recent action, rolling
 * the dice (with 7-robber and payout resolution), moving the robber, and
 * resolving a steal or pending 7-discard. Registration is split across the
 * domain modules in this folder; this entry wires them all.
 */
export function registerTurnHandlers(ctx: HandlerContext): void {
  registerTurnFlowHandlers(ctx);
  registerDiceHandlers(ctx);
  registerRobberHandlers(ctx);
}
