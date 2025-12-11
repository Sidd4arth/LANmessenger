// WebRTC connection manager
const SimplePeer = require('simple-peer');
const { EventEmitter } = require('events');
const wrtc = require('@roamhq/wrtc');

class ConnectionManager extends EventEmitter {
    constructor(signaling) {
        super();
        this.signaling = signaling;
        this.connections = new Map(); // peerId -> { peer, ip, username }
        this.pendingConnections = new Map(); // peerId -> peer

        this.signaling.on('signal', (data, rinfo) => {
            this.handleSignal(data, rinfo);
        });
    }

    connect(peerId, peerIp, username, initiator = true) {
        // Don't create duplicate connections
        if (this.connections.has(peerId) || this.pendingConnections.has(peerId)) {
            return;
        }

        console.log(`${initiator ? 'Initiating' : 'Accepting'} connection to ${username} (${peerId})`);

        const peer = new SimplePeer({
            initiator: initiator,
            trickle: true,
            wrtc: wrtc, // Use @roamhq/wrtc for Node.js/Electron main process
            config: {
                iceServers: [] // LAN only, no STUN/TURN needed
            }
        });

        this.pendingConnections.set(peerId, peer);

        peer.on('signal', (signal) => {
            // Send signaling data to peer
            this.signaling.send(peerIp, {
                type: 'webrtc-signal',
                from: this.myId,
                to: peerId,
                signal: signal
            });
        });

        peer.on('connect', () => {
            console.log(`Connected to ${username}`);
            this.pendingConnections.delete(peerId);
            this.connections.set(peerId, {
                peer: peer,
                ip: peerIp,
                username: username
            });
            this.emit('peer-connected', { id: peerId, username: username });
        });

        peer.on('data', (data) => {
            this.handleData(peerId, data);
        });

        peer.on('error', (err) => {
            console.error(`Connection error with ${peerId}:`, err);
            this.pendingConnections.delete(peerId);
            this.emit('peer-error', { id: peerId, error: err });
        });

        peer.on('close', () => {
            console.log(`Connection closed with ${username}`);
            this.connections.delete(peerId);
            this.pendingConnections.delete(peerId);
            this.emit('peer-disconnected', { id: peerId });
        });

        return peer;
    }

    handleSignal(data, rinfo) {
        if (data.type !== 'webrtc-signal') {
            return;
        }

        const peerId = data.from;
        const signal = data.signal;

        let peer = this.pendingConnections.get(peerId);

        if (!peer && !this.connections.has(peerId)) {
            // We don't have a connection to this peer yet, they're initiating
            // We need peer info from discovery
            this.emit('connection-request', { id: peerId, ip: rinfo.address, signal: signal });
            return;
        }

        if (peer) {
            try {
                peer.signal(signal);
            } catch (err) {
                console.error('Error signaling peer:', err);
            }
        }
    }

    acceptConnection(peerId, peerIp, username, initialSignal) {
        const peer = this.connect(peerId, peerIp, username, false);
        if (peer && initialSignal) {
            try {
                peer.signal(initialSignal);
            } catch (err) {
                console.error('Error accepting connection:', err);
            }
        }
    }

    send(peerId, data) {
        const conn = this.connections.get(peerId);
        if (conn && conn.peer) {
            try {
                const message = typeof data === 'string' ? data : JSON.stringify(data);
                conn.peer.send(message);
                return true;
            } catch (err) {
                console.error('Error sending data:', err);
                return false;
            }
        }
        return false;
    }

    handleData(peerId, data) {
        try {
            const message = JSON.parse(data.toString());
            this.emit('message', { peerId: peerId, message: message });
        } catch (err) {
            // Not JSON, treat as raw data
            this.emit('data', { peerId: peerId, data: data });
        }
    }

    disconnect(peerId) {
        const conn = this.connections.get(peerId);
        if (conn && conn.peer) {
            conn.peer.destroy();
        }
        this.connections.delete(peerId);
        this.pendingConnections.delete(peerId);
    }

    disconnectAll() {
        // Disconnect active connections
        for (const [peerId, conn] of this.connections.entries()) {
            if (conn.peer) {
                try {
                    conn.peer.destroy();
                } catch (err) {
                    console.log(`Error destroying peer ${peerId}:`, err.message);
                }
            }
        }

        // Disconnect pending connections
        for (const [peerId, peer] of this.pendingConnections.entries()) {
            if (peer) {
                try {
                    peer.destroy();
                } catch (err) {
                    console.log(`Error destroying pending peer ${peerId}:`, err.message);
                }
            }
        }

        this.connections.clear();
        this.pendingConnections.clear();
    }

    isConnected(peerId) {
        return this.connections.has(peerId);
    }

    getConnection(peerId) {
        return this.connections.get(peerId);
    }

    setMyId(id) {
        this.myId = id;
    }
}

module.exports = ConnectionManager;
