import * as DocumentPicker from 'expo-document-picker';

/** Web: baixa o backup como arquivo .json. */
export async function shareBackupFile(fileName: string, contents: string): Promise<boolean> {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Web: abre o seletor de arquivos do navegador e lê o texto. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '.json'] });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
}
