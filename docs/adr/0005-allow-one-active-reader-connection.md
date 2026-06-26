# Allow One Active Reader Connection

The v0.1 API may discover multiple Readers but maintains at most one active Reader connection per app process. This matches the first hotel-card workflow and keeps card state, authentication, and cleanup simple until a real multi-reader workflow appears.

