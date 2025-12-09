// Renderer process - UI logic
const { ipcRenderer } = require('electron');
const { formatTime, formatFileSize, sanitizeHtml } = require('./utils');

// State
let myId = null;
let currentPeerId = null;
let peers = new Map(); // peerId -> { id, username, ip, connected }
let messages = new Map(); // peerId -> [messages]
let fileTransfers = new Map(); // fileId -> { peerId, fileName, fileSize, type }
let pendingFileOffer = null;

// DOM Elements
const usernameInput = document.getElementById('username-input');
const peersList = document.getElementById('peers-list');
const peerCount = document.getElementById('peer-count');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const inputArea = document.getElementById('input-area');
const currentPeerName = document.getElementById('current-peer-name');
const connectionStatus = document.getElementById('connection-status');
const fileModal = document.getElementById('file-modal');
const closeModalBtn = document.getElementById('close-modal');
const acceptFileBtn = document.getElementById('accept-file-btn');
const rejectFileBtn = document.getElementById('reject-file-btn');

// Initialize
function init() {
    myId = ipcRenderer.sendSync('get-my-id');

    // Load username from storage
    const savedUsername = localStorage.getItem('lanmessenger_username');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        ipcRenderer.send('set-username', savedUsername);
    }

    setupEventListeners();
    setupIpcListeners();
}

// Event Listeners
function setupEventListeners() {
    // Username change
    usernameInput.addEventListener('change', () => {
        const username = usernameInput.value.trim() || 'Anonymous';
        localStorage.setItem('lanmessenger_username', username);
        ipcRenderer.send('set-username', username);
    });

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // Attach file
    attachBtn.addEventListener('click', () => {
        if (currentPeerId) {
            ipcRenderer.send('send-file', { peerId: currentPeerId });
        }
    });

    // Modal
    closeModalBtn.addEventListener('click', closeFileModal);
    acceptFileBtn.addEventListener('click', acceptFile);
    rejectFileBtn.addEventListener('click', rejectFile);
}

// IPC Listeners
function setupIpcListeners() {
    // Peer discovery
    ipcRenderer.on('peer-discovered', (event, peer) => {
        addPeer(peer);
    });

    ipcRenderer.on('peer-left', (event, peer) => {
        removePeer(peer.id);
    });

    ipcRenderer.on('peer-timeout', (event, peer) => {
        removePeer(peer.id);
    });

    // Connection events
    ipcRenderer.on('peer-connected', (event, data) => {
        const peer = peers.get(data.id);
        if (peer) {
            peer.connected = true;
            updatePeerItem(data.id);

            if (currentPeerId === data.id) {
                updateConnectionStatus('Connected');
            }
        }
    });

    ipcRenderer.on('peer-disconnected', (event, data) => {
        const peer = peers.get(data.id);
        if (peer) {
            peer.connected = false;
            updatePeerItem(data.id);

            if (currentPeerId === data.id) {
                updateConnectionStatus('Disconnected');
            }
        }
    });

    // Messages
    ipcRenderer.on('text-message', (event, data) => {
        addMessage(data.peerId, {
            type: 'text',
            text: data.text,
            timestamp: data.timestamp,
            sender: data.username,
            received: true
        });
    });

    // File transfer
    ipcRenderer.on('file-offer', (event, data) => {
        showFileOffer(data);
    });

    ipcRenderer.on('transfer-progress', (event, data) => {
        updateFileProgress(data.fileId, data.progress, data.sent, data.total);
    });

    ipcRenderer.on('transfer-complete', (event, data) => {
        completeFileTransfer(data.fileId);
    });

    ipcRenderer.on('receive-progress', (event, data) => {
        updateFileProgress(data.fileId, data.progress, data.received, data.total);
    });

    ipcRenderer.on('file-received', (event, data) => {
        handleFileReceived(data);
    });
}

// Peer Management
function addPeer(peer) {
    peers.set(peer.id, {
        id: peer.id,
        username: peer.username,
        ip: peer.ip,
        connected: false
    });

    renderPeersList();
}

function removePeer(peerId) {
    peers.delete(peerId);
    renderPeersList();

    if (currentPeerId === peerId) {
        currentPeerId = null;
        showWelcomeScreen();
    }
}

function updatePeerItem(peerId) {
    const peerElement = document.querySelector(`[data-peer-id="${peerId}"]`);
    if (peerElement) {
        const peer = peers.get(peerId);
        const statusDot = peerElement.querySelector('.peer-status-dot');
        const statusText = peerElement.querySelector('.peer-status');

        if (peer.connected) {
            statusDot.style.background = 'var(--success)';
            statusText.textContent = 'Connected';
        } else {
            statusDot.style.background = 'var(--text-muted)';
            statusText.textContent = 'Available';
        }
    }
}

