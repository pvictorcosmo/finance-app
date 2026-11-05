import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { decodeBytes } from '@/domain/text';

export interface PickedFile {
  name: string;
  text: string;
}

/**
 * Opens the system file picker and reads a bank statement (CSV/OFX).
 * Bytes are decoded as UTF-8 or, when invalid, Latin-1 (common in Itaú/BB exports).
 * @returns The file name and text, or null if the user cancelled.
 */
export async function pickStatementFile(): Promise<PickedFile | null> {
  // '*/*': banks and messaging apps label CSV/OFX with inconsistent MIME types.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const bytes = await new File(asset.uri).bytes();
  return { name: asset.name, text: decodeBytes(bytes) };
}
