import type { FileChunk, UploadTask } from '../types/file-upload';

const DB_NAME = 'FileUploadDB';
const DB_VERSION = 1;
const STORE_NAMES = {
  UPLOAD_TASKS: 'uploadTasks',
  FILE_CHUNKS: 'fileChunks'
};

export interface DBConfig {
  name?: string;
  version?: number;
}

export class FileUploadDB {
  private db: IDBDatabase | null = null;

  /**
   * 打开数据库连接
   * @param config 数据库配置
   * @returns Promise<void>
   */
  async open(config?: DBConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(config?.name || DB_NAME, config?.version || DB_VERSION);

      request.onerror = (event) => {
        console.error('数据库打开失败:', event);
        reject(new Error('数据库连接失败'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBRequest<IDBDatabase>).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest<IDBDatabase>).result;

        // 创建上传任务存储
        if (!db.objectStoreNames.contains(STORE_NAMES.UPLOAD_TASKS)) {
          const taskStore = db.createObjectStore(STORE_NAMES.UPLOAD_TASKS,
            { keyPath: 'fileHash', autoIncrement: false });
          taskStore.createIndex('fileName', 'fileName', { unique: false });
          taskStore.createIndex('status', 'status', { unique: false });
        }

        // 创建文件分片存储
        if (!db.objectStoreNames.contains(STORE_NAMES.FILE_CHUNKS)) {
          const chunkStore = db.createObjectStore(STORE_NAMES.FILE_CHUNKS,
            { keyPath: ['fileHash', 'chunkIndex'], autoIncrement: false });
          chunkStore.createIndex('fileHash', 'fileHash', { unique: false });
          chunkStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
          chunkStore.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 保存上传任务
   * @param task 上传任务
   * @returns Promise<void>
   */
  async saveUploadTask(task: UploadTask): Promise<void> {
    return this.transaction(STORE_NAMES.UPLOAD_TASKS, 'readwrite', (store) => {
      store.put(task);
    });
  }

  /**
   * 获取上传任务
   * @param fileHash 文件哈希
   * @returns Promise<UploadTask | null>
   */
  async getUploadTask(fileHash: string): Promise<UploadTask | null> {
    return this.transaction(STORE_NAMES.UPLOAD_TASKS, 'readonly', (store) => {
      const request = store.get(fileHash);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    });
  }

  /**
   * 根据文件名获取上传任务
   * @param fileName 文件名
   * @returns Promise<UploadTask[]>
   */
  async getUploadTasksByFileName(fileName: string): Promise<UploadTask[]> {
    return this.transaction(STORE_NAMES.UPLOAD_TASKS, 'readonly', (store) => {
      const index = store.index('fileName');
      const request = index.getAll(fileName);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }

  /**
   * 获取所有上传任务
   * @returns Promise<UploadTask[]>
   */
  async getAllUploadTasks(): Promise<UploadTask[]> {
    return this.transaction(STORE_NAMES.UPLOAD_TASKS, 'readonly', (store) => {
      const request = store.getAll();
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }

  /**
   * 删除上传任务
   * @param fileHash 文件哈希
   * @returns Promise<void>
   */
  async deleteUploadTask(fileHash: string): Promise<void> {
    return this.transaction(STORE_NAMES.UPLOAD_TASKS, 'readwrite', (store) => {
      store.delete(fileHash);
    });
  }

  /**
   * 保存文件分片
   * @param chunk 文件分片
   * @returns Promise<void>
   */
  async saveFileChunk(chunk: FileChunk): Promise<void> {
    return this.transaction(STORE_NAMES.FILE_CHUNKS, 'readwrite', (store) => {
      store.put(chunk);
    });
  }

  /**
   * 批量保存文件分片
   * @param chunks 文件分片数组
   * @returns Promise<void>
   */
  async saveFileChunks(chunks: FileChunk[]): Promise<void> {
    return this.transaction(STORE_NAMES.FILE_CHUNKS, 'readwrite', (store) => {
      chunks.forEach(chunk => store.put(chunk));
    });
  }

  /**
   * 获取文件分片
   * @param fileHash 文件哈希
   * @param chunkIndex 分片索引
   * @returns Promise<FileChunk | null>
   */
  async getFileChunk(fileHash: string, chunkIndex: number): Promise<FileChunk | null> {
    return this.transaction(STORE_NAMES.FILE_CHUNKS, 'readonly', (store) => {
      const request = store.get([fileHash, chunkIndex]);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    });
  }

  /**
   * 获取文件的所有分片
   * @param fileHash 文件哈希
   * @returns Promise<FileChunk[]>
   */
  async getFileChunks(fileHash: string): Promise<FileChunk[]> {
    return this.transaction(STORE_NAMES.FILE_CHUNKS, 'readonly', (store) => {
      const index = store.index('fileHash');
      const request = index.getAll(fileHash);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }

  /**
   * 删除文件的所有分片
   * @param fileHash 文件哈希
   * @returns Promise<void>
   */
  async deleteFileChunks(fileHash: string): Promise<void> {
    return this.transaction(STORE_NAMES.FILE_CHUNKS, 'readwrite', (store) => {
      const index = store.index('fileHash');
      const request = index.getAllKeys(fileHash);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          request.result.forEach(key => store.delete(key));
          resolve();
        };
        request.onerror = () => reject(new Error('删除分片失败'));
      });
    });
  }

  /**
   * 执行数据库事务
   * @param storeName 存储名称
   * @param mode 事务模式
   * @param callback 回调函数
   * @returns Promise<T>
   */
  private async transaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    if (!this.db) {
      await this.open();
    }

    if (!this.db) {
      throw new Error('数据库未连接');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result: T | Promise<T> | undefined;

      transaction.onerror = (event) => {
        console.error('事务失败:', event);
        reject(new Error('数据库操作失败'));
      };

      transaction.oncomplete = () => {
        resolve(result as T);
      };

      try {
        result = callback(store);
        if (result instanceof Promise) {
          result.then(res => result = res).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

// 导出单例实例
export const fileUploadDB = new FileUploadDB();