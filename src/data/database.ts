import Database from "better-sqlite3";

const db: Database.Database = new Database("studymate.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due_date TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    type TEXT NOT NULL,
    event_date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    session_date TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '00:00',
    end_time TEXT NOT NULL DEFAULT '00:00'
  );

  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );
`);

// Add time columns if this database was created with the older schema.
const studySessionColumns = db
  .prepare("PRAGMA table_info(study_sessions)")
  .all() as { name: string }[];

const columnNames = new Set(studySessionColumns.map((column) => column.name));

if (!columnNames.has("start_time")) {
  db.exec(`
    ALTER TABLE study_sessions
    ADD COLUMN start_time TEXT NOT NULL DEFAULT '00:00'
  `);
}

if (!columnNames.has("end_time")) {
  db.exec(`
    ALTER TABLE study_sessions
    ADD COLUMN end_time TEXT NOT NULL DEFAULT '00:00'
  `);
}

// Remove duplicate study sessions from earlier tests.
db.exec(`
  DELETE FROM study_sessions
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM study_sessions
    GROUP BY subject, topic, session_date
  );
`);

// Add duplicate protection to the existing table.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS
  idx_unique_study_session
  ON study_sessions(subject, topic, session_date);
`);

export default db;