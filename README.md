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
