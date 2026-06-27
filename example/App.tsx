import { useEffect, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import {
  addCardPresentListener,
  addCardRemovedListener,
  addReaderDiscoveredListener,
  BleNfcReaderError,
  connectReader,
  disconnectReader,
  getReaderPermissionStatus,
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
    });

    return () => {
      presentSubscription.remove();
      removedSubscription.remove();
    };
  }, [connectedReader?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.header}>Reader Permission</Text>
        <Text style={styles.status}>Status: {permissionStatus}</Text>
        <Button
          title="Request Reader Permission"
          onPress={requestPermissions}
          disabled={permissionStatus === 'loading'}
        />
        <Button
          title="Scan For Readers"
          onPress={scanForReaders}
          disabled={permissionStatus !== 'granted' || scanning || connectedReader !== null}
        />
        <Button title="Stop Scan" onPress={stopScan} disabled={!scanning} />
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
            <Text style={styles.status}>Connected: {connectedReader.name ?? connectedReader.id}</Text>
            <Text style={styles.reader}>{formatMetadata(connectedReader)}</Text>
            <Text style={styles.status}>Card: {cardPresent ? 'present' : 'removed'}</Text>
            <Button title="Read Card UID" onPress={readUid} />
            <Button title="Transmit UID APDU" onPress={transmitUidApdu} />
            {cardUid ? <Text style={styles.reader}>UID: {cardUid}</Text> : null}
            {apduResponse ? <Text style={styles.reader}>{apduResponse}</Text> : null}
            <Button title="Disconnect Reader" onPress={disconnectCurrentReader} />
          </View>
        ) : null}
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
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
  error: {
    color: '#b91c1c',
  },
});
