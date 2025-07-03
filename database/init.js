const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function initDatabase() {
  const dbPath = path.join(__dirname, 'chatbot.db');
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // Documents table
    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      is_system_document BOOLEAN DEFAULT FALSE,
      file_size INTEGER,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Document chunks for efficient retrieval
    db.run(`CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      chunk_index INTEGER,
      content TEXT NOT NULL,
      word_count INTEGER,
      FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    )`);

    // System settings (migrate from file-based)
    db.run(`CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_name VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Database initialized successfully');
  });

  return db;
}

module.exports = { initDatabase };