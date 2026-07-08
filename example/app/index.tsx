import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  addCardPresentListener,
  addCardRemovedListener,
  addReaderDiscoveredListener,
  connectReader,
  disconnectReader,
  getReaderPermissionStatus,
  mifare,
  Reader,
  readCardUid,
  requestReaderPermissions,
  ReaderPermissionStatus,
  scanReaders,
  startCardMonitor,
  stopCardMonitor,
  stopReaderScan,
  transmit,
} from '@countertek/react-native-ble-nfc-reader';

import {
  ActionButton,
  ButtonRow,
  DataBlock,
  EmptyState,
  Field,
  Section,
  SegmentedChoice,
  StatusPill,
} from '../components/reader-ui';
import {
  addReader,
  formatError,
  formatMetadata,
  isMifareTrailerBlock,
  parseMifareBlock,
} from '../lib/reader-format';

type PermissionState = ReaderPermissionStatus | 'loading';
type CardPresence = 'unknown' | 'present' | 'removed';

export default function ReaderTestScreen() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('loading');
  const [message, setMessage] = useState('');
  const [readers, setReaders] = useState<Reader[]>([]);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [cardPresence, setCardPresence] = useState<CardPresence>('unknown');
  const [cardMonitorRunning, setCardMonitorRunning] = useState(false);
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
      setMessage(
        'Reader permission is required before scanning. Use Request Reader Permission first.'
      );
      return;
    }

    try {
      setScanning(true);
      setReaders([]);
      setConnectedReader(null);
      setCardMonitorRunning(false);
      setCardPresence('unknown');
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

  async function connectToReader(readerId: string) {
    try {
      setConnectedReader(await connectReader(readerId));
      setCardMonitorRunning(false);
      setCardPresence('unknown');
      setCardUid('');
      setApduResponse('');
      setMifareResult('');
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function startMonitor() {
    if (connectedReader === null) {
      return;
    }

    try {
      await startCardMonitor(connectedReader.id);
      setCardMonitorRunning(true);
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function stopMonitor() {
    if (connectedReader === null) {
      return;
    }

    try {
      await stopCardMonitor(connectedReader.id);
      setCardMonitorRunning(false);
      setCardPresence('unknown');
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
      if (cardMonitorRunning) {
        await stopCardMonitor(connectedReader.id);
      }

      await disconnectReader(connectedReader.id);
      setConnectedReader(null);
      setCardMonitorRunning(false);
      setCardPresence('unknown');
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
      setApduResponse(`Data: ${response.responseData || '(empty)'}\nStatus: ${response.status}`);
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
      setMifareResult(await mifare.readBlock({ readerId: connectedReader.id, block }));
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
      setMifareResult(await mifare.readBlock({ readerId: connectedReader.id, block }));
      setMessage('');
    } catch (error) {
      setMessage(formatError(error));
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

      setCardPresence('present');
    });
    const removedSubscription = addCardRemovedListener((event) => {
      if (event.readerId !== connectedReader?.id) {
        return;
      }

      setCardPresence('removed');
      setCardUid('');
      setApduResponse('');
      setMifareResult('');
    });

    return () => {
      presentSubscription.remove();
      removedSubscription.remove();
    };
  }, [connectedReader?.id]);

  const hasPermission = permissionStatus === 'granted';
  const connectedReaderLabel = connectedReader?.name ?? connectedReader?.id ?? 'None';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Manual hardware test</Text>
        <Text style={styles.title}>Generic BLE NFC Reader Flow</Text>
        <Text style={styles.subtitle}>
          Work top to bottom with a supported Reader and a test card. Results stay selectable for
          logs and issue reports.
        </Text>
      </View>

      <View style={styles.statusGrid}>
        <StatusPill label="Permission" value={permissionStatus} tone={hasPermission ? 'good' : 'warn'} />
        <StatusPill label="Scan" value={scanning ? 'running' : 'stopped'} tone={scanning ? 'warn' : 'default'} />
        <StatusPill label="Reader" value={connectedReaderLabel} tone={connectedReader ? 'good' : 'default'} />
        <StatusPill label="Card" value={cardPresence} tone={cardPresence === 'present' ? 'good' : 'default'} />
      </View>

      {message ? <DataBlock label="Message" value={message} tone="bad" /> : null}

      <Section
        title="1. Reader Permission"
        detail="Bluetooth reader access must be granted before scanning.">
        <ButtonRow>
          <ActionButton
            disabled={permissionStatus === 'loading'}
            onPress={refreshPermissionStatus}
            title="Check Status"
          />
          <ActionButton
            disabled={permissionStatus === 'loading'}
            onPress={requestPermissions}
            title="Request Permission"
          />
        </ButtonRow>
      </Section>

      <Section
        title="2. Scan And Connect"
        detail="Run a bounded scan, then connect one discovered Reader.">
        <ButtonRow>
          <ActionButton
            disabled={!hasPermission || scanning || connectedReader !== null}
            onPress={scanForReaders}
            title="Scan 5 Seconds"
          />
          <ActionButton disabled={!scanning} onPress={stopScan} title="Stop Scan" />
        </ButtonRow>

        {readers.length === 0 ? (
          <EmptyState>No readers discovered yet.</EmptyState>
        ) : (
          <View style={styles.readerList}>
            {readers.map((reader) => {
              const connected = connectedReader?.id === reader.id;

              return (
                <View key={reader.id} style={styles.readerCard}>
                  <View style={styles.readerText}>
                    <Text style={styles.readerName} selectable>
                      {reader.name ?? reader.id}
                    </Text>
                    <Text style={styles.readerMeta} selectable>
                      {formatMetadata(reader)}
                    </Text>
                  </View>
                  <ActionButton
                    disabled={(connectedReader !== null && !connected) || scanning}
                    onPress={() => connectToReader(reader.id)}
                    title={connected ? 'Connected' : 'Connect'}
                  />
                </View>
              );
            })}
          </View>
        )}
      </Section>

      {connectedReader ? (
        <>
          <Section
            title="3. Card Presence Monitor"
            detail="Start monitoring before placing or removing a card.">
            <ButtonRow>
              <ActionButton disabled={cardMonitorRunning} onPress={startMonitor} title="Start Monitor" />
              <ActionButton disabled={!cardMonitorRunning} onPress={stopMonitor} title="Stop Monitor" />
            </ButtonRow>
          </Section>

          <Section title="4. UID And APDU" detail="Read the card UID directly or through the UID APDU.">
            <ButtonRow>
              <ActionButton onPress={readUid} title="Read UID" />
              <ActionButton onPress={transmitUidApdu} title="Transmit UID APDU" />
            </ButtonRow>
            {cardUid ? <DataBlock label="UID" value={cardUid} /> : null}
            {apduResponse ? <DataBlock label="APDU Response" value={apduResponse} /> : null}
          </Section>

          <Section
            title="5. MIFARE Classic Block"
            detail="Authenticate, read, or write one user-entered data block. Trailer writes stay blocked.">
            <Field
              keyboardType="number-pad"
              label="Block"
              onChangeText={setMifareBlock}
              placeholder="4"
              value={mifareBlock}
            />
            <View style={styles.keyType}>
              <Text style={styles.label}>Key Type</Text>
              <SegmentedChoice
                onChange={setMifareKeyType}
                options={['A', 'B']}
                value={mifareKeyType}
              />
            </View>
            <Field
              label="Key Hex"
              onChangeText={setMifareKey}
              placeholder="FFFFFFFFFFFF"
              secureTextEntry
              value={mifareKey}
            />
            <ButtonRow>
              <ActionButton onPress={() => authenticateMifare(mifareKey)} title="Authenticate" />
              <ActionButton onPress={readMifareBlock} title="Read Block" />
            </ButtonRow>
            <Field
              label="Write Data Hex"
              onChangeText={setMifareData}
              placeholder="00112233445566778899AABBCCDDEEFF"
              value={mifareData}
            />
            <ActionButton destructive onPress={confirmWriteMifareBlock} title="Confirm Write And Read Back" />
            {mifareResult ? <DataBlock label="MIFARE Result" value={mifareResult} /> : null}
          </Section>

          <Section title="6. Disconnect" detail="Disconnect before testing another Reader.">
            <ActionButton destructive onPress={disconnectCurrentReader} title="Disconnect Reader" />
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  container: {
    gap: 14,
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    gap: 6,
    paddingVertical: 8,
  },
  kicker: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 22,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readerList: {
    gap: 10,
  },
  readerCard: {
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  readerText: {
    gap: 4,
  },
  readerName: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  readerMeta: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 18,
  },
  keyType: {
    gap: 6,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
});
