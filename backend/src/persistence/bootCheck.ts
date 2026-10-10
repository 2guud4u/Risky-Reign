import { PERSISTED_GAME_TTL_MS } from 'common';
import { getDb } from './db';
import { deleteExpired } from './gameRepository';

/**
 * Boot-time health check for the persisted-games store. Persistence failures
 * are otherwise nearly silent: autosave errors are caught and logged once,
 * and the game keeps serving in memory. This makes a broken/missing store
 * loud at startup — when someone is actually looking at the logs.
 *
 * Checks, in order:
 *   1. open + migrate (any throw = the DB is unusable)
 *   2. integrity_check
 *   3. write probe (BEGIN IMMEDIATE / ROLLBACK — catches read-only DATA_DIR)
 *   4. stats: row count, oldest row age
 *   5. one expiry pass (the hourly timer alone leaves dead rows sitting if
 *      the server was down past the TTL)
 *
 * Never throws: a failed check logs and the server serves in memory only.
 */
export function checkPersistence(): void {
  try {
    const db = getDb();
    const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (integrity.integrity_check !== 'ok') {
      console.error(`[persistence] integrity_check: ${integrity.integrity_check}`);
    }
    db.exec('BEGIN IMMEDIATE');
    db.exec('ROLLBACK');
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number };
    const oldest = db
      .prepare('SELECT MIN(last_activity_at) AS oldest FROM games')
      .get() as { oldest: number | null };
    const expired = deleteExpired(Date.now() - PERSISTED_GAME_TTL_MS);
    console.log(
      `[persistence] ok — ${n} saved game(s)` +
        (oldest.oldest ? `, oldest activity ${new Date(oldest.oldest).toISOString()}` : '') +
        (expired.length ? `, swept ${expired.length} expired` : '')
    );
  } catch (err) {
    console.error('[persistence] DISABLED — database unusable, running memory-only:', err);
  }
}
