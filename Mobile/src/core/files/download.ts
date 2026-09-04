import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { shareFile } from './share';

export async function saveDownloadedFile(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<void> {
  if (Platform.OS !== 'android') {
    await shareFile(uri, mimeType);
    return;
  }
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) throw new Error('Accès au dossier de téléchargement refusé.');
  const target = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    fileName,
    mimeType,
  );
  await FileSystem.copyAsync({ from: uri, to: target });
}