const { getPool } = require('./init');

class DocumentDB {
  constructor() {
    this.pool = getPool();
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
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const fileSize = Buffer.byteLength(content, 'utf8');
      
      // Insert document
      const docResult = await client.query(
        'INSERT INTO documents (filename, original_name, content, is_system_document, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [filename, originalName, content, isSystemDoc, fileSize]
      );
      
      const documentId = docResult.rows[0].id;
      
      // Create chunks
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

  // Get user documents (non-system only)
  async getUserDocuments() {
    const result = await this.pool.query(
      'SELECT id, original_name, file_size, upload_date FROM documents WHERE is_system_document = FALSE ORDER BY upload_date DESC'
    );
    return result.rows;
  }

  // Find relevant chunks for a query
  async findRelevantChunks(query, maxChunks = 10) {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    console.log('Query words:', queryWords);
    
    if (queryWords.length === 0) {
      console.log('No valid query words found');
      return [];
    }
    
    // Dynamic max chunks
    const dynamicMaxChunks = Math.min(maxChunks, Math.max(5, queryWords.length * 2));
    console.log(`Using up to ${dynamicMaxChunks} chunks for ${queryWords.length} query words`);
    
    // Build PostgreSQL query with ILIKE (case-insensitive)
    const conditions = queryWords.map((_, index) => `LOWER(dc.content) LIKE $${index + 1}`).join(' OR ');
    const scoreConditions = queryWords.map((_, index) => `(CASE WHEN LOWER(dc.content) LIKE $${index + queryWords.length + 1} THEN 1 ELSE 0 END)`).join(' + ');
    
    const queryParams = [
      ...queryWords.map(word => `%${word}%`),
      ...queryWords.map(word => `%${word}%`),
      dynamicMaxChunks
    ];
    
    const result = await this.pool.query(`
      SELECT dc.content, d.original_name, d.is_system_document,
             (${scoreConditions}) as relevance_score
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE ${conditions}
      ORDER BY relevance_score DESC, dc.chunk_index ASC
      LIMIT $${queryParams.length}
    `, queryParams);
    
    console.log(`Found ${result.rows.length} relevant chunks with scores:`, result.rows.map(r => ({
      score: r.relevance_score,
      source: r.original_name,
      preview: r.content.substring(0, 100) + '...'
    })));
    
    return result.rows;
  }

  // Delete document
  async deleteDocument(documentId) {
    const result = await this.pool.query(
      'DELETE FROM documents WHERE id = $1 AND is_system_document = FALSE',
      [documentId]
    );
    return result.rowCount > 0;
  }

  // System settings
  async getSystemPrompt() {
    const result = await this.pool.query(
      'SELECT setting_value FROM system_settings WHERE setting_name = $1',
      ['system_prompt']
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].setting_value;
    }
    
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

  async saveSystemPrompt(prompt) {
    await this.pool.query(
      'INSERT INTO system_settings (setting_name, setting_value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (setting_name) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP',
      ['system_prompt', prompt]
    );
  }
}

module.exports = DocumentDB;