# Keep MIFARE Key Loading Internal

The public MIFARE API exposes `authenticateBlock()` with the key supplied by the caller, while any Reader-specific key loading remains internal. This avoids exposing volatile key slots or ACS command sequencing unless a future workflow proves it is needed.

