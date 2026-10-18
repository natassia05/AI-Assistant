// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch((err) => console.error('SW Registration Failed:', err));
  });
}

// Online / Offline Indicators
const offlineBanner = document.getElementById('offline-banner');
function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineBanner.classList.add('d-none');
  } else {
    offlineBanner.classList.remove('d-none');
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// PWA Install Prompt Handler
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('d-none');
});

installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installBtn.classList.add('d-none');
    }
    deferredPrompt = null;
  }
});

// Chat Logic
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatFeed = document.getElementById('chat-feed');
const clearBtn = document.getElementById('clear-btn');
const sendBtn = document.getElementById('send-btn');
const chipButtons = document.querySelectorAll('.chip-btn');

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(sender, text, isUser = false) {
  const group = document.createElement('div');
  group.className = 'message-group mb-3 ' + (isUser ? 'text-end' : '');

  const meta = document.createElement('div');
  meta.className = 'message-meta text-muted small text-uppercase';
  meta.innerText = `${sender} • ${getCurrentTime()}`;

  const bubble = document.createElement('div');
  bubble.className = isUser 
    ? 'user-bubble d-inline-block text-start p-3 rounded-3 mt-1' 
    : 'assistant-bubble text-start p-3 rounded-3 mt-1 border';

  if (isUser) {
    bubble.innerText = text;
  } else {
    bubble.innerHTML = marked.parse(text);
  }

  group.appendChild(meta);
  group.appendChild(bubble);
  chatFeed.appendChild(group);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return bubble;
}

// Quick chip clicks
chipButtons.forEach((chip) => {
  chip.addEventListener('click', () => {
    userInput.value = chip.innerText;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

clearBtn.addEventListener('click', () => {
  userInput.value = '';
});

// Submit user prompt
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  if (!navigator.onLine) {
    appendMessage('CLASS ASSISTANT', '⚠️ **Offline Mode:** Cannot reach Gemini AI without an internet connection.');
    return;
  }

  appendMessage('YOU (STUDENT)', text, true);
  userInput.value = '';

  // Show temporary loading indicator
  const loadingBubble = appendMessage('CLASS ASSISTANT', 'Thinking...');
  sendBtn.disabled = true;

  try {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    const response = await fetch('/api/chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({ prompt: text })
    });

    const data = await response.json();
    if (response.ok) {
      loadingBubble.innerHTML = marked.parse(data.reply);
    } else {
      loadingBubble.innerHTML = `<span class="text-danger">⚠️ ${data.error || 'Something went wrong.'}</span>`;
    }
  } catch (err) {
    loadingBubble.innerHTML = `<span class="text-danger">⚠️ Request failed: ${err.message}</span>`;
  } finally {
    sendBtn.disabled = false;
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }
});