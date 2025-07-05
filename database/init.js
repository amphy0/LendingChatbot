const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;
let pool;

function initDatabase() {
  // Use SQLite for local development if no DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.log('Using SQLite for local development');
    db = new sqlite3.Database(path.join(__dirname, 'chatbot.db'));
    createTablesSQLite();
    return db;
  }
  
  // Use PostgreSQL for production
  console.log('Using PostgreSQL');
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  createTablesPostgreSQL();
  return pool;
}

async function createTablesSQLite() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          content TEXT NOT NULL,
          is_system_document INTEGER DEFAULT 0,
          file_size INTEGER,
          upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER,
          chunk_index INTEGER,
          content TEXT NOT NULL,
          word_count INTEGER,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_name TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating SQLite tables:', err);
          reject(err);
        } else {
          console.log('SQLite tables created successfully');
          resolve();
        }
      });
    });
  });
}

async function createTablesPostgreSQL() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_system_document BOOLEAN DEFAULT FALSE,
        file_size INTEGER,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER,
        content TEXT NOT NULL,
        word_count INTEGER
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_name VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('PostgreSQL tables created successfully');
    
  } catch (error) {
    console.error('Error creating PostgreSQL tables:', error);
  }
}

function getPool() {
  return pool || db;
}

module.exports = { initDatabase, getPool };