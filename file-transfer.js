// File transfer handler
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

class FileTransfer extends EventEmitter {
    constructor(messageHandler) {
        super();
        this.messageHandler = messageHandler;
        this.CHUNK_SIZE = 16384; // 16KB chunks

        // Outgoing transfers
        this.outgoingTransfers = new Map(); // fileId -> { file, peerId, fileName, fileSize, chunks, currentChunk }

        // Incoming transfers
        this.incomingTransfers = new Map(); // fileId -> { fileName, fileSize, chunks, receivedChunks }

        this.setupListeners();
    }

    setupListeners() {
        this.messageHandler.on('file-accept', ({ peerId, fileId }) => {
            this.startTransfer(fileId);
        });

        this.messageHandler.on('file-reject', ({ peerId, fileId }) => {
            this.emit('transfer-rejected', { fileId: fileId, peerId: peerId });
            this.outgoingTransfers.delete(fileId);
        });

        this.messageHandler.on('file-chunk', ({ peerId, fileId, chunkIndex, data, isLast }) => {
            this.receiveChunk(peerId, fileId, chunkIndex, data, isLast);
        });
    }

    sendFile(peerId, filePath, username) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                const fileId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                const fileName = path.basename(filePath);
                const fileSize = data.length;

                // Calculate chunks
                const totalChunks = Math.ceil(fileSize / this.CHUNK_SIZE);
                const chunks = [];

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * this.CHUNK_SIZE;
                    const end = Math.min(start + this.CHUNK_SIZE, fileSize);
                    chunks.push(data.slice(start, end));
                }

                this.outgoingTransfers.set(fileId, {
                    peerId: peerId,
                    fileName: fileName,
                    fileSize: fileSize,
                    chunks: chunks,
                    currentChunk: 0
                });

                // Send file offer
                this.messageHandler.sendFileOffer(peerId, fileId, fileName, fileSize, username);

                this.emit('transfer-initiated', {
                    fileId: fileId,
                    fileName: fileName,
                    fileSize: fileSize,
                    peerId: peerId
                });

                resolve(fileId);
            });
        });
    }

    startTransfer(fileId) {
        const transfer = this.outgoingTransfers.get(fileId);
        if (!transfer) {
            return;
        }

        this.sendNextChunk(fileId);
    }

    sendNextChunk(fileId) {
        const transfer = this.outgoingTransfers.get(fileId);
        if (!transfer) {
            return;
        }

        const { peerId, chunks, currentChunk, fileName, fileSize } = transfer;

        if (currentChunk >= chunks.length) {
            // Transfer complete
            this.outgoingTransfers.delete(fileId);
            this.emit('transfer-complete', { fileId: fileId, fileName: fileName });
            return;
        }

        const chunk = chunks[currentChunk];
        const isLast = currentChunk === chunks.length - 1;

        // Convert buffer to base64 for JSON transmission
        const chunkData = chunk.toString('base64');

        this.messageHandler.sendFileChunk(peerId, fileId, currentChunk, chunkData, isLast);

        transfer.currentChunk++;

        // Emit progress
        const progress = (currentChunk + 1) / chunks.length;
        this.emit('transfer-progress', {
            fileId: fileId,
            fileName: fileName,
            progress: progress,
            sent: Math.min((currentChunk + 1) * this.CHUNK_SIZE, fileSize),
            total: fileSize
        });

        // Send next chunk after a small delay to avoid overwhelming the connection
        setTimeout(() => this.sendNextChunk(fileId), 10);
    }

    receiveChunk(peerId, fileId, chunkIndex, data, isLast) {
        let transfer = this.incomingTransfers.get(fileId);

        if (!transfer) {
            // This shouldn't happen, but handle gracefully
            return;
        }

        // Convert base64 back to buffer
        const chunkBuffer = Buffer.from(data, 'base64');
        transfer.chunks[chunkIndex] = chunkBuffer;
        transfer.receivedChunks++;

        const progress = transfer.receivedChunks / transfer.totalChunks;
        this.emit('receive-progress', {
            fileId: fileId,
            fileName: transfer.fileName,
            progress: progress,
            received: transfer.receivedChunks * this.CHUNK_SIZE,
            total: transfer.fileSize
        });

        if (isLast || transfer.receivedChunks === transfer.totalChunks) {
            // All chunks received, combine them
            const fileData = Buffer.concat(transfer.chunks);

            this.emit('file-received', {
                fileId: fileId,
                fileName: transfer.fileName,
                fileSize: transfer.fileSize,
                data: fileData,
                peerId: peerId
            });

            this.incomingTransfers.delete(fileId);
        }
    }

    acceptFile(peerId, fileId, fileName, fileSize) {
        const totalChunks = Math.ceil(fileSize / this.CHUNK_SIZE);

        this.incomingTransfers.set(fileId, {
            fileName: fileName,
            fileSize: fileSize,
            chunks: new Array(totalChunks),
            receivedChunks: 0,
            totalChunks: totalChunks
        });

        this.messageHandler.sendFileAccept(peerId, fileId);
    }

    rejectFile(peerId, fileId) {
        this.messageHandler.sendFileReject(peerId, fileId);
    }

    cancelTransfer(fileId) {
        this.outgoingTransfers.delete(fileId);
        this.incomingTransfers.delete(fileId);
    }
}

module.exports = FileTransfer;
