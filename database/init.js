const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function seedBusinessDocuments(db) {
  return new Promise((resolve) => {
    // Check if we already have system documents
    db.get('SELECT COUNT(*) as count FROM documents WHERE is_system_document = TRUE', (err, row) => {
      if (err || row.count > 0) {
        console.log('System documents already exist or error checking');
        resolve();
        return;
      }
      
      // Add sample business documents (replace with real ones later)
      const businessDocs = [
        {
          name: 'Company Overview',
          content: `Our company provides innovative business solutions including:
          - Digital marketing services
          - Web development and design
          - Business consulting and strategy
          - Technical support and maintenance
          
          We serve small to medium businesses and have been operating since 2020.
          Our team consists of experienced professionals in technology and business strategy.`
        },
        {
          name: 'Services and Pricing',
          content: `Our main services and pricing:
          
          **Web Development:**
          - Basic website: $2,000 - $5,000
          - E-commerce site: $5,000 - $15,000
          - Custom web applications: $10,000+
          
          **Digital Marketing:**
          - SEO optimization: $1,000/month
          - Social media management: $800/month
          - Pay-per-click advertising: $500/month + ad spend
          
          **Consulting:**
          - Business strategy: $150/hour
          - Technical consulting: $120/hour`
        }
      ];
      
      console.log('Creating initial business documents...');
      
      businessDocs.forEach((doc, index) => {
        db.run(
          'INSERT INTO documents (filename, original_name, content, is_system_document, file_size) VALUES (?, ?, ?, ?, ?)',
          [`system-${index + 1}.txt`, doc.name, doc.content, true, Buffer.byteLength(doc.content, 'utf8')],
          function(err) {
            if (err) {
              console.error('Error creating system document:', err);
            } else {
              console.log(`Created system document: ${doc.name}`);
            }
          }
        );
      });
      
      resolve();
    });
  });
}

function initDatabase() {
  const dbPath = path.join(__dirname, 'chatbot.db');
  const db = new sqlite3.Database(dbPath);

  db.serialize(async () => {
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

    await seedBusinessDocuments(db);
  });

  return db;
}

module.exports = { initDatabase };