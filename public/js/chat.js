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
    
    // Create empty bot message container for streaming
    const chatMessages = document.getElementById('chatMessages');
    const botMessageDiv = document.createElement('div');
    botMessageDiv.className = 'message bot-message';
    botMessageDiv.innerHTML = ''; // Use innerHTML for markdown
    chatMessages.appendChild(botMessageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    let fullResponse = ''; // Store the complete response
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value);
            fullResponse += chunk;
            
            // Convert markdown to HTML and update display
            botMessageDiv.innerHTML = marked.parse(fullResponse);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        botMessageDiv.innerHTML = '<p class="error-text">Sorry, I encountered an error. Please try again.</p>';
    } finally {
        setLoading('sendButton', false);
        document.getElementById('sendButton').textContent = 'Send';
    }
}
// Add message to chat display
function addMessageToChat(message, sender) {
    if (sender === 'user') {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.textContent = message;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
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