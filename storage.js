// Storage manager for local data persistence

class Storage {
    constructor() {
        this.prefix = 'lanmessenger_';
    }

    // User preferences
    setUsername(username) {
        localStorage.setItem(this.prefix + 'username', username);
    }

    getUsername() {
        return localStorage.getItem(this.prefix + 'username') || 'Anonymous';
    }

    // Message history
    saveMessage(peerId, message) {
        const key = this.prefix + 'messages_' + peerId;
        let messages = this.getMessages(peerId);
        messages.push(message);

        // Keep only last 1000 messages per peer
        if (messages.length > 1000) {
            messages = messages.slice(-1000);
        }

        localStorage.setItem(key, JSON.stringify(messages));
    }

    getMessages(peerId) {
        const key = this.prefix + 'messages_' + peerId;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    clearMessages(peerId) {
        const key = this.prefix + 'messages_' + peerId;
        localStorage.removeItem(key);
    }

    // Peer information cache
    savePeerInfo(peerId, info) {
        const key = this.prefix + 'peer_' + peerId;
        localStorage.setItem(key, JSON.stringify(info));
    }

    getPeerInfo(peerId) {
        const key = this.prefix + 'peer_' + peerId;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    // Get all stored peer IDs
    getAllPeerIds() {
        const peerIds = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix + 'messages_')) {
                peerIds.push(key.replace(this.prefix + 'messages_', ''));
            }
        }
        return peerIds;
    }

    // Clear all data
    clearAll() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
}

module.exports = Storage;
