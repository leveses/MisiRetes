import express from 'express';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3001;
const db = new sqlite3.Database('./db/users.db');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Alapértelmezett kezdőoldal: bejelentkezés
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bejelentkezes.html'));
});

// Bejelentkezés
app.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  console.log('Kapott adat:', req.body);
  
  db.get(
    `SELECT * FROM users WHERE username = ? AND role = ?`,
    [username, role],
    async (err, user) => {
      if (err) return res.status(500).json({ error: 'Adatbázis hiba' });
      if (!user) return res.status(401).json({ error: 'Hibás felhasználónév vagy szerepkör' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Hibás jelszó' });

      res.json({ success: true, role });
    }
  );
});

app.get('/api/tastes', (req, res) => {
  db.all(`SELECT * FROM tastes`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Adatbázis hiba' });
    res.json(rows);
  });
});

// Új íz hozzáadása
app.post('/api/tastes', (req, res) => {
  const { name } = req.body;
  db.run(`INSERT INTO tastes (name) VALUES (?)`, [name], function (err) {
    if (err) return res.status(500).json({ error: 'Adatbázis hiba' });
    res.json({ id: this.lastID, name });
  });
});

// Íz törlése
app.delete('/api/tastes/:id', (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM tastes WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'Adatbázis hiba' });
    res.json({ success: true });
  });
});

// rendelési határidő ellenőrzése
db.all(`SELECT key, value FROM settings WHERE key IN ('orderDeadline','deadlineActive')`, (err, rows) => {
  if (err) return res.status(500).json({ error: 'Adatbázis hiba a határidő ellenőrzésénél' });

  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));

  if (settings.deadlineActive === 'true') {
    const now = new Date();
    const [hour, minute] = settings.orderDeadline.split(':').map(Number);
    const deadline = new Date();
    deadline.setHours(hour, minute, 0, 0);

    if (now > deadline) {
      return res.status(403).json({ error: 'Lejárt a rendelési határidő' });
    }
  }

  // … ide jöhet a rendelés feldolgozása, pl. INSERT az orders táblába …
});


// Rendelés mentése
app.post('/api/orders', (req, res) => {
  const { order, user } = req.body;

  const stmt = db.prepare(`INSERT INTO orders (username, taste_id, quantity) VALUES (?, ?, ?)`);
  db.serialize(() => {
    for (const item of order) {
      stmt.run(user, item.taste_id, item.quantity);
    }
    stmt.finalize();
    res.json({ success: true });
  });
});

// Ízek lekérdezése (admin számára)
app.get('/tastes', (req, res) => {
  db.all(`SELECT * FROM tastes`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Adatbázis hiba' });
    res.json(rows);
  });
});

// Statisztikai adatok lekérdezése
app.get('/api/stats', (req, res) => {
  const dailyOrdersQuery = `
    SELECT date, COUNT(*) as count 
    FROM orders 
    GROUP BY date 
    ORDER BY date ASC
  `;

  const flavorCountQuery = `
    SELECT t.name as flavor, COUNT(*) as count
    FROM orders o
    JOIN tastes t ON o.taste_id = t.id
    GROUP BY o.taste_id
    ORDER BY count DESC
  `;

  const stats = {};

  db.all(dailyOrdersQuery, [], (err, dailyRows) => {
    if (err) return res.status(500).json({ error: 'Napi statisztika hiba' });

    stats.daily = dailyRows.map(row => ({
      date: row.date,
      count: row.count
    }));

    db.all(flavorCountQuery, [], (err2, flavorRows) => {
      if (err2) return res.status(500).json({ error: 'Íz statisztika hiba' });

      stats.flavors = flavorRows.map(row => ({
        flavor: row.flavor,
        count: row.count
      }));

      res.json(stats);
    });
  });
});

// Összes rendelés ízenként
app.get("/api/stats", (req, res) => {
  const db = new sqlite3.Database('./db/users.db');
  const { days } = req.query;

  const params = [];
  let dateFilter = "";

  if (days !== "all") {
    dateFilter = "WHERE created_at >= date('now', ?)";
    params.push(`-${days} days`);
  }

  const ordersPerDayQuery = `
    SELECT date(created_at) as date, COUNT(*) as count
    FROM orders
    ${dateFilter}
    GROUP BY date(created_at)
    ORDER BY date(created_at)
  `;

  const topTastesQuery = `
    SELECT tastes.name, SUM(orders.quantity) as count
    FROM orders
    JOIN tastes ON orders.taste_id = tastes.id
    ${dateFilter}
    GROUP BY tastes.name
    ORDER BY count DESC
    LIMIT 5
  `;

  const ordersPerUserQuery = `
    SELECT username, SUM(quantity) as total
    FROM orders
    ${dateFilter}
    GROUP BY username
    ORDER BY total DESC
  `;

  const result = { ordersPerDay: [], topTastes: [], ordersPerUser: [] };

  db.all(ordersPerDayQuery, params, (err, rows1) => {
    if (err) return res.status(500).json({ error: err.message });
    result.ordersPerDay = rows1;

    db.all(topTastesQuery, params, (err, rows2) => {
      if (err) return res.status(500).json({ error: err.message });
      result.topTastes = rows2;

      db.all(ordersPerUserQuery, params, (err, rows3) => {
        if (err) return res.status(500).json({ error: err.message });
        result.ordersPerUser = rows3;

        res.json(result);
      });
    });
  });
});

// === HATÁRIDŐ LEKÉRÉS ===
app.get('/beallitasok/lekeres', (req, res) => {
  db.all(`SELECT key, value FROM settings WHERE key IN ('orderDeadline','deadlineActive')`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB-hiba' });
      const result = Object.fromEntries(rows.map(r => [r.key, r.value]));
      res.json(result);
    });
});

// === HATÁRIDŐ MENTÉS ===
app.post('/beallitasok/mentes', (req, res) => {
  const { orderDeadline, deadlineActive } = req.body;
  const stmt = db.prepare(`REPLACE INTO settings (key, value) VALUES (?, ?)`);
  stmt.run('orderDeadline', orderDeadline);
  stmt.run('deadlineActive', deadlineActive);
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: 'Mentési hiba' });
    res.json({ success: true });
  });
});


// Indítás
app.listen(PORT, () => {
  console.log(`Szerver fut a http://localhost:${PORT} címen`);
});


/*const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Statikus fájlok (pl. HTML, CSS, JS) kiszolgálása a 'public' mappából
app.use(express.static(path.join(__dirname, 'public')));

// Alapértelmezett kezdőoldal: bejelentkezés
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bejelentkezes.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.urlencoded({ extended: true }));

// Teszt felhasználók – csak próbaként!
const felhasznalok = [
  { felhasznalonev: 'misi', jelszo: 'admin123', szerep: 'admin' },
  { felhasznalonev: 'bolt1', jelszo: 'bolt123', szerep: 'bolt' },
  { felhasznalonev: 'viszont1', jelszo: 'viszont123', szerep: 'viszontelado' }
];

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const felhasznalo = felhasznalok.find(u => u.felhasznalonev === username && u.jelszo === password);

  if (!felhasznalo) {
    return res.status(401).send('Hibás felhasználónév vagy jelszó');
  }

  // Átirányítás szerep alapján
  if (felhasznalo.szerep === 'admin') {
    res.redirect('/admin');
  } else if (felhasznalo.szerep === 'viszontelado') {
    res.redirect('/viszontelado');
  } else if (felhasznalo.szerep === 'bolt') {
    res.redirect('/bolt');
  }
});


// Szerver indítása
app.listen(PORT, () => {
  console.log(`Szerver fut: http://localhost:${PORT}`);
});

*/