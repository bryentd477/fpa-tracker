const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fpa.db');

let db = null;

function getDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        initializeDatabase(db).then(() => resolve(db)).catch(reject);
      }
    });
  });
}

function initializeDatabase(database) {
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      // Main FPA table
      database.run(`
        CREATE TABLE IF NOT EXISTS fpas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fpaNumber TEXT UNIQUE NOT NULL,
          landowner TEXT NOT NULL,
          timberSaleName TEXT NOT NULL,
          landownerType TEXT NOT NULL,
          applicationStatus TEXT DEFAULT '',
          decisionDeadline TEXT,
          expirationDate TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Approved Activity table
      database.run(`
        CREATE TABLE IF NOT EXISTS approved_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fpaId INTEGER NOT NULL,
          status TEXT DEFAULT 'Not Started',
          startDate TEXT,
          harvestCompleteDate TEXT,
          activityCompleteDate TEXT,
          comments TEXT,
          reforestationRequired BOOLEAN DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (fpaId) REFERENCES fpas(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Renewal history table
      database.run(`
        CREATE TABLE IF NOT EXISTS renewal_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fpaId INTEGER NOT NULL,
          renewalDate TEXT NOT NULL,
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (fpaId) REFERENCES fpas(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database tables initialized');
          resolve();
        }
      });
    });
  });
}

function runAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

module.exports = {
  getDatabase,
  runAsync,
  getAsync,
  allAsync
};
