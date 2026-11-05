import * as DocumentPicker from 'expo-document-picker';

import { decodeBytes } from '@/domain/text';

export interface PickedFile {
  name: string;
  text: string;
}

/**
 * Web version: reads the chosen file through the browser File API.
 * @returns The file name and text, or null if the user cancelled.
 */
export async function pickStatementFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['.csv', '.ofx', 'text/csv', 'application/x-ofx', '*/*'] });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return { name: asset.name, text: decodeBytes(new Uint8Array(buffer)) };
}
