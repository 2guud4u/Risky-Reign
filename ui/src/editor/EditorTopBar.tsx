import { EditorTopBarProps } from './types';
import Button from '../components/ui/Button';

/**
 * The Board tab's top bar inside Customize Game: the random-map regen and a
 * live summary of the draft (hex count, layout validity, missing numbers).
 * Map-picking (Standard/Expansion generators + the catalog) lives in the
 * Maps palette tab.
 */
const EditorTopBar: React.FC<EditorTopBarProps> = ({
  onRefreshMap,
  hexCount,
  validation,
  missingNumbers,
}) => (
  <div className="w-full max-w-[1200px] flex items-center gap-3 flex-wrap">
    <Button
      size="sm"
      onClick={onRefreshMap}
      title="Replace the room's board with a fresh random map (loses the current draft)"
    >
      Refresh Map
    </Button>
    <span className="text-sm text-ink-faint">
      {hexCount} hexes · {validation.allowed ? 'valid' : `invalid: ${validation.reason}`}
      {missingNumbers > 0 ? ` · ${missingNumbers} missing number${missingNumbers > 1 ? 's' : ''}` : ''}
    </span>
  </div>
);

export default EditorTopBar;
