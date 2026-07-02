# Use Explicit Card Monitoring By Default

The v0.2 API does not start Card Presence Event monitoring automatically when a Reader connects. Apps call `startCardMonitor()` when they need presence/removal events, while card commands such as `readCardUid()` continue to work without the monitor; this favors battery life over implicit always-on event monitoring.
