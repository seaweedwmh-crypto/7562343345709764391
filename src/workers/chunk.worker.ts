import { HashUtil } from '../utils/hash.js';

interface ChunkTask {
  file: File;
  chunkSize: number;
  fileHash?: string;
}

interface ChunkResult {
  fileHash: string;
  chunks: Array<{
    index: number;
    hash: string;
    size: number;
    start: number;
    end: number;
  }>;
  totalChunks: number;
  totalSize: number;
}

interface HashTask {
  buffer: ArrayBuffer;
  type: 'chunk' | 'file';
}

interface HashResult {
  hash: string;
  type: 'chunk' | 'file';
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'split-file':
        await handleSplitFile(data);
        break;
      case 'calculate-hash':
        await handleCalculateHash(data);
        break;
      case 'calculate-chunk-hash':
        await handleCalculateChunkHash(data);
        break;
      default:
        throw new Error(`未知任务类型: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 处理文件分片任务
 * @param task 分片任务
 */
async function handleSplitFile(task: ChunkTask): Promise<void> {
  const { file, chunkSize, fileHash } = task;
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const chunks: ChunkResult['chunks'] = [];

  // 如果没有提供文件哈希，则计算整个文件的哈希
  const finalFileHash = fileHash || await HashUtil.calculateFileHash(file);

  // 分片并计算每个分片的哈希
  for (let index = 0; index < totalChunks; index++) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();
    const hash = await HashUtil.calculateBufferHash(buffer);

    chunks.push({
      index,
      hash,
      size: end - start,
      start,
      end
    });

    // 发送进度更新
    self.postMessage({
      type: 'progress',
      data: {
        fileHash: finalFileHash,
        progress: (index + 1) / totalChunks,
        currentChunk: index + 1,
        totalChunks
      }
    });
  }

  // 发送完成消息
  self.postMessage({
    type: 'complete',
    data: {
      fileHash: finalFileHash,
      chunks: chunks.map(chunk => ({
        ...chunk,
        chunkIndex: chunk.index
      })),
      totalChunks,
      totalSize
    } as ChunkResult
  });
}

/**
 * 处理哈希计算任务
 * @param task 哈希计算任务
 */
async function handleCalculateHash(task: HashTask): Promise<void> {
  const hash = await HashUtil.calculateBufferHash(task.buffer);
  self.postMessage({
    type: 'hash-result',
    data: {
      hash,
      type: task.type
    } as HashResult
  });
}

/**
 * 处理分片哈希计算任务
 * @param chunkData 分片数据
 */
async function handleCalculateChunkHash(chunkData: ArrayBuffer): Promise<void> {
  const hash = await HashUtil.calculateBufferHash(chunkData);
  self.postMessage({
    type: 'chunk-hash-result',
    data: hash
  });
}