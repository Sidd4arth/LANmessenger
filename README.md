# LAN Messenger

### Installation

```bash
# Install dependencies
npm install

# Start the application
npm start

# Development mode (with DevTools)
npm run dev
```


## File Structure

```
lanmessenger1.0.20/
├── main.js              # Electron main process
├── renderer.js          # UI logic
├── index.html           # Application structure
├── styles.css           # Premium dark theme
├── discovery.js         # Peer discovery (UDP)
├── signaling.js         # WebRTC signaling
├── connection-manager.js # WebRTC connections
├── message-handler.js   # Message protocol
├── file-transfer.js     # File sharing
├── storage.js           # LocalStorage wrapper
├── utils.js             # Utility functions
└── package.json         # Dependencies
```

