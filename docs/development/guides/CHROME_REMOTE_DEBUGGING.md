# Chrome Remote Debugging Setup for Ekklesia

**Purpose**: Enable AI assistant (Claude Code) to read browser console logs, network requests, and JavaScript errors in real-time.

**Status**: ✅ Ready for use
**Last Updated**: 2025-10-30

---

## Quick Start

### 1. Start Chrome with Remote Debugging

```bash
# Linux/Fedora
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# OR add alias to ~/.bashrc for convenience
alias chrome-debug='google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug'
```

**Important Notes:**
- `--remote-debugging-port=9222` - Opens Chrome DevTools Protocol on port 9222
- `--user-data-dir=/tmp/chrome-debug` - Uses separate profile (keeps your main Chrome session intact)
- Chrome will open as a separate instance with a yellow warning bar: "Chrome is being controlled by automated test software"

### 2. Verify Remote Debugging is Active

Open in any browser (including the debug Chrome instance):
```
http://localhost:9222/json
```

You should see JSON output listing all open tabs:
```json
[
  {
    "description": "",
    "devtoolsFrontendUrl": "/devtools/inspector.html?ws=localhost:9222/devtools/page/...",
    "id": "...",
    "title": "Ekklesia Dashboard",
    "type": "page",
    "url": "https://ekklesia-prod-10-2025.web.app/members-area/dashboard.html",
    "webSocketDebuggerUrl": "ws://localhost:9222/devtools/page/..."
  }
]
```

### 3. Navigate to Ekklesia

In the debug Chrome window, navigate to:
- Dashboard: https://ekklesia-prod-10-2025.web.app/members-area/dashboard.html
- Admin: https://ekklesia-prod-10-2025.web.app/admin/admin.html

---

## Usage from Claude Code

Once Chrome is running with remote debugging, Claude Code can:

### Read Console Logs
```bash
# Using CDP monitor script (see below)
python3 /tmp/chrome_console_monitor.py
```

### Inspect Current Page State
```bash
# Get page title and URL
curl http://localhost:9222/json | jq '.[0] | {title, url}'
```

### Execute JavaScript
```bash
# Via CDP protocol
# (requires chromote or playwright)
```

---

## Advanced: Permanent Setup

### Add to ~/.bashrc

```bash
# Ekklesia Chrome Remote Debugging
alias chrome-debug='google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug'
alias chrome-debug-check='curl -s http://localhost:9222/json | jq ".[0] | {title, url}"'
```

Then reload:
```bash
source ~/.bashrc
```

### Systemd Service (Optional - Auto-start on boot)

Create `/etc/systemd/user/chrome-debug.service`:

```ini
[Unit]
Description=Chrome Remote Debugging for Ekklesia Development
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug --no-first-run
Restart=on-failure

[Install]
WantedBy=default.target
```

Enable and start:
```bash
systemctl --user enable chrome-debug
systemctl --user start chrome-debug
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 9222
lsof -i :9222

# Kill existing Chrome debug instance
pkill -f "chrome.*remote-debugging-port=9222"
```

### Chrome Won't Connect

```bash
# Check if Chrome is running with debugging enabled
ps aux | grep "remote-debugging-port"

# Check firewall (should not be needed for localhost)
sudo firewall-cmd --list-ports
```

### Can't Access from AI Assistant

Make sure:
1. Chrome is running with `--remote-debugging-port=9222`
2. You can access http://localhost:9222/json in a browser
3. The CDP monitor script is running (see next section)

---

## Security Notes

⚠️ **IMPORTANT**: Remote debugging exposes browser control on localhost.

**Safe**:
- ✅ Using `--user-data-dir=/tmp/chrome-debug` (separate profile)
- ✅ Only accessible on localhost (not network)
- ✅ Temporary profile is deleted on reboot

**DO NOT**:
- ❌ Run with your main Chrome profile
- ❌ Expose port 9222 to the network
- ❌ Leave running when not developing

**Best Practice**: Only run chrome-debug when actively developing with AI assistant.

---

## Related Documentation

- [Chrome DevTools Protocol Documentation](https://chromedevtools.github.io/devtools-protocol/)
- [CDP Monitor Script](../../../scripts/chrome_console_monitor.py)
- [Ekklesia Debug Logging](./DEBUG_LOGGING.md)

---

**Status**: ✅ Ready to use
**Next Steps**: Run `chrome-debug` alias and start monitoring
