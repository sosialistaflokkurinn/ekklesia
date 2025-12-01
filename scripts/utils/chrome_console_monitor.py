#!/usr/bin/env python3
"""
Ekklesia Chrome Console Monitor

Connects to Chrome via CDP (Chrome DevTools Protocol) and monitors console logs.
Logs are written to stdout and optionally to a file.

Requirements:
    pip install websockets asyncio

Usage:
    python3 chrome_console_monitor.py
    python3 chrome_console_monitor.py --output /tmp/ekklesia-console.log
    python3 chrome_console_monitor.py --filter "EKKLESIA"
"""

import asyncio
import json
import sys
import argparse
import websockets
import urllib.request
from datetime import datetime
from typing import Dict, Any, Optional


class ChromeConsoleMonitor:
    def __init__(self, port=9222, output_file=None, filter_text=None):
        self.port = port
        self.output_file = output_file
        self.filter_text = filter_text
        self.websocket = None
        self.message_id = 0

    def get_websocket_url(self) -> str:
        """Get WebSocket URL for the first Chrome tab"""
        try:
            url = f"http://localhost:{self.port}/json"
            with urllib.request.urlopen(url, timeout=5) as response:
                tabs = json.loads(response.read().decode())

                if not tabs:
                    raise Exception("No Chrome tabs found")

                # Get first tab's WebSocket URL
                return tabs[0]["webSocketDebuggerUrl"]

        except Exception as e:
            print(f"❌ Error: Could not connect to Chrome DevTools Protocol on port {self.port}")
            print(f"   {str(e)}")
            print(f"\n💡 Make sure Chrome is running with remote debugging:")
            print(f"   google-chrome --remote-debugging-port={self.port} --user-data-dir=/tmp/chrome-debug")
            sys.exit(1)

    async def send_command(self, method, params=None):
        """Send CDP command"""
        self.message_id += 1
        message = {
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        await self.websocket.send(json.dumps(message))
        return self.message_id

    def format_log(self, entry: Dict[str, Any]) -> str:
        """Format console log entry for output"""
        timestamp = datetime.now().isoformat()
        level = entry.get("level", "log").upper()

        # Extract message
        args = entry.get("args", [])
        if args:
            # Try to get string representation
            messages = []
            for arg in args:
                if arg.get("type") == "string":
                    messages.append(arg.get("value", ""))
                elif "description" in arg:
                    messages.append(arg["description"])
                elif "value" in arg:
                    messages.append(str(arg["value"]))

            message = " ".join(messages)
        else:
            message = entry.get("text", "")

        # Emoji for log level
        emoji = {
            "LOG": "📝",
            "INFO": "ℹ️",
            "WARN": "⚠️",
            "ERROR": "❌",
            "DEBUG": "🔍"
        }.get(level, "📝")

        return f"{emoji} [{timestamp}] {level}: {message}"

    def write_output(self, text: str) -> None:
        """Write to stdout and optionally to file"""
        print(text, flush=True)

        if self.output_file:
            try:
                with open(self.output_file, "a") as f:
                    f.write(text + "\n")
            except Exception as e:
                print(f"⚠️  Warning: Could not write to {self.output_file}: {e}", file=sys.stderr)

    async def handle_message(self, message):
        """Handle incoming CDP message"""
        try:
            data = json.loads(message)

            # Handle console message
            if data.get("method") == "Runtime.consoleAPICalled":
                params = data.get("params", {})
                entry = params

                formatted = self.format_log(entry)

                # Apply filter if specified
                if self.filter_text:
                    if self.filter_text.lower() in formatted.lower():
                        self.write_output(formatted)
                else:
                    self.write_output(formatted)

            # Handle exception thrown
            elif data.get("method") == "Runtime.exceptionThrown":
                params = data.get("params", {})
                exception = params.get("exceptionDetails", {})
                text = exception.get("text", "Exception")

                # Get stack trace if available
                stack = exception.get("stackTrace", {})
                call_frames = stack.get("callFrames", [])

                formatted = f"❌ [{datetime.now().isoformat()}] EXCEPTION: {text}"
                if call_frames:
                    first_frame = call_frames[0]
                    url = first_frame.get("url", "")
                    line = first_frame.get("lineNumber", 0)
                    formatted += f" at {url}:{line}"

                self.write_output(formatted)

        except Exception as e:
            print(f"⚠️  Error handling message: {e}", file=sys.stderr)

    async def monitor(self):
        """Main monitoring loop"""
        ws_url = self.get_websocket_url()

        print(f"🔗 Connecting to Chrome DevTools Protocol...")
        print(f"   WebSocket: {ws_url[:50]}...")

        try:
            async with websockets.connect(ws_url) as websocket:
                self.websocket = websocket

                print(f"✅ Connected to Chrome")
                if self.output_file:
                    print(f"📝 Logging to: {self.output_file}")
                if self.filter_text:
                    print(f"🔍 Filtering for: {self.filter_text}")
                print(f"\n{'='*60}")
                print(f"Monitoring console logs... (Press Ctrl+C to stop)")
                print(f"{'='*60}\n")

                # Enable Runtime domain to receive console logs
                await self.send_command("Runtime.enable")

                # Enable exception notifications
                await self.send_command("Runtime.setAsyncCallStackDepth", {"maxDepth": 32})

                # Listen for messages
                async for message in websocket:
                    await self.handle_message(message)

        except websockets.exceptions.WebSocketException as e:
            print(f"❌ WebSocket error: {e}", file=sys.stderr)
            sys.exit(1)
        except KeyboardInterrupt:
            print(f"\n\n{'='*60}")
            print(f"✅ Monitoring stopped")
            print(f"{'='*60}")
            sys.exit(0)


def main() -> None:
    """Main entry point for Chrome console monitoring CLI."""
    parser = argparse.ArgumentParser(
        description="Monitor Chrome console logs via Chrome DevTools Protocol"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=9222,
        help="Chrome remote debugging port (default: 9222)"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output file path (optional, logs to stdout by default)"
    )
    parser.add_argument(
        "--filter",
        type=str,
        help="Filter logs containing this text (case-insensitive)"
    )

    args = parser.parse_args()

    monitor = ChromeConsoleMonitor(
        port=args.port,
        output_file=args.output,
        filter_text=args.filter
    )

    asyncio.run(monitor.monitor())


if __name__ == "__main__":
    main()
