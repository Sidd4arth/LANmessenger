# LAN Messenger

A beautiful, serverless peer-to-peer chat application for local area networks.

![Version](https://img.shields.io/badge/version-1.0.20-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🚀 **Serverless** - No central server required, fully peer-to-peer
- 🔍 **Auto-Discovery** - Automatically finds peers on your LAN
- 💬 **Instant Messaging** - Real-time text chat via WebRTC
- 📁 **File Sharing** - Send files of any size with progress tracking
- 💾 **Message History** - Persistent local storage of conversations
- 🎨 **Premium UI** - Modern dark theme with glassmorphism effects
- 🔒 **Private** - All communication stays on your local network

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start the application
npm start

# Development mode (with DevTools)
npm run dev
```

### Usage

1. **Set your username** in the input field at the top
2. **Wait for peers** to appear in the sidebar (automatic discovery)
3. **Click on a peer** to start chatting
4. **Send messages** by typing and pressing Enter
5. **Share files** by clicking the + button

## How It Works

### Architecture

- **Peer Discovery**: UDP broadcast on port 41234
- **Signaling**: UDP messaging on port 41235
- **Data Transfer**: WebRTC peer-to-peer data channels
- **Storage**: LocalStorage for message history

### Technology Stack

- **Electron** - Cross-platform desktop app framework
- **WebRTC** - Peer-to-peer communication (via SimplePeer)
- **UDP** - Network discovery and signaling
- **HTML/CSS/JS** - Modern web technologies

## Network Requirements

- All devices must be on the same local network
- UDP ports 41234 and 41235 must be accessible
- No internet connection required

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

## Troubleshooting

**Peers not appearing?**
- Ensure all devices are on the same network
- Check firewall settings
- Verify UDP ports are not blocked

**Connection fails?**
- Restart both applications
- Check network allows P2P connections

**File transfer issues?**
- Ensure stable connection
- Check available disk space

## Future Enhancements

- [ ] Group chat support
- [ ] End-to-end encryption
- [ ] Voice/video calls
- [ ] Screen sharing
- [ ] Desktop notifications
- [ ] Mobile app version

## License

MIT License - feel free to use and modify!

## Credits

Built with ❤️ using Electron and WebRTC
