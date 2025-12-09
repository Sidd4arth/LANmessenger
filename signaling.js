// Signaling for WebRTC connection establishment
const dgram = require('dgram');
const { EventEmitter } = require('events');

class Signaling extends EventEmitter {
    constructor(port = 41235) {
        super();
        this.port = port;
        this.socket = null;
    }

    start() {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
            console.error('Signaling socket error:', err);
            this.emit('error', err);
        });

        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });

        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`Signaling listening on ${address.address}:${address.port}`);
        });

        this.socket.bind(this.port);
    }

    handleMessage(msg, rinfo) {
        try {
            const data = JSON.parse(msg.toString());
            this.emit('signal', data, rinfo);
        } catch (err) {
            console.error('Error parsing signaling message:', err);
        }
    }

    send(peerIp, data) {
        // Don't send if socket is closed or not available
        if (!this.socket) {
            return;
        }

        const message = JSON.stringify(data);
        this.socket.send(message, 0, message.length, this.port, peerIp, (err) => {
            if (err) {
                console.error('Signaling send error:', err);
            }
        });
    }

    stop() {
        if (this.socket) {
            try {
                this.socket.close();
            } catch (err) {
                // Ignore errors when closing socket
                console.log('Could not close signaling socket:', err.message);
            }
            this.socket = null;
        }
    }
}

module.exports = Signaling;
