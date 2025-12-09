// Peer discovery using UDP broadcast
const dgram = require('dgram');
const { EventEmitter } = require('events');
const { getLocalIpAddress } = require('./utils');

class Discovery extends EventEmitter {
    constructor(port = 41234) {
        super();
        this.port = port;
        this.socket = null;
        this.peers = new Map(); // peerId -> { ip, username, lastSeen }
        this.myId = null;
        this.myUsername = 'Anonymous';
        this.broadcastInterval = null;
        this.cleanupInterval = null;
        this.BROADCAST_INTERVAL = 3000; // 3 seconds
        this.PEER_TIMEOUT = 10000; // 10 seconds
    }

    start(myId, username) {
        this.myId = myId;
        this.myUsername = username || 'Anonymous';

        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
            console.error('Discovery socket error:', err);
            this.emit('error', err);
        });

        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });

        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`Discovery listening on ${address.address}:${address.port}`);
            this.socket.setBroadcast(true);

            // Start broadcasting presence
            this.startBroadcasting();

            // Start cleanup of stale peers
            this.startCleanup();
        });

        this.socket.bind(this.port);
    }

    handleMessage(msg, rinfo) {
        try {
            const data = JSON.parse(msg.toString());

            // Ignore our own broadcasts
            if (data.id === this.myId) {
                return;
            }

            if (data.type === 'announce') {
                const peerId = data.id;
                const existing = this.peers.get(peerId);

                if (!existing) {
                    // New peer discovered
                    const peerInfo = {
                        id: peerId,
                        ip: rinfo.address,
                        username: data.username,
                        lastSeen: Date.now()
                    };
                    this.peers.set(peerId, peerInfo);
                    this.emit('peer-discovered', peerInfo);
                } else {
                    // Update existing peer
                    existing.lastSeen = Date.now();
                    existing.username = data.username;
                    existing.ip = rinfo.address;
                }
            } else if (data.type === 'goodbye') {
                const peerId = data.id;
                if (this.peers.has(peerId)) {
                    const peerInfo = this.peers.get(peerId);
                    this.peers.delete(peerId);
                    this.emit('peer-left', peerInfo);
                }
            }
        } catch (err) {
            console.error('Error parsing discovery message:', err);
        }
    }

    startBroadcasting() {
        this.broadcastInterval = setInterval(() => {
            this.broadcast();
        }, this.BROADCAST_INTERVAL);

        // Send initial broadcast immediately
        this.broadcast();
    }

    broadcast() {
        // Don't broadcast if socket is closed or not available
        if (!this.socket) {
            return;
        }

        const message = JSON.stringify({
            type: 'announce',
            id: this.myId,
            username: this.myUsername
        });

        const broadcastAddress = this.getBroadcastAddress();

        this.socket.send(message, 0, message.length, this.port, broadcastAddress, (err) => {
            if (err) {
                console.error('Broadcast error:', err);
            }
        });
    }

    getBroadcastAddress() {
        const ip = getLocalIpAddress();
        const parts = ip.split('.');
        parts[3] = '255';
        return parts.join('.');
    }

    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const toRemove = [];

            for (const [peerId, peer] of this.peers.entries()) {
                if (now - peer.lastSeen > this.PEER_TIMEOUT) {
                    toRemove.push(peerId);
                }
            }

            toRemove.forEach(peerId => {
                const peerInfo = this.peers.get(peerId);
                this.peers.delete(peerId);
                this.emit('peer-timeout', peerInfo);
            });
        }, 2000);
    }

    updateUsername(username) {
        this.myUsername = username;
    }

    getPeers() {
        return Array.from(this.peers.values());
    }

    stop() {
        // Clear intervals first to prevent any pending broadcasts
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Send goodbye message if socket is still available
        if (this.socket) {
            try {
                const message = JSON.stringify({
                    type: 'goodbye',
                    id: this.myId
                });

                const broadcastAddress = this.getBroadcastAddress();
                this.socket.send(message, 0, message.length, this.port, broadcastAddress);
            } catch (err) {
                // Ignore errors when sending goodbye message
                console.log('Could not send goodbye message:', err.message);
            }

            // Close socket after a brief delay to allow goodbye message to send
            setTimeout(() => {
                if (this.socket) {
                    this.socket.close();
                    this.socket = null;
                }
            }, 100);
        }

        this.peers.clear();
    }
}

module.exports = Discovery;
