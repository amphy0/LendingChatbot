# Business LLM Chatbot

A Node.js web application that creates a business chatbot with document knowledge using Google's Gemini AI. Users can upload documents (PDF/TXT) and chat with an AI that has knowledge of those documents.

## Features

- Document upload and management (PDF and TXT files)
- AI chat with document knowledge using Google Gemini
- Configurable system prompts
- Real-time streaming chat responses
- Document deletion
- Smart document chunking and relevance matching
- Markdown formatting in responses
- SQLite database for scalable document storage


## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd business-llm-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

4. **Start the development server**
   ```bash
   node chatbot.js
   ```
   Or for auto-restart during development:
   ```bash
   npm install -g nodemon
   nodemon chatbot.js   
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000`

## Usage

### Setting System Prompt
1. Use the "System Prompt" section in the left sidebar
2. Enter instructions for how the AI should behave
3. Click "Save Prompt"

### Uploading Documents
1. Click "Choose File" in the "Upload Document" section
2. Select a PDF or TXT file (you'll see the filename displayed)
3. Click "Upload"
4. The document will appear in the "Documents" list

### Chatting
1. Type your question in the chat input at the bottom
2. Press Enter or click "Send"
3. The AI will respond based on your system prompt and uploaded documents

### Managing Documents
- View all uploaded documents in the "Documents" section
- Click "Delete" next to any document to remove it

## Project Structure

```
business-llm-chatbot/
├── chatbot.js             # Main server file
├── package.json           # Dependencies and scripts
├── package-lock.json      # Dependencies and scripts
├── .env                   # Environment variables (not in git)
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── database/              # Database setup and models
│   ├── init.js            # Database initialization
│   ├── models.js          # Database operations
│   └── chatbot.db         # SQLite database (auto-created)
├── uploads/               # Temporary file upload storage
└── public/                # Frontend files
    ├── index.html         # Main HTML file
    ├── style.css          # Styling
    └── js/                # Modular JavaScript files
        ├── admin.js       # Admin panel functionality
        ├── chat.js        # Chat functionality
        ├── utils.js       # Shared utilities
        └── script.js      # Main frontend script

```

## Next Steps & Improvements

### High Priority
- **Improve Frontend** - Better UI/UX

### Medium Priority  
- ~~**Format Responses** - Markdown support, better text output formatting. Potentially images?~~

### Low Priority
- ~~**Database Integration** - Replace file storage with proper database for documents~~
- ~~**Optimize Token Usage** - Smart document chunking to reduce API costs (currently sends all documents every time)~~
- **Authentication System** - User login, admin roles, session management

## Troubleshooting

**AI response errors:** Check GEMINI_API_KEY in `.env` file and restart server

**File upload issues:** Only PDF and TXT files supported.

**Documents not loading:** Check browser or IDE console for errors.
