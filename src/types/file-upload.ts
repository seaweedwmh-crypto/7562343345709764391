export interface FileChunk {
  fileHash: string;
  chunkIndex: number;
  chunkHash: string;
  start: number;
  end: number;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  retryCount: number;
  uploadedAt?: number;
}

export interface UploadTask {
  fileHash: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number;
  failedChunks: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  overallProgress: number;
  createdAt: number;
  updatedAt: number;
}