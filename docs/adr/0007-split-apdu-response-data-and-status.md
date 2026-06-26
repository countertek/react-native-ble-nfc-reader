# Split APDU Response Data and Status

The public API returns APDU responses as separate response data and APDU status fields instead of one combined hex string. This keeps common caller code simple while preserving the information returned by the Reader.

