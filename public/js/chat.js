// Chat functionality

// Send message when user clicks send or presses Enter
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    
    // Clear input and disable send button
    input.value = '';
    setLoading('sendButton', true);
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            addMessageToChat(result.response, 'bot');
        } else {
            addMessageToChat('Sorry, I encountered an error: ' + result.error, 'bot');
        }
    } catch (error) {
        addMessageToChat('Sorry, I couldn\'t connect to the server.', 'bot');
    } finally {
        setLoading('sendButton', false);
        document.getElementById('sendButton').textContent = 'Send';
    }
}

// Add message to chat display
function addMessageToChat(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = message;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle Enter key in chat input
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});