# Require Explicit MIFARE Authentication Before Read Write

MIFARE `readBlock()` and `writeBlock()` require the caller to authenticate the relevant block first with `authenticateBlock()`. This matches card semantics and lets apps authenticate once before reading or writing several blocks in the same authenticated area.

