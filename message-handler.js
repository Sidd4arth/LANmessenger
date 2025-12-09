// Message handler for text messages
const { EventEmitter } = require('events');

class MessageHandler extends EventEmitter {
    constructor(connectionManager) {
        super();
        this.connectionManager = connectionManager;

        this.connectionManager.on('message', ({ peerId, message }) => {
            this.handleMessage(peerId, message);
        });
    }

    handleMessage(peerId, message) {
        if (message.type === 'text') {
            this.emit('text-message', {
                peerId: peerId,
                text: message.text,
                timestamp: message.timestamp,
                username: message.username
            });
        } else if (message.type === 'file-offer') {
            this.emit('file-offer', {
                peerId: peerId,
                fileId: message.fileId,
                fileName: message.fileName,
                fileSize: message.fileSize,
                username: message.username
            });
        } else if (message.type === 'file-accept') {
            this.emit('file-accept', {
                peerId: peerId,
                fileId: message.fileId
            });
        } else if (message.type === 'file-reject') {
            this.emit('file-reject', {
                peerId: peerId,
                fileId: message.fileId
            });
        } else if (message.type === 'file-chunk') {
            this.emit('file-chunk', {
                peerId: peerId,
                fileId: message.fileId,
                chunkIndex: message.chunkIndex,
                data: message.data,
                isLast: message.isLast
            });
        }
    }

    sendTextMessage(peerId, text, username) {
        const message = {
            type: 'text',
            text: text,
            timestamp: Date.now(),
            username: username
        };

        return this.connectionManager.send(peerId, message);
    }

    sendFileOffer(peerId, fileId, fileName, fileSize, username) {
        const message = {
            type: 'file-offer',
            fileId: fileId,
            fileName: fileName,
            fileSize: fileSize,
            username: username
        };

        return this.connectionManager.send(peerId, message);
    }

    sendFileAccept(peerId, fileId) {
        const message = {
            type: 'file-accept',
            fileId: fileId
        };

        return this.connectionManager.send(peerId, message);
    }

    sendFileReject(peerId, fileId) {
        const message = {
            type: 'file-reject',
            fileId: fileId
        };

        return this.connectionManager.send(peerId, message);
    }

    sendFileChunk(peerId, fileId, chunkIndex, data, isLast) {
        const message = {
            type: 'file-chunk',
            fileId: fileId,
            chunkIndex: chunkIndex,
            data: data,
            isLast: isLast
        };

        return this.connectionManager.send(peerId, message);
    }
}

module.exports = MessageHandler;
