import Database from "better-sqlite3";

const db: Database.Database = new Database("studymate.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due_date TEXT
  )
`);

export default db;