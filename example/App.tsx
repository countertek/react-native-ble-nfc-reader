import { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  addCardPresentListener,
  addCardRemovedListener,
  addReaderDiscoveredListener,
  BleNfcReaderError,
  connectReader,
  disconnectReader,
  getReaderPermissionStatus,
  mifare,
  Reader,
  readCardUid,
  requestReaderPermissions,
  ReaderPermissionStatus,
  scanReaders,
  stopReaderScan,
  transmit,
} from 'react-native-ble-nfc-reader';

type PermissionState = ReaderPermissionStatus | 'loading';

export default function App() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('loading');
  const [message, setMessage] = useState('');
  const [readers, setReaders] = useState<Reader[]>([]);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [cardPresent, setCardPresent] = useState(false);
  const [cardUid, setCardUid] = useState('');
  const [apduResponse, setApduResponse] = useState('');
  const [mifareBlock, setMifareBlock] = useState('4');
  const [mifareData, setMifareData] = useState('00112233445566778899AABBCCDDEEFF');
  const [mifareKey, setMifareKey] = useState('');
  const [mifareKeyType, setMifareKeyType] = useState<'A' | 'B'>('A');
  const [mifareResult, setMifareResult] = useState('');
  const [scanning, setScanning] = useState(false);

  async function refreshPermissionStatus() {
    try {
      setPermissionStatus(await getReaderPermissionStatus());
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function requestPermissions() {
    try {
      setPermissionStatus(await requestReaderPermissions());
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function scanForReaders() {
    if (permissionStatus !== 'granted') {
      setMessage('Reader permission is required before scanning. Use Request Reader Permission first.');
      return;
    }

    try {
      setScanning(true);
      setReaders([]);
      setConnectedReader(null);
      setReaders(await scanReaders({ timeoutMs: 5000 }));
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setScanning(false);
    }
  }

  async function connectToReader(readerId: string) {
    try {
      setConnectedReader(await connectReader(readerId));
      setCardPresent(false);
      setCardUid('');
      setApduResponse('');
      setMifareResult('');
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function disconnectCurrentReader() {
    if (connectedReader === null) {
      return;
    }

    try {
      await disconnectReader(connectedReader.id);
      setConnectedReader(null);
      setCardPresent(false);
      setCardUid('');
      setApduResponse('');
      setMifareResult('');
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function readUid() {
    if (connectedReader === null) {
      return;
    }

    try {
      setCardUid(await readCardUid(connectedReader.id));
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function transmitUidApdu() {
    if (connectedReader === null) {
      return;
    }

    try {
      const response = await transmit(connectedReader.id, 'FFCA000000');
      setApduResponse(`Data: ${response.responseData || '(empty)'} Status: ${response.status}`);
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function authenticateMifare(key: string) {
    if (connectedReader === null) {
      return;
    }

    const block = parseMifareBlock(mifareBlock);

    if (block === null) {
      setMessage('Enter a MIFARE data block between 0 and 255.');
      return;
    }

    try {
      await mifare.authenticateBlock({
        readerId: connectedReader.id,
        block,
        keyType: mifareKeyType,
        key,
      });
      setMifareResult(`Authenticated block ${block} with key ${mifareKeyType}`);
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function readMifareBlock() {
    if (connectedReader === null) {
      return;
    }

    const block = parseMifareBlock(mifareBlock);

    if (block === null) {
      setMessage('Enter a MIFARE data block between 0 and 255.');
      return;
    }

    try {
      setMifareResult(
        await mifare.readBlock({ readerId: connectedReader.id, block })
      );
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  function confirmWriteMifareBlock() {
    if (connectedReader === null) {
      return;
    }

    const block = parseMifareBlock(mifareBlock);

    if (block === null) {
      setMessage('Enter a MIFARE data block between 0 and 255.');
      return;
    }

    if (isMifareTrailerBlock(block)) {
      setMessage('Trailer writes are not part of this example flow. Choose a data block.');
      return;
    }

    Alert.alert(
      'Confirm block write',
      `Write ${mifareData.toUpperCase()} to MIFARE block ${block}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Write',
          style: 'destructive',
          onPress: () => {
            void writeMifareBlock(block);
          },
        },
      ]
    );
  }

  async function writeMifareBlock(block: number) {
    if (connectedReader === null) {
      return;
    }

    try {
      await mifare.writeBlock({
        readerId: connectedReader.id,
        block,
        data: mifareData,
      });
      setMifareResult(
        await mifare.readBlock({ readerId: connectedReader.id, block })
      );
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function stopScan() {
    try {
      setReaders(await stopReaderScan());
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    void refreshPermissionStatus();
  }, []);

  useEffect(() => {
    const subscription = addReaderDiscoveredListener((event) => {
      setReaders((currentReaders) => addReader(currentReaders, event.reader));
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const presentSubscription = addCardPresentListener((event) => {
      if (event.readerId !== connectedReader?.id) {
        return;
      }

      setCardPresent(true);
    });
    const removedSubscription = addCardRemovedListener((event) => {
      if (event.readerId !== connectedReader?.id) {
        return;
      }

      setCardPresent(false);
      setCardUid('');
      setApduResponse('');
      setMifareResult('');
    });

    return () => {
      presentSubscription.remove();
      removedSubscription.remove();
    };
  }, [connectedReader?.id]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.panel}>
        <Text style={styles.header}>Generic Reader Flow</Text>

        <Text style={styles.step}>1. Reader Permission</Text>
        <Text style={styles.status}>Status: {permissionStatus}</Text>
        <Button
          title="Check Reader Permission"
          onPress={refreshPermissionStatus}
          disabled={permissionStatus === 'loading'}
        />
        <Button
          title="Request Reader Permission"
          onPress={requestPermissions}
          disabled={permissionStatus === 'loading'}
        />

        <Text style={styles.step}>2. Bounded Reader Scan</Text>
        <Button
          title="Scan For Readers (5 seconds)"
          onPress={scanForReaders}
          disabled={permissionStatus !== 'granted' || scanning || connectedReader !== null}
        />
        {permissionStatus !== 'granted' && permissionStatus !== 'loading' && (
          <Text style={styles.reader}>
            Reader permission is required before scanning. Use Request Reader Permission first.
          </Text>
        )}
        <Button title="Stop Scan" onPress={stopScan} disabled={!scanning} />

        <Text style={styles.step}>3. Connect Reader</Text>
        {readers.map((reader) => {
          const connected = connectedReader?.id === reader.id;

          return (
            <View key={reader.id} style={styles.readerRow}>
              <Text style={styles.reader}>{reader.name ?? reader.id}</Text>
              <Button
                title={connected ? 'Connected' : 'Connect'}
                onPress={() => connectToReader(reader.id)}
                disabled={connectedReader !== null || scanning}
              />
            </View>
          );
        })}
        {connectedReader ? (
          <View style={styles.connectedReader}>
            <Text style={styles.status}>
              Connected: {connectedReader.name ?? connectedReader.id}
            </Text>
            <Text style={styles.reader}>{formatMetadata(connectedReader)}</Text>

            <Text style={styles.step}>4. Place Card</Text>
            <Text style={styles.status}>Card: {cardPresent ? 'present' : 'removed'}</Text>
            <Button title="Read Card UID" onPress={readUid} />
            <Button title="Transmit UID APDU" onPress={transmitUidApdu} />
            {cardUid ? <Text style={styles.reader}>UID: {cardUid}</Text> : null}
            {apduResponse ? <Text style={styles.reader}>{apduResponse}</Text> : null}

            <Text style={styles.step}>5. Authenticate MIFARE Classic Card</Text>
            <TextInput
              style={styles.input}
              value={mifareBlock}
              onChangeText={setMifareBlock}
              keyboardType="number-pad"
              placeholder="MIFARE block"
            />
            <Text style={styles.reader}>Key Type: {mifareKeyType}</Text>
            <View style={styles.keyTypeRow}>
              <Button
                title="Use Key A"
                onPress={() => setMifareKeyType('A')}
                disabled={mifareKeyType === 'A'}
              />
              <Button
                title="Use Key B"
                onPress={() => setMifareKeyType('B')}
                disabled={mifareKeyType === 'B'}
              />
            </View>
            <TextInput
              style={styles.input}
              value={mifareKey}
              onChangeText={setMifareKey}
              autoCapitalize="characters"
              autoCorrect={false}
              secureTextEntry
              placeholder="MIFARE key hex"
            />
            <Button title="Authenticate Block" onPress={() => authenticateMifare(mifareKey)} />

            <Text style={styles.step}>6. Read One Block</Text>
            <Button title="Read MIFARE Block" onPress={readMifareBlock} />

            <Text style={styles.step}>7. Confirm One Block Write</Text>
            <TextInput
              style={styles.input}
              value={mifareData}
              onChangeText={setMifareData}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="16-byte block data hex"
            />
            <Button title="Confirm Write And Read Back" onPress={confirmWriteMifareBlock} />
            {mifareResult ? <Text style={styles.reader}>MIFARE: {mifareResult}</Text> : null}

            <Text style={styles.step}>8. Disconnect</Text>
            <Button title="Disconnect Reader" onPress={disconnectCurrentReader} />
          </View>
        ) : null}
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}

function parseMifareBlock(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const block = Number(value);

  if (!Number.isInteger(block) || block < 0 || block > 255) {
    return null;
  }

  return block;
}

function isMifareTrailerBlock(block: number): boolean {
  if (block < 128) {
    return block % 4 === 3;
  }

  return (block - 143) % 16 === 0;
}

function formatMetadata(reader: Reader): string {
  const metadata = reader.metadata;

  if (metadata === undefined) {
    return 'Metadata unavailable';
  }

  const fields = [
    metadata.model ? `Model: ${metadata.model}` : undefined,
    metadata.firmwareVersion ? `Firmware: ${metadata.firmwareVersion}` : undefined,
    metadata.serialNumber ? `Serial: ${metadata.serialNumber}` : undefined,
    metadata.batteryLevel !== undefined ? `Battery: ${metadata.batteryLevel}%` : undefined,
  ].filter((field): field is string => field !== undefined);

  if (fields.length === 0) {
    return 'Metadata unavailable';
  }

  return fields.join('\n');
}

function addReader(readers: Reader[], reader: Reader): Reader[] {
  if (readers.some((currentReader) => currentReader.id === reader.id)) {
    return readers;
  }

  return [...readers, reader];
}

function formatError(error: unknown): string {
  if (error instanceof BleNfcReaderError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Reader permission failed';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  panel: {
    gap: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  header: {
    fontSize: 24,
    fontWeight: '600',
  },
  step: {
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
  },
  reader: {
    fontSize: 14,
  },
  readerRow: {
    gap: 8,
  },
  connectedReader: {
    gap: 8,
  },
  keyTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderColor: '#d1d5db',
    borderRadius: 4,
    borderWidth: 1,
    padding: 8,
  },
  error: {
    color: '#b91c1c',
  },
});
