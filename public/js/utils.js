// Utility functions shared across the app

function showStatus(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="${type}">${message}</div>`;
        
        // Auto-clear after 3 seconds
        setTimeout(() => {
            element.innerHTML = '';
        }, 3000);
    }
}

function setLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = loading;
        if (loading) {
            button.classList.add('loading');
            button.textContent = 'Loading...';
        } else {
            button.classList.remove('loading');
        }
    }
}

// Simple API call wrapper
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}