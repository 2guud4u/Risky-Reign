import { BuildType } from '../types/Pieces';

/**
 * Build-type guard (pure code). The `BuildType` type lives in
 * `types/Pieces.ts`.
 */

const buildTypes = ['Settlement', 'Road', 'City', 'Soldier'] as const;

export const isBuildType = (arg: unknown): arg is BuildType =>
  (buildTypes as readonly string[]).includes(arg as string);
