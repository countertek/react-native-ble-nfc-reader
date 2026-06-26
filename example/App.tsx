import { useEffect, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import {
  BleNfcReaderError,
  getReaderPermissionStatus,
  requestReaderPermissions,
  ReaderPermissionStatus,
} from 'react-native-ble-nfc-reader';

type PermissionState = ReaderPermissionStatus | 'loading';

export default function App() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('loading');
  const [message, setMessage] = useState('');

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

  useEffect(() => {
    void refreshPermissionStatus();
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
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
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
  error: {
    color: '#b91c1c',
  },
});
