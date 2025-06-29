// Admin panel functionality - handles system prompt and document uploads

async function loadSystemPrompt() {
    try {
        const response = await fetch('/api/system-prompt');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('systemPrompt').value = data.prompt || '';
        }
    } catch (error) {
        console.error('Failed to load system prompt:', error);
    }
}

async function saveSystemPrompt() {
    const prompt = document.getElementById('systemPrompt').value;
    
    try {
        setLoading('savePromptBtn', true);
        
        const response = await fetch('/api/system-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (response.ok) {
            showStatus('promptStatus', 'System prompt saved!', 'success');
        } else {
            showStatus('promptStatus', 'Failed to save prompt', 'error');
        }
    } catch (error) {
        showStatus('promptStatus', 'Connection error', 'error');
    } finally {
        setLoading('savePromptBtn', false);
    }
}

function showSelectedFile() {
    const fileInput = document.getElementById('fileInput');
    const selectedFileDiv = document.getElementById('selectedFile');
    
    if (fileInput.files[0]) {
        const file = fileInput.files[0];
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // MB
        selectedFileDiv.innerHTML = `
            <strong>Selected:</strong> ${file.name} 
            <span style="color: #bdc3c7;">(${fileSize} MB, ${file.type || 'unknown type'})</span>
        `;
        selectedFileDiv.classList.add('has-file');
    } else {
        selectedFileDiv.innerHTML = '';
        selectedFileDiv.classList.remove('has-file');
    }
}

async function uploadDocument() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showStatus('uploadStatus', 'Please select a file first', 'error');
        return;
    }
    
    if (!file.type.includes('pdf') && !file.type.includes('text')) {
        showStatus('uploadStatus', 'Only PDF and TXT files are supported', 'error');
        return;
    }
    
    try {
        setLoading('uploadBtn', true);
        
        const formData = new FormData();
        formData.append('document', file);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showStatus('uploadStatus', `Document "${file.name}" uploaded successfully!`, 'success');
            fileInput.value = ''; 
            loadDocuments();
        } else {
            showStatus('uploadStatus', result.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showStatus('uploadStatus', 'Upload failed - connection error', 'error');
    } finally {
        setLoading('uploadBtn', false);
    }
}

async function loadDocuments() {
    try {
        const response = await fetch('/api/documents');
        if (response.ok) {
            const documents = await response.json();
            displayDocuments(documents);
        }
    } catch (error) {
        console.error('Failed to load documents:', error);
        document.getElementById('documentList').innerHTML = 'Failed to load documents';
    }
}

function displayDocuments(documents) {
    const listElement = document.getElementById('documentList');
    
    if (documents.length === 0) {
        listElement.innerHTML = 'No documents uploaded yet';
        return;
    }
    
    listElement.innerHTML = documents.map(doc => `
        <div class="document-item">
            <div>
                <span class="doc-name">${doc.name}</span>
                <small class="doc-size">(${doc.size || 'Unknown size'})</small>
            </div>
            <button class="delete-btn" onclick="deleteDocument('${doc.filename}')">Delete</button>
        </div>
    `).join('');
}

async function deleteDocument(filename) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/documents/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showStatus('uploadStatus', 'Document deleted successfully!', 'success');
            loadDocuments(); // Refresh the list
        } else {
            const error = await response.json();
            showStatus('uploadStatus', error.error || 'Failed to delete document', 'error');
        }
    } catch (error) {
        showStatus('uploadStatus', 'Connection error', 'error');
    }
}