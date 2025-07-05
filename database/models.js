const { getPool } = require('./init');

class DocumentDB {
  constructor() {
    this.db = getPool();
    this.isSQLite = !process.env.DATABASE_URL;
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
    if (this.isSQLite) {
      return this.addDocumentSQLite(filename, originalName, content, isSystemDoc);
    } else {
      return this.addDocumentPostgreSQL(filename, originalName, content, isSystemDoc);
    }
  }

  async addDocumentSQLite(filename, originalName, content, isSystemDoc = false) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const fileSize = Buffer.byteLength(content, 'utf8');
        
        this.db.run(
          'INSERT INTO documents (filename, original_name, content, is_system_document, file_size) VALUES (?, ?, ?, ?, ?)',
          [filename, originalName, content, isSystemDoc ? 1 : 0, fileSize],
          function(err) {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const documentId = this.lastID;
            const chunks = this.chunkText(content);
            
            let completed = 0;
            for (let i = 0; i < chunks.length; i++) {
              this.db.run(
                'INSERT INTO document_chunks (document_id, chunk_index, content, word_count) VALUES (?, ?, ?, ?)',
                [documentId, i, chunks[i].content, chunks[i].word_count],
                function(err) {
                  if (err) {
                    this.db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  completed++;
                  if (completed === chunks.length) {
                    this.db.run('COMMIT');
                    resolve(documentId);
                  }
                }.bind(this)
              );
            }
          }.bind(this)
        );
      });
    });
  }

  async addDocumentPostgreSQL(filename, originalName, content, isSystemDoc = false) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const fileSize = Buffer.byteLength(content, 'utf8');
      
      const docResult = await client.query(
        'INSERT INTO documents (filename, original_name, content, is_system_document, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [filename, originalName, content, isSystemDoc, fileSize]
      );
      
      const documentId = docResult.rows[0].id;
      
      const chunks = this.chunkText(content);
      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          'INSERT INTO document_chunks (document_id, chunk_index, content, word_count) VALUES ($1, $2, $3, $4)',
          [documentId, i, chunks[i].content, chunks[i].word_count]
        );
      }
      
      await client.query('COMMIT');
      return documentId;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user documents
  async getUserDocuments() {
    if (this.isSQLite) {
      return new Promise((resolve, reject) => {
        this.db.all(
          'SELECT id, original_name, file_size, upload_date FROM documents WHERE is_system_document = 0 ORDER BY upload_date DESC',
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
    } else {
      const result = await this.db.query(
        'SELECT id, original_name, file_size, upload_date FROM documents WHERE is_system_document = FALSE ORDER BY upload_date DESC'
      );
      return result.rows;
    }
  }

  // Find relevant chunks
  async findRelevantChunks(query, maxChunks = 10) {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    if (queryWords.length === 0) {
      return [];
    }
    
    if (this.isSQLite) {
      return this.findRelevantChunksSQLite(queryWords, maxChunks);
    } else {
      return this.findRelevantChunksPostgreSQL(queryWords, maxChunks);
    }
  }

  async findRelevantChunksSQLite(queryWords, maxChunks) {
    return new Promise((resolve, reject) => {
      const conditions = queryWords.map(() => 'LOWER(dc.content) LIKE ?').join(' OR ');
      const params = queryWords.map(word => `%${word}%`);
      
      this.db.all(`
        SELECT dc.content, d.original_name, d.is_system_document
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE ${conditions}
        ORDER BY dc.chunk_index ASC
        LIMIT ?
      `, [...params, maxChunks], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async findRelevantChunksPostgreSQL(queryWords, maxChunks) {
    const conditions = queryWords.map((_, index) => `LOWER(dc.content) LIKE $${index + 1}`).join(' OR ');
    const scoreConditions = queryWords.map((_, index) => `(CASE WHEN LOWER(dc.content) LIKE $${index + queryWords.length + 1} THEN 1 ELSE 0 END)`).join(' + ');
    
    const queryParams = [
      ...queryWords.map(word => `%${word}%`),
      ...queryWords.map(word => `%${word}%`),
      maxChunks
    ];
    
    const result = await this.db.query(`
      SELECT dc.content, d.original_name, d.is_system_document,
             (${scoreConditions}) as relevance_score
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE ${conditions}
      ORDER BY relevance_score DESC, dc.chunk_index ASC
      LIMIT $${queryParams.length}
    `, queryParams);
    
    return result.rows;
  }

  // Delete document
  async deleteDocument(documentId) {
    if (this.isSQLite) {
      return new Promise((resolve, reject) => {
        this.db.run(
          'DELETE FROM documents WHERE id = ? AND is_system_document = 0',
          [documentId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
          }
        );
      });
    } else {
      const result = await this.db.query(
        'DELETE FROM documents WHERE id = $1 AND is_system_document = FALSE',
        [documentId]
      );
      return result.rowCount > 0;
    }
  }

  // System settings
  async getSystemPrompt() {
    if (this.isSQLite) {
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT setting_value FROM system_settings WHERE setting_name = ?',
          ['system_prompt'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.setting_value : this.getDefaultSystemPrompt());
          }
        );
      });
    } else {
      const result = await this.db.query(
        'SELECT setting_value FROM system_settings WHERE setting_name = $1',
        ['system_prompt']
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].setting_value;
      }
      
      return this.getDefaultSystemPrompt();
    }
  }

  async saveSystemPrompt(prompt) {
    if (this.isSQLite) {
      return new Promise((resolve, reject) => {
        this.db.run(
          'INSERT OR REPLACE INTO system_settings (setting_name, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          ['system_prompt', prompt],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else {
      await this.db.query(
        'INSERT INTO system_settings (setting_name, setting_value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (setting_name) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP',
        ['system_prompt', prompt]
      );
    }
  }

  getDefaultSystemPrompt() {
    return `You are a helpful business assistant with access to company documents. 

IMPORTANT: Always format your responses using proper markdown for better readability:
- Use **bold** for important points
- Use *italics* for emphasis  
- Use ## headers for main topics
- Use - or * for bullet points
- Use numbered lists when showing steps (1. 2. 3.)
- Use \`code blocks\` for technical terms or file names
- Use > blockquotes for important quotes or highlights

Provide clear, professional responses based on the available documents. If you don't have specific information in the documents, say so clearly.`;
  }
}

module.exports = DocumentDB;