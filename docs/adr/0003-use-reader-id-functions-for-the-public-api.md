# Use Reader ID Functions for the Public API

The v0.1 JavaScript API uses serializable Reader IDs passed to functions instead of ReaderConnection objects with methods. This keeps the Expo native bridge simple, makes resource cleanup explicit, and avoids JavaScript objects pretending to own native Reader sessions.

