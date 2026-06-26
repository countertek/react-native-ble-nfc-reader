# Avoid Heuristic Card Type Detection

The v0.1 API exposes card presence, UID, ATR when available, and card type only when the platform SDK provides a reliable value. It does not infer MIFARE Classic from UID length, ATR shape, or other heuristics.

