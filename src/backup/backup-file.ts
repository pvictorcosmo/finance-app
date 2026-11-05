import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Celular: grava o backup num arquivo temporário e abre o menu de compartilhar
 * (Drive, WhatsApp, e-mail, "Salvar em arquivos"...). Retorna false se não deu para compartilhar.
 */
export async function shareBackupFile(fileName: string, contents: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup do Finance',
    UTI: 'public.json',
  });
  return true;
}

/** Abre o seletor de arquivos e devolve o texto do arquivo escolhido (null se cancelar). */
export async function pickBackupFile(): Promise<string | null> {
  // '*/*': arquivos vindos do WhatsApp/Drive nem sempre chegam como application/json.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  return new File(result.assets[0].uri).text();
}
