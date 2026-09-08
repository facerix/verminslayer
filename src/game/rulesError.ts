export type RulesErrorCode =
  | 'INVALID_MAP_HEIGHT'
  | 'INVALID_MAP_WIDTH'
  | 'UNKNOWN_MAP_SYMBOL'
  | 'INVALID_FEATURE_COUNT'
  | 'UNKNOWN_MISSION'
  | 'INVALID_COMMAND'
  | 'INVALID_SETUP_STEP'
  | 'INVALID_MODE'
  | 'INVALID_FACING'
  | 'INVALID_HERO_ROSTER'
  | 'HERO_NOT_SELECTED'
  | 'HERO_ALREADY_DEPLOYED'
  | 'INVALID_DEPLOYMENT_SQUARE'
  | 'DEPLOYMENT_OCCUPIED'
  | 'NOISE_ALREADY_DRAWN'
  | 'NO_NOISE_DRAWN'
  | 'INVALID_NOISE_SPAWN'
  | 'NOISE_SPAWN_OCCUPIED'
  | 'INITIAL_NOISE_COMPLETE'
  | 'INVALID_RANDOM_VALUE';

export class RulesError extends Error {
  readonly code: RulesErrorCode;

  constructor(code: RulesErrorCode, message: string) {
    super(message);
    this.name = 'RulesError';
    this.code = code;
  }
}
