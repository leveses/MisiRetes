import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const db = new sqlite3.Database('./db/users.db');

db.serialize(async () => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  const insert = db.prepare(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`);

  const users = [
    { username: 'misi', password: 'admin123', role: 'admin' },
    { username: 'v1', password: 'pass1', role: 'viszontelado' },
    { username: 'bolt1', password: 'pass2', role: 'sajatuzlet' },
  ];

  for (const { username, password, role } of users) {
    const hash = await bcrypt.hash(password, 10);
    insert.run(username, hash, role);
  }

  // === HATÁRIDŐ BEÁLLÍTÁSOK ===
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )`);

    const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    // Alapértékek
    insertSetting.run('orderDeadline',  '13:00');
    insertSetting.run('deadlineActive', 'true');
    insertSetting.finalize();
  
  // Ízek tábla
  db.run(`CREATE TABLE IF NOT EXISTS tastes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  const insertTaste = db.prepare(`INSERT OR IGNORE INTO tastes (name) VALUES (?)`);
  const tastes = ['Túrós', 'Almás', 'Mákos', 'Meggyes'];

  tastes.forEach(name => {
    insertTaste.run(name);
  });

  insertTaste.finalize();

  console.log("Ízek feltöltve.");

  insert.finalize(() => {
    console.log("Felhasználók feltöltve.");
    db.close(); // Csak ezután zárjuk le
  });
});


db.run(`CREATE TABLE IF NOT EXISTS tastes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    taste_id INTEGER,
    quantity INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
