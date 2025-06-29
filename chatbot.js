const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const express = require("express");
const pdfParse = require('pdf-parse');
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Helper functions
function getSystemPrompt() {
  const promptPath = path.join(__dirname, 'data', 'system-prompt.txt');
  if (fs.existsSync(promptPath)) {
    return fs.readFileSync(promptPath, 'utf8');
  }
  return 'You are a helpful business assistant.';
}

function saveSystemPrompt(prompt) {
  const promptPath = path.join(__dirname, 'data', 'system-prompt.txt');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(promptPath, prompt);
}

function getAllDocuments() {
  const docsDir = path.join(__dirname, 'data', 'documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    return [];
  }
  
  const files = fs.readdirSync(docsDir);
  return files.map(file => {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    return { 
      name: file.replace(/^\d+-/, '').replace('.txt', ''),
      filename: file,
      content,
      size: `${Math.round(stats.size / 1024)}KB`
    };
  });
}

// API Routes
app.get('/api/system-prompt', (req, res) => {
  try {
    const prompt = getSystemPrompt();
    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system-prompt', (req, res) => {
  try {
    const { prompt } = req.body;
    saveSystemPrompt(prompt);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents', (req, res) => {
  try {
    const documents = getAllDocuments();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let content = '';
    
    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;
    } else if (req.file.mimetype === 'text/plain') {
      content = fs.readFileSync(req.file.path, 'utf8');
    } else {
      return res.status(400).json({ error: 'Only PDF and TXT files are supported' });
    }

    const filename = `${Date.now()}-${req.file.originalname}.txt`;
    const savePath = path.join(__dirname, 'data', 'documents', filename);
    
    // Make sure directory exists
    const docsDir = path.join(__dirname, 'data', 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    fs.writeFileSync(savePath, content);
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    
    const systemPrompt = getSystemPrompt();
    const documents = getAllDocuments();
    
    let context = systemPrompt;
    if (documents.length > 0) {
      context += '\n\nYou have access to these documents:\n\n' + 
        documents.map(doc => `Document: ${doc.name}\nContent: ${doc.content}`).join('\n\n---\n\n');
    }
    
    const fullPrompt = `${context}\n\nUser question: ${message}\n\nPlease provide a helpful response.`;
    
    console.log('Calling Gemini API...'); 
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();
    console.log('Gemini response received'); 
    
    res.json({ response });
  } catch (error) {
    console.error('Detailed chat error:', error); // detailed error
    res.status(500).json({ error: `Failed to get response: ${error.message}` });
  }
});

app.delete('/api/documents/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'data', 'documents', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
