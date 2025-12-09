// Electron main process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Discovery = require('./discovery');
const Signaling = require('./signaling');
const ConnectionManager = require('./connection-manager');
const MessageHandler = require('./message-handler');
const FileTransfer = require('./file-transfer');
const { generateId } = require('./utils');
const fs = require('fs');

let mainWindow;
let discovery;
let signaling;
let connectionManager;
let messageHandler;
let fileTransfer;
let myId;
let myUsername = 'Anonymous';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#0f0f1e',
        titleBarStyle: 'default',
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('index.html');

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function initializeNetworking() {
    myId = generateId();

    // Initialize discovery
    discovery = new Discovery();
    discovery.start(myId, myUsername);

    // Initialize signaling
    signaling = new Signaling();
    signaling.start();

    // Initialize connection manager
    connectionManager = new ConnectionManager(signaling);
    connectionManager.setMyId(myId);

    // Initialize message handler
    messageHandler = new MessageHandler(connectionManager);

    // Initialize file transfer
    fileTransfer = new FileTransfer(messageHandler);

    setupEventHandlers();
}

function setupEventHandlers() {
    // Discovery events
    discovery.on('peer-discovered', (peer) => {
        console.log('Peer discovered:', peer);
        mainWindow.webContents.send('peer-discovered', peer);
    });

    discovery.on('peer-left', (peer) => {
        console.log('Peer left:', peer);
        mainWindow.webContents.send('peer-left', peer);
    });

    discovery.on('peer-timeout', (peer) => {
        console.log('Peer timeout:', peer);
        mainWindow.webContents.send('peer-timeout', peer);
    });

    // Connection events
    connectionManager.on('peer-connected', (data) => {
        console.log('Peer connected:', data);
        mainWindow.webContents.send('peer-connected', data);
    });

    connectionManager.on('peer-disconnected', (data) => {
        console.log('Peer disconnected:', data);
        mainWindow.webContents.send('peer-disconnected', data);
    });

    connectionManager.on('connection-request', ({ id, ip, signal }) => {
        // Auto-accept connection requests
        const peers = discovery.getPeers();
        const peer = peers.find(p => p.id === id);
        if (peer) {
            connectionManager.acceptConnection(id, ip, peer.username, signal);
        }
    });

    // Message events
    messageHandler.on('text-message', (data) => {
        mainWindow.webContents.send('text-message', data);
    });

    messageHandler.on('file-offer', (data) => {
        mainWindow.webContents.send('file-offer', data);
    });

    // File transfer events
    fileTransfer.on('transfer-initiated', (data) => {
        mainWindow.webContents.send('transfer-initiated', data);
    });

    fileTransfer.on('transfer-progress', (data) => {
        mainWindow.webContents.send('transfer-progress', data);
    });

    fileTransfer.on('transfer-complete', (data) => {
        mainWindow.webContents.send('transfer-complete', data);
    });

    fileTransfer.on('receive-progress', (data) => {
        mainWindow.webContents.send('receive-progress', data);
    });

    fileTransfer.on('file-received', (data) => {
        mainWindow.webContents.send('file-received', data);
    });
}

// IPC handlers
ipcMain.on('set-username', (event, username) => {
    myUsername = username;
    discovery.updateUsername(username);
});

ipcMain.on('get-my-id', (event) => {
    event.returnValue = myId;
});

ipcMain.on('get-peers', (event) => {
    const peers = discovery.getPeers();
    event.returnValue = peers;
});

ipcMain.on('connect-to-peer', (event, { peerId, peerIp, username }) => {
    connectionManager.connect(peerId, peerIp, username, true);
});

ipcMain.on('send-message', (event, { peerId, text }) => {
    messageHandler.sendTextMessage(peerId, text, myUsername);
});

ipcMain.on('send-file', async (event, { peerId }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select file to send'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            const fileId = await fileTransfer.sendFile(peerId, filePath, myUsername);
            event.reply('file-send-started', { fileId: fileId, filePath: filePath });
        } catch (err) {
            console.error('Error sending file:', err);
            event.reply('file-send-error', { error: err.message });
        }
    }
});

ipcMain.on('accept-file', (event, { peerId, fileId, fileName, fileSize }) => {
    fileTransfer.acceptFile(peerId, fileId, fileName, fileSize);
});

ipcMain.on('reject-file', (event, { peerId, fileId }) => {
    fileTransfer.rejectFile(peerId, fileId);
});

ipcMain.on('save-file', async (event, { fileName, data }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        title: 'Save file'
    });

    if (!result.canceled && result.filePath) {
        fs.writeFile(result.filePath, Buffer.from(data), (err) => {
            if (err) {
                console.error('Error saving file:', err);
                event.reply('file-save-error', { error: err.message });
            } else {
                event.reply('file-saved', { filePath: result.filePath });
            }
        });
    }
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    initializeNetworking();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (discovery) discovery.stop();
    if (signaling) signaling.stop();
    if (connectionManager) connectionManager.disconnectAll();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (discovery) discovery.stop();
    if (signaling) signaling.stop();
    if (connectionManager) connectionManager.disconnectAll();
});
