import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storageType = process.env.STORAGE_TYPE || 'local';
const storagePath = process.env.STORAGE_PATH || './uploads/voice-notes';

// Ensure local storage directory exists
if (storageType === 'local') {
  const absPath = path.resolve(storagePath);
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }
}

export async function uploadFile(buffer, filename, mimeType) {
  if (storageType === 'local') {
    const filePath = path.resolve(storagePath, filename);
    fs.writeFileSync(filePath, buffer);
    return {
      storageUrl: `/uploads/voice-notes/${filename}`,
      storageKey: filePath,
    };
  }

  // GCS / S3 implementation placeholder
  // const bucket = storage.bucket(process.env.GCS_BUCKET);
  // const blob = bucket.file(`voice-notes/${filename}`);
  // await blob.save(buffer, { contentType: mimeType });
  // return {
  //   storageUrl: `https://storage.googleapis.com/${process.env.GCS_BUCKET}/voice-notes/${filename}`,
  //   storageKey: `voice-notes/${filename}`,
  // };

  throw new Error(`Unsupported storage type: ${storageType}`);
}

export async function getFileUrl(storageKey) {
  if (storageType === 'local') {
    return storageKey;
  }
  // For GCS/S3, generate signed URL
  throw new Error(`Unsupported storage type: ${storageType}`);
}

export { storageType, storagePath };
