import { HandlerContext } from '../context';
import { registerBattleAttackHandlers } from './attack';
import { registerBattleRollHandlers } from './rolls';
import { registerBattleResolutionHandlers } from './resolution';
import { registerBattleRepositioningHandlers } from './repositioning';

/**
 * Battle handlers: starting a battle, rolling dice, continuing/ending the
 * battle (with round resolution and casualties), repositioning an injured
 * soldier, and exiting (clearing the battle state). Registration is split
 * across the domain modules in this folder; this entry wires them all.
 */
export function registerBattleHandlers(ctx: HandlerContext): void {
  registerBattleAttackHandlers(ctx);
  registerBattleRollHandlers(ctx);
  registerBattleResolutionHandlers(ctx);
  registerBattleRepositioningHandlers(ctx);
}