function renderPeersList() {
    peerCount.textContent = peers.size;

    if (peers.size === 0) {
        peersList.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
          <path d="M32 20v24M20 32h24" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>Searching for peers...</p>
      </div>
    `;
        return;
    }

    const peersArray = Array.from(peers.values());
    peersList.innerHTML = peersArray.map(peer => {
        const initial = peer.username.charAt(0).toUpperCase();
        const isActive = currentPeerId === peer.id;
        const statusText = peer.connected ? 'Connected' : 'Available';
        const statusColor = peer.connected ? 'var(--success)' : 'var(--text-muted)';

        return `
      <div class="peer-item ${isActive ? 'active' : ''}" data-peer-id="${peer.id}">
        <div class="peer-avatar">${initial}</div>
        <div class="peer-info">
          <div class="peer-name">${sanitizeHtml(peer.username)}</div>
          <div class="peer-status">
            <span class="peer-status-dot" style="background: ${statusColor}"></span>
            ${statusText}
          </div>
        </div>
      </div>
    `;
    }).join('');

    // Add click listeners
    document.querySelectorAll('.peer-item').forEach(item => {
        item.addEventListener('click', () => {
            const peerId = item.dataset.peerId;
            selectPeer(peerId);
        });
    });
}

function selectPeer(peerId) {
    const peer = peers.get(peerId);
    if (!peer) return;

    currentPeerId = peerId;

    // Update UI
    renderPeersList();
    currentPeerName.textContent = peer.username;
    inputArea.style.display = 'flex';

    // Connect if not connected
    if (!peer.connected) {
        ipcRenderer.send('connect-to-peer', {
            peerId: peer.id,
            peerIp: peer.ip,
            username: peer.username
        });
        updateConnectionStatus('Connecting...');
    } else {
        updateConnectionStatus('Connected');
    }

    // Load messages
    renderMessages(peerId);
}

function updateConnectionStatus(status) {
    connectionStatus.textContent = status;
}

// Message Management
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentPeerId) return;

    const peer = peers.get(currentPeerId);
    if (!peer || !peer.connected) {
        alert('Not connected to peer');
        return;
    }

    // Send message
    ipcRenderer.send('send-message', {
        peerId: currentPeerId,
        text: text
    });

    // Add to local messages
    addMessage(currentPeerId, {
        type: 'text',
        text: text,
        timestamp: Date.now(),
        sender: usernameInput.value || 'You',
        received: false
    });

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
}

function addMessage(peerId, message) {
    if (!messages.has(peerId)) {
        messages.set(peerId, []);
    }

    messages.get(peerId).push(message);

    // Save to storage
    saveMessageToStorage(peerId, message);

    // Render if this is the current peer
    if (peerId === currentPeerId) {
        renderMessages(peerId);
    }
}

function renderMessages(peerId) {
    const peerMessages = messages.get(peerId) || loadMessagesFromStorage(peerId);

    if (!peerMessages || peerMessages.length === 0) {
        messagesContainer.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-content">
          <h2>Start chatting!</h2>
          <p>Send a message to begin the conversation</p>
        </div>
      </div>
    `;
        return;
    }

    const peer = peers.get(peerId);
    const peerInitial = peer ? peer.username.charAt(0).toUpperCase() : '?';
    const myInitial = (usernameInput.value || 'A').charAt(0).toUpperCase();

    messagesContainer.innerHTML = peerMessages.map(msg => {
        const isReceived = msg.received;
        const initial = isReceived ? peerInitial : myInitial;
        const sender = isReceived ? msg.sender : 'You';

        if (msg.type === 'text') {
            return `
        <div class="message ${isReceived ? 'received' : 'sent'}">
          <div class="message-avatar">${initial}</div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-sender">${sanitizeHtml(sender)}</span>
              <span class="message-time">${formatTime(msg.timestamp)}</span>
            </div>
            <div class="message-bubble">
              <div class="message-text">${sanitizeHtml(msg.text)}</div>
            </div>
          </div>
        </div>
      `;
        } else if (msg.type === 'file') {
            const progress = msg.progress || 0;
            const progressText = msg.progressText || '';

            return `
        <div class="message ${isReceived ? 'received' : 'sent'}">
          <div class="message-avatar">${initial}</div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-sender">${sanitizeHtml(sender)}</span>
              <span class="message-time">${formatTime(msg.timestamp)}</span>
            </div>
            <div class="message-bubble">
              <div class="file-message" data-file-id="${msg.fileId}">
                <div class="file-icon-wrapper">📁</div>
                <div class="file-details">
                  <div class="file-name">${sanitizeHtml(msg.fileName)}</div>
                  <div class="file-size">${formatFileSize(msg.fileSize)} ${progressText}</div>
                  ${progress < 1 && progress > 0 ? `
                    <div class="file-progress">
                      <div class="file-progress-bar" style="width: ${progress * 100}%"></div>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
        }
    }).join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showWelcomeScreen() {
    currentPeerName.textContent = 'Select a peer to start chatting';
    connectionStatus.textContent = '';
    inputArea.style.display = 'none';

    messagesContainer.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-content">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="55" stroke="url(#welcomeGradient)" stroke-width="3" opacity="0.3"/>
          <circle cx="60" cy="60" r="40" stroke="url(#welcomeGradient)" stroke-width="3" opacity="0.5"/>
          <circle cx="60" cy="60" r="25" fill="url(#welcomeGradient)" opacity="0.7"/>
          <defs>
            <linearGradient id="welcomeGradient" x1="0" y1="0" x2="120" y2="120">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
          </defs>
        </svg>
        <h2>Welcome to LAN Messenger</h2>
        <p>Select a peer from the sidebar to start chatting</p>
        <div class="features">
          <div class="feature">
            <span class="feature-icon">💬</span>
            <span>Instant messaging</span>
          </div>
          <div class="feature">
            <span class="feature-icon">📁</span>
            <span>File sharing</span>
          </div>
          <div class="feature">
            <span class="feature-icon">🔒</span>
            <span>Serverless & secure</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// File Transfer
function showFileOffer(data) {
    pendingFileOffer = data;

    document.getElementById('modal-file-name').textContent = data.fileName;
    document.getElementById('modal-file-size').textContent = formatFileSize(data.fileSize);
    document.getElementById('modal-file-sender').textContent = `From: ${data.username}`;

    fileModal.style.display = 'flex';
}

function closeFileModal() {
    fileModal.style.display = 'none';
    pendingFileOffer = null;
}

function acceptFile() {
    if (!pendingFileOffer) return;

    const { peerId, fileId, fileName, fileSize } = pendingFileOffer;

    ipcRenderer.send('accept-file', { peerId, fileId, fileName, fileSize });

    // Add file message
    addMessage(peerId, {
        type: 'file',
        fileId: fileId,
        fileName: fileName,
        fileSize: fileSize,
        timestamp: Date.now(),
        sender: pendingFileOffer.username,
        received: true,
        progress: 0,
        progressText: 'Receiving...'
    });

    fileTransfers.set(fileId, { peerId, fileName, fileSize, type: 'receive' });

    closeFileModal();
}

function rejectFile() {
    if (!pendingFileOffer) return;

    ipcRenderer.send('reject-file', {
        peerId: pendingFileOffer.peerId,
        fileId: pendingFileOffer.fileId
    });

    closeFileModal();
}

function updateFileProgress(fileId, progress, current, total) {
    const transfer = fileTransfers.get(fileId);
    if (!transfer) return;

    const peerMessages = messages.get(transfer.peerId);
    if (!peerMessages) return;

    const msgIndex = peerMessages.findIndex(m => m.fileId === fileId);
    if (msgIndex === -1) return;

    peerMessages[msgIndex].progress = progress;
    peerMessages[msgIndex].progressText = `${formatFileSize(current)} / ${formatFileSize(total)}`;

    if (currentPeerId === transfer.peerId) {
        renderMessages(transfer.peerId);
    }
}

function completeFileTransfer(fileId) {
    const transfer = fileTransfers.get(fileId);
    if (!transfer) return;

    const peerMessages = messages.get(transfer.peerId);
    if (!peerMessages) return;

    const msgIndex = peerMessages.findIndex(m => m.fileId === fileId);
    if (msgIndex === -1) return;

    peerMessages[msgIndex].progress = 1;
    peerMessages[msgIndex].progressText = 'Sent';

    if (currentPeerId === transfer.peerId) {
        renderMessages(transfer.peerId);
    }

    fileTransfers.delete(fileId);
}

function handleFileReceived(data) {
    const transfer = fileTransfers.get(data.fileId);
    if (!transfer) return;

    const peerMessages = messages.get(transfer.peerId);
    if (!peerMessages) return;

    const msgIndex = peerMessages.findIndex(m => m.fileId === data.fileId);
    if (msgIndex === -1) return;

    peerMessages[msgIndex].progress = 1;
    peerMessages[msgIndex].progressText = 'Received';

    if (currentPeerId === transfer.peerId) {
        renderMessages(transfer.peerId);
    }

    // Auto-save file
    ipcRenderer.send('save-file', {
        fileName: data.fileName,
        data: Array.from(data.data)
    });

    fileTransfers.delete(data.fileId);
}

// File send initiated
ipcRenderer.on('file-send-started', (event, data) => {
    if (!currentPeerId) return;

    const fileName = data.filePath.split('\\').pop().split('/').pop();

    // Get file size
    const fs = require('fs');
    const stats = fs.statSync(data.filePath);

    addMessage(currentPeerId, {
        type: 'file',
        fileId: data.fileId,
        fileName: fileName,
        fileSize: stats.size,
        timestamp: Date.now(),
        sender: 'You',
        received: false,
        progress: 0,
        progressText: 'Sending...'
    });

    fileTransfers.set(data.fileId, {
        peerId: currentPeerId,
        fileName: fileName,
        fileSize: stats.size,
        type: 'send'
    });
});

// Storage helpers
function saveMessageToStorage(peerId, message) {
    const key = `lanmessenger_messages_${peerId}`;
    let stored = JSON.parse(localStorage.getItem(key) || '[]');
    stored.push(message);

    // Keep only last 1000 messages
    if (stored.length > 1000) {
        stored = stored.slice(-1000);
    }

    localStorage.setItem(key, JSON.stringify(stored));
}

function loadMessagesFromStorage(peerId) {
    const key = `lanmessenger_messages_${peerId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
}

// Initialize app
init();
