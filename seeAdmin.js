// seedAdmin.js
//import sqlite3 from 'sqlite3';
//import bcrypt from 'bcrypt';
/*
const db = new sqlite3.Database('./db/users.db');

const username = 'admin';
const password = 'admin123';
const role = 'admin';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) return console.error('Hash hiba:', err);

  db.run(
    `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
    [username, hash, role],
    function (err) {
      if (err) return console.error('Beszúrási hiba:', err);
      console.log('Admin felhasználó létrehozva.');
      db.close();
    }
  );
});
*/

// külön fájlban vagy ideiglenesen a server.js végére:

import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./db/users.db');

db.all('SELECT id, username, role FROM users', (err, rows) => {
  if (err) {
    console.error('Hiba az adatbázis lekérdezéskor:', err.message);
    return;
  }

  console.log('Felhasználók az adatbázisban:');
  rows.forEach((row) => {
    console.log(`ID: ${row.id}, Név: ${row.username}, Szerepkör: ${row.role}`);
  });

  db.close();
});
