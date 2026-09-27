/**
 * Validation barrel — the rule checks live in domain-focused modules:
 * buildValidation (settlement/road/city), soldierMoveValidation, and
 * soldierActionValidation (recruit/heal/capture). Re-exported here so
 * existing importers keep working.
 */
export * from './buildValidation';
export * from './soldierMoveValidation';
export * from './soldierActionValidation';
