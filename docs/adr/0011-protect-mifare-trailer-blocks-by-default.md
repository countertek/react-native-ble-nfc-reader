# Protect MIFARE Trailer Blocks By Default

`writeBlock()` rejects MIFARE Classic sector trailer blocks unless the caller explicitly opts in with an escape hatch. Trailer blocks contain keys and access bits, so the default protects cards from accidental permanent misconfiguration while still allowing deliberate advanced writes.

