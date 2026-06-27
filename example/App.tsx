import { useEffect, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import {
  addReaderDiscoveredListener,
  BleNfcReaderError,
  getReaderPermissionStatus,
  Reader,
  requestReaderPermissions,
  ReaderPermissionStatus,
  scanReaders,
  stopReaderScan,
} from 'react-native-ble-nfc-reader';

type PermissionState = ReaderPermissionStatus | 'loading';

export default function App() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('loading');
  const [message, setMessage] = useState('');
  const [readers, setReaders] = useState<Reader[]>([]);
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
      setReaders(await scanReaders({ timeoutMs: 5000 }));
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setScanning(false);
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
          disabled={permissionStatus !== 'granted' || scanning}
        />
        <Button title="Stop Scan" onPress={stopScan} disabled={!scanning} />
        {readers.map((reader) => (
          <Text key={reader.id} style={styles.reader}>
            {reader.name ?? reader.id}
          </Text>
        ))}
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
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
  error: {
    color: '#b91c1c',
  },
});
