# Raw Transmit Returns Status, Helpers Throw

Raw `transmit()` returns APDU response data and APDU status without treating non-`9000` statuses as exceptions. Higher-level MIFARE helpers throw typed errors for failed semantic operations and include the APDU status when one is available.

