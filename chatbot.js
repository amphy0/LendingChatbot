const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const express = require("express");
const pdfParse = require('pdf-parse');
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { initDatabase } = require('./database/init');
const DocumentDB = require('./database/models');

const app = express();
const PORT = process.env.PORT || 3000;

initDatabase();
const docDB = new DocumentDB();

setTimeout(async () => {
  try {
    await docDB.processSystemDocuments();
  } catch (error) {
    console.error('Error processing system documents:', error);
  }
}, 1000);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Helper functions
async function getSystemPrompt() {
  try {
    return await docDB.getSystemPrompt();
  } catch (error) {
    console.error('Error getting system prompt:', error);
    return 'You are a helpful business assistant with access to company documents. Always format your responses using proper markdown for better readability.';
  }
}

async function saveSystemPrompt(prompt) {
  try {
    await docDB.saveSystemPrompt(prompt);
    return true;
  } catch (error) {
    console.error('Error saving system prompt:', error);
    return false;
  }
}

async function getRelevantDocuments(query) {
  try {
    return await docDB.findRelevantChunks(query, 5);
  } catch (error) {
    console.error('Error finding relevant documents:', error);
    return [];
  }
}

// API Routes
app.get('/api/system-prompt', async (req, res) => {
  try {
    const prompt = await getSystemPrompt();
    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;
    const success = await saveSystemPrompt(prompt);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save prompt' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    const documents = await docDB.getUserDocuments();
    res.json(documents.map(doc => ({
      id: doc.id,
      name: doc.original_name,
      size: `${Math.round(doc.file_size / 1024)}KB`,
      upload_date: doc.upload_date
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.originalname, 'Type:', req.file.mimetype);

    let content = '';
    
    if (req.file.mimetype === 'application/pdf') {
      console.log('Processing PDF...');
      try {
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        content = pdfData.text;
        console.log('PDF processed, content length:', content.length);
      } catch (pdfError) {
        console.error('PDF parsing failed:', pdfError);
        return res.status(400).json({ error: 'Failed to parse PDF. Please try converting to text file first.' });
      }
    } else if (req.file.mimetype === 'text/plain') {
      console.log('Processing text file...');
      content = fs.readFileSync(req.file.path, 'utf8');
    } else {
      console.log('Unsupported file type:', req.file.mimetype);
      return res.status(400).json({ error: 'Only PDF and TXT files are supported' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'No text content could be extracted from the file' });
    }

    // Save to database instead of file system
    const filename = `${Date.now()}-${req.file.originalname}`;
    const documentId = await docDB.addDocument(filename, req.file.originalname, content, false);
    
    // Clean up temp file
    fs.unlinkSync(req.file.path);
    
    console.log('Document saved to database with ID:', documentId);
    res.json({ success: true, id: documentId });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: `Upload failed: ${error.message}` });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found');
    }
    
    const systemPrompt = await getSystemPrompt();
    const relevantChunks = await getRelevantDocuments(message);
    
    let context = systemPrompt;
    if (relevantChunks.length > 0) {
      context += '\n\nRelevant information from documents:\n\n' + 
        relevantChunks.map(chunk => 
          `From ${chunk.is_system_document ? 'Company Knowledge' : chunk.original_name}:\n${chunk.content}`
        ).join('\n\n---\n\n');
    }
    
    const fullPrompt = `${context}\n\nUser question: ${message}\n\nPlease provide a helpful response.`;
    
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    console.log(`Using ${relevantChunks.length} relevant document chunks for response`);
    
    const result = await model.generateContentStream(fullPrompt);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(chunkText);
      }
    }
    
    res.end();
    
  } catch (error) {
    console.error('Streaming chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: `Failed to get response: ${error.message}` });
    } else {
      res.write(`\n\n[Error: ${error.message}]`);
      res.end();
    }
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await docDB.deleteDocument(parseInt(id));
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found or cannot delete system document' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
