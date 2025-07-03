const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DocumentDB {
  constructor() {
    const dbPath = path.join(__dirname, 'chatbot.db');
    this.db = new sqlite3.Database(dbPath);
  }

  // Chunk text into smaller pieces
  chunkText(text, chunkSize = 500) {
    const words = text.split(' ');
    const chunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push({
        content: chunk,
        word_count: Math.min(chunkSize, words.length - i)
      });
    }
    
    return chunks;
  }

  // Add document to database
  async addDocument(filename, originalName, content, isSystemDoc = false) {
    return new Promise((resolve, reject) => {
      const fileSize = Buffer.byteLength(content, 'utf8');
      
      this.db.run(
        'INSERT INTO documents (filename, original_name, content, is_system_document, file_size) VALUES (?, ?, ?, ?, ?)',
        [filename, originalName, content, isSystemDoc, fileSize],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          const documentId = this.lastID;
          
          // Create chunks
          const chunks = new DocumentDB().chunkText(content);
          const chunkPromises = chunks.map((chunk, index) => {
            return new Promise((resolveChunk, rejectChunk) => {
              new DocumentDB().db.run(
                'INSERT INTO document_chunks (document_id, chunk_index, content, word_count) VALUES (?, ?, ?, ?)',
                [documentId, index, chunk.content, chunk.word_count],
                (chunkErr) => {
                  if (chunkErr) rejectChunk(chunkErr);
                  else resolveChunk();
                }
              );
            });
          });
          
          Promise.all(chunkPromises)
            .then(() => resolve(documentId))
            .catch(reject);
        }
      );
    });
  }

  // Get user documents (non-system only)
  async getUserDocuments() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT id, original_name, file_size, upload_date FROM documents WHERE is_system_document = FALSE ORDER BY upload_date DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

    // Find relevant chunks for a query
    async findRelevantChunks(query, maxChunks = 10) {
    return new Promise((resolve, reject) => {
        const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
        
        console.log('Query words:', queryWords);
        
        if (queryWords.length === 0) {
        console.log('No valid query words found');
        resolve([]);
        return;
        }
        
        // Increase max chunks for complex queries
        const dynamicMaxChunks = Math.min(maxChunks, Math.max(5, queryWords.length * 2));
        console.log(`Using up to ${dynamicMaxChunks} chunks for ${queryWords.length} query words`);
        
        const likeConditions = queryWords.map(() => 'LOWER(dc.content) LIKE ?').join(' OR ');
        const queryParams = queryWords.map(word => `%${word}%`);
        
        this.db.all(`
        SELECT dc.content, d.original_name, d.is_system_document,
                (${queryWords.map(() => '(CASE WHEN LOWER(dc.content) LIKE ? THEN 1 ELSE 0 END)').join(' + ')}) as relevance_score
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE ${likeConditions}
        ORDER BY relevance_score DESC, dc.chunk_index ASC
        LIMIT ?
        `, [...queryParams, ...queryParams, dynamicMaxChunks], (err, rows) => {
        if (err) {
            reject(err);
        } else {
            console.log(`Found ${rows.length} relevant chunks with scores:`, rows.map(r => ({
            score: r.relevance_score,
            source: r.original_name,
            preview: r.content.substring(0, 100) + '...'
            })));
            resolve(rows);
        }
        });
    });
    }

  // Delete document
  async deleteDocument(documentId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM documents WHERE id = ? AND is_system_document = FALSE', [documentId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // System settings
  async getSystemPrompt() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT setting_value FROM system_settings WHERE setting_name = ?', ['system_prompt'], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.setting_value : 'You are a helpful business assistant...');
      });
    });
  }

  async saveSystemPrompt(prompt) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO system_settings (setting_name, setting_value, updated_at) VALUES (?, ?, datetime("now"))',
        ['system_prompt', prompt],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

module.exports = DocumentDB;