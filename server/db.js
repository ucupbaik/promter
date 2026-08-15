import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({ connectionString, max: 5 })
  : null;

export async function initDb() {
  if (!pool) {
    console.log("[db] DATABASE_URL not set — running with in-memory rooms only.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id   TEXT PRIMARY KEY,
      state     JSONB NOT NULL,
      api_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log("[db] Connected to Neon Postgres and ensured 'rooms' table exists.");
}

export async function loadRoom(roomId) {
  if (!pool) return null;
  const { rows } = await pool.query(
    "SELECT state, api_token FROM rooms WHERE room_id = $1",
    [roomId]
  );
  return rows[0] || null;
}

export async function saveRoom(roomId, state, apiToken) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO rooms (room_id, state, api_token, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room_id)
     DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [roomId, JSON.stringify(state), apiToken]
  );
}
