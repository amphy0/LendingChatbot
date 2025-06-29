//frontend js

document.addEventListener('DOMContentLoaded', function() {
    console.log('Chatbot app loaded successfully');
    
    // Initialize admin panel
    loadSystemPrompt();
    loadDocuments();
    
    // Focus on chat input
    document.getElementById('messageInput').focus();
});

function testConnection() {
    console.log("Connected to the server");
}