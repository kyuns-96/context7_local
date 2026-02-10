import { Database } from "bun:sqlite";
import { createSchema } from "./schema";

export function openDatabase(path: string, readOnly: boolean = false): Database {
  const db = new Database(path);

  db.exec("PRAGMA journal_mode=WAL");

  if (!readOnly) {
    createSchema(db);
  } else {
    db.exec("PRAGMA query_only=ON");
  }

  return db;
}
