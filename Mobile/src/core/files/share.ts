import * as Sharing from 'expo-sharing';

export async function shareFile(uri: string, mimeType?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      'Le partage de fichiers n’est pas disponible sur cet appareil.',
    );
  }
  await Sharing.shareAsync(uri, {
    ...(mimeType === undefined ? {} : { mimeType }),
    dialogTitle: 'Ouvrir ou partager le document',
  });
}
