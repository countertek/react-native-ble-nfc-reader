import { BleNfcReaderError, Reader } from '@countertek/react-native-ble-nfc-reader';

export function parseMifareBlock(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const block = Number(value);

  if (!Number.isInteger(block) || block < 0 || block > 255) {
    return null;
  }

  return block;
}

export function isMifareTrailerBlock(block: number): boolean {
  if (block < 128) {
    return block % 4 === 3;
  }

  return (block - 143) % 16 === 0;
}

export function formatMetadata(reader: Reader): string {
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

  return fields.length === 0 ? 'Metadata unavailable' : fields.join('\n');
}

export function addReader(readers: Reader[], reader: Reader): Reader[] {
  if (readers.some((currentReader) => currentReader.id === reader.id)) {
    return readers;
  }

  return [...readers, reader];
}

export function formatError(error: unknown): string {
  if (error instanceof BleNfcReaderError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Reader permission failed';
}
