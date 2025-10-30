<template>
  <div class="file-pipeline-container">
    <h2>大文件分片上传系统</h2>
    
    <!-- 文件选择区域 -->
      <label for="fileInput" class="file-selector" style="position: relative; display: inline-block; cursor: pointer;">
        <input
          type="file"
          id="fileInput"
          ref="fileInput"
          @change="onFileSelect"
          :disabled="isUploading"
          accept="*/*"
          style="position: absolute; opacity: 0; width: 100%; height: 100%; top: 0; left: 0; cursor: pointer; z-index: 10;"
        />
        <button
          class="btn btn-primary"
          :disabled="isUploading"
          style="padding: 8px 16px; position: relative;"
        >
          <span class="icon">📁</span>
          选择文件
        </button>
      </label>

    <!-- 文件信息区域 -->
    <div v-if="currentFile" class="file-info">
      <div class="file-info-item">
        <span class="icon">📄</span>
        <span>{{ currentFile.name }}</span>
      </div>
      <div class="file-info-item">
        <span class="icon">💾</span>
        <span>{{ formatFileSize(currentFile.size) }}</span>
      </div>
      <div class="file-info-item">
        <span class="icon">🔢</span>
        <span>{{ totalChunks }} 个分片</span>
      </div>
      <div class="file-info-item">
        <span class="icon">⚡</span>
        <span>分片大小: {{ formatFileSize(chunkSize) }}</span>
      </div>
      <div class="file-info-item">
        <span class="icon">🔍</span>
        <span v-if="fileHash">哈希: {{ fileHash.substring(0, 16) }}...</span>
        <span v-else>计算哈希中...</span>
      </div>
    </div>

    <!-- 控制按钮区域 -->
    <div class="control-buttons">
      <button
        class="btn btn-success"
        @click="startUpload"
        :disabled="!currentFile || isUploading || isPaused || isCompleted"
      >
        <span class="icon">▶️</span>
        开始上传
      </button>
      <button
        class="btn btn-warning"
        @click="togglePause"
        :disabled="!currentFile || !isUploading || isCompleted"
      >
        <span class="icon">{{ isPaused ? '▶️' : '⏸️' }}</span>
        {{ isPaused ? '继续' : '暂停' }}
      </button>
      <button
        class="btn btn-danger"
        @click="cancelUpload"
        :disabled="!currentFile || isCompleted"
      >
        <span class="icon">❌</span>
        取消
      </button>
      <button
        class="btn btn-primary"
        @click="clearCurrent"
        :disabled="!currentFile"
      >
        <span class="icon">🗑️</span>
        清除
      </button>
    </div>

    <!-- 进度统计区域 -->
    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-label">已上传</div>
        <div class="stat-value success">{{ uploadedChunks }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">失败</div>
        <div class="stat-value error">{{ failedChunks }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">待上传</div>
        <div class="stat-value pending">{{ pendingChunks }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">上传中</div>
        <div class="stat-value uploading">{{ uploadingChunks }}</div>
      </div>
    </div>

    <!-- 整体进度条 -->
    <div class="progress-container">
      <div class="progress-label">
        <span>整体进度</span>
        <span>{{ Math.round(overallProgress * 100) }}%</span>
      </div>
      <progress
        :value="overallProgress"
        max="1"
        :class="{
          'progress-success': isCompleted,
          'progress-error': hasError
        }"
      ></progress>
    </div>

    <!-- 分片状态网格 -->
    <div v-if="totalChunks > 0" class="chunks-grid">
      <div
        v-for="chunk in chunks"
        :key="chunk.chunkIndex"
        class="chunk-item"
        :class="chunk.status"
        :data-index="chunk.chunkIndex"
        :title="`分片 ${chunk.chunkIndex + 1}/${totalChunks} - ${chunk.status}`"
      ></div>
    </div>

    <!-- 上传日志 -->
    <div v-if="uploadLog.length > 0" class="upload-log">
      <h3>上传日志</h3>
      <div class="log-list">
        <div
          v-for="(log, index) in uploadLog.slice(-10)"
          :key="index"
          class="log-item"
          :class="log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>

    <!-- 历史文件列表 -->
    <div class="file-list">
      <h3>历史上传记录</h3>
      <div v-if="uploadHistory.length === 0" class="empty-state">
        暂无上传记录
      </div>
      <div v-else>
        <div
          v-for="task in uploadHistory"
          :key="task.fileHash"
          class="file-list-item"
        >
          <div class="file-list-info">
            <div class="file-list-name">{{ task.fileName }}</div>
            <div class="file-list-meta">
              <span>{{ formatFileSize(task.fileSize) }}</span>
              <span>{{ task.status }}</span>
              <span>{{ new Date(task.updatedAt).toLocaleString() }}</span>
            </div>
          </div>
          <div class="file-list-actions">
            <button
              class="btn btn-sm btn-primary"
              @click="resumeTask(task)"
              :disabled="task.status === 'completed'"
            >
              恢复
            </button>
            <button
              class="btn btn-sm btn-danger"
              @click="deleteTask(task.fileHash)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { fileUploadDB } from '../services/db';
import type { FileUploadDB } from '../services/db';
import type { FileChunk, UploadTask } from '../types/file-upload';
import '../styles/progress.css';

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileSelect = () => {
  fileInput.value?.click();
};

interface ChunkWorkerMessage {
  type: string;
  data?: any;
  error?: string;
}

// 配置
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_CONCURRENCY = 4;
const MAX_RETRY_COUNT = 2;

// 状态管理
const currentFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const fileHash = ref<string>('');
const chunkSize = ref<number>(CHUNK_SIZE);
const totalChunks = ref<number>(0);
const chunks = ref<FileChunk[]>([]);
const isUploading = ref<boolean>(false);
const isPaused = ref<boolean>(false);
const isCompleted = ref<boolean>(false);
const hasError = ref<boolean>(false);
const overallProgress = ref<number>(0);
const uploadLog = ref<Array<{ time: string; message: string; type: string }>>([]);
const uploadHistory = ref<UploadTask[]>([]);

// 计算属性
const uploadedChunks = computed(() => 
  chunks.value.filter(c => c.status === 'success').length
);

const failedChunks = computed(() => 
  chunks.value.filter(c => c.status === 'failed').length
);

const pendingChunks = computed(() => 
  chunks.value.filter(c => c.status === 'pending').length
);

const uploadingChunks = computed(() => 
  chunks.value.filter(c => c.status === 'uploading').length
);

// Worker管理
let chunkWorker: Worker | null = null;
let db: FileUploadDB | null = null;
let uploadQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = ref<boolean>(false);

// 生命周期
onMounted(async () => {
  try {
    // 初始化数据库
    db = fileUploadDB;
    await db.open();
    
    // 加载历史记录
    await loadUploadHistory();
    
    // 初始化Worker
    chunkWorker = new Worker(new URL('../workers/chunk.worker.ts', import.meta.url));
    chunkWorker.onmessage = handleWorkerMessage;
  } catch (error) {
    addLog('初始化失败: ' + (error as Error).message, 'error');
  }
});

onBeforeUnmount(() => {
  if (chunkWorker) {
    chunkWorker.terminate();
  }
  if (db) {
    db.close();
  }
});

// Worker消息处理
function handleWorkerMessage(event: MessageEvent<ChunkWorkerMessage>) {
  const { type, data, error } = event.data;
  
  if (error) {
    addLog('Worker错误: ' + error, 'error');
    hasError.value = true;
    return;
  }
  
  switch (type) {
    case 'progress':
      const progress = data.progress * 100;
      addLog(`文件分片进度: ${Math.round(progress)}% (${data.currentChunk}/${data.totalChunks})`, 'info');
      break;
    
    case 'complete':
      handleFileSplitComplete(data);
      break;
    
    case 'hash-result':
      if (data.type === 'file') {
        fileHash.value = data.hash;
        addLog(`文件哈希计算完成: ${data.hash.substring(0, 16)}...`, 'success');
      }
      break;
  }
}



// 文件选择处理
async function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  
  const file = input.files[0];
  currentFile.value = file;
  
  addLog(`选择文件: ${file.name} (${formatFileSize(file.size)})`, 'info');
  
  // 检查是否已有上传记录
  const existingTasks = await db!.getUploadTasksByFileName(file.name);
  const existingTask = existingTasks.find(t => t.fileSize === file.size);
  
  if (existingTask) {
    if (existingTask.status === 'completed') {
      addLog('该文件已上传完成', 'warning');
      return;
    } else if (existingTask.status === 'uploading' || existingTask.status === 'paused') {
      if (confirm('发现未完成的上传任务，是否恢复？')) {
        await resumeTask(existingTask);
        return;
      }
    }
  }
  
  // 开始分片
  startFileSplit();
}

// 文件分片
function startFileSplit() {
  if (!currentFile.value || !chunkWorker) return;
  
  addLog('开始文件分片...', 'info');
  isUploading.value = true;
  
  chunkWorker.postMessage({
    type: 'split-file',
    data: {
      file: currentFile.value,
      chunkSize: chunkSize.value
    }
  });
}

// 文件分片完成处理
async function handleFileSplitComplete(result: any) {
    try {
      fileHash.value = result.fileHash;
      totalChunks.value = result.totalChunks;
      
      // 创建分片数组
      chunks.value = result.chunks.map((chunk: any) => ({
        fileHash: result.fileHash,
        chunkIndex: chunk.chunkIndex,
        chunkHash: chunk.hash,
        start: chunk.start,
        end: chunk.end,
        size: chunk.size,
        status: 'pending',
        retryCount: 0
      }));
    
    // 创建上传任务
    if (!currentFile.value) return;
    
    const task: UploadTask = {
      fileHash: result.fileHash,
      fileName: currentFile.value.name,
      fileSize: currentFile.value.size,
      chunkSize: chunkSize.value,
      totalChunks: result.totalChunks,
      uploadedChunks: 0,
      failedChunks: 0,
      status: 'pending',
      overallProgress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // 保存到数据库
    await db!.saveUploadTask(task);
    await db!.saveFileChunks(chunks.value);
    
    addLog(`文件分片完成: 共 ${result.totalChunks} 个分片`, 'success');
    
    // 自动开始上传
    startUpload();
    
  } catch (error) {
    addLog('分片完成处理失败: ' + (error as Error).message, 'error');
    isUploading.value = false;
    hasError.value = true;
  }
}

// 开始上传
function startUpload() {
  if (!currentFile.value || !fileHash.value || chunks.value.length === 0) return;
  
  addLog('开始上传文件...', 'info');
  isUploading.value = true;
  isPaused.value = false;
  hasError.value = false;
  
  // 更新任务状态
  updateTaskStatus('uploading');
  
  // 创建上传队列
  uploadQueue = chunks.value
    .filter(chunk => chunk.status === 'pending' || chunk.status === 'failed')
    .map(chunk => () => uploadChunk(chunk));
  
  // 处理队列
  processUploadQueue();
}

// 处理上传队列
async function processUploadQueue() {
  if (isPaused.value || isCompleted.value || uploadQueue.length === 0) {
    isProcessingQueue.value = false;
    
    // 检查是否全部完成
    if (uploadedChunks.value === totalChunks.value) {
      completeUpload();
    } else if (uploadQueue.length === 0 && failedChunks.value > 0) {
      addLog('部分分片上传失败', 'error');
      updateTaskStatus('failed');
    }
    
    return;
  }
  
  isProcessingQueue.value = true;
  
  // 并发处理
  const concurrency = Math.min(MAX_CONCURRENCY, uploadQueue.length);
  const tasks = Array.from({ length: concurrency }, () => uploadQueue.shift());
  
  await Promise.all(tasks.map(task => task?.() || Promise.resolve()));
  
  // 继续处理剩余队列
  processUploadQueue();
}

// 上传分片
async function uploadChunk(chunk: FileChunk): Promise<void> {
  if (!currentFile.value) return;
  
  try {
    // 更新分片状态
    chunk.status = 'uploading';
    await db!.saveFileChunk(chunk);
    
    // 模拟上传延迟
    await simulateUpload(chunk);
    
    // 更新分片状态为成功
    chunk.status = 'success';
    chunk.uploadedAt = Date.now();
    await db!.saveFileChunk(chunk);
    
    // 更新进度
    updateProgress();
    
  } catch (error) {
    chunk.retryCount++;
    
    if (chunk.retryCount <= MAX_RETRY_COUNT) {
      addLog(`分片 ${chunk.chunkIndex + 1} 上传失败，正在重试 (${chunk.retryCount}/${MAX_RETRY_COUNT})`, 'warning');
      chunk.status = 'pending';
      uploadQueue.push(() => uploadChunk(chunk));
    } else {
      addLog(`分片 ${chunk.chunkIndex + 1} 上传失败 (已重试 ${MAX_RETRY_COUNT} 次)`, 'error');
      chunk.status = 'failed';
      await db!.saveFileChunk(chunk);
    }
    
    await db!.saveFileChunk(chunk);
    updateProgress();
  }
}

// 模拟上传
async function simulateUpload(chunk: FileChunk): Promise<void> {
  // 模拟网络延迟和随机失败
  const delay = Math.random() * 1000 + 500;
  const successRate = 0.95; // 95%成功率
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < successRate) {
        resolve();
      } else {
        reject(new Error('模拟上传失败'));
      }
    }, delay);
  });
}

// 更新进度
async function updateProgress() {
  if (!currentFile.value) return;
  
  const uploaded = uploadedChunks.value;
  const total = totalChunks.value;
  const progress = total > 0 ? uploaded / total : 0;
  
  overallProgress.value = progress;
  
  // 更新任务
  await db!.saveUploadTask({
    fileHash: fileHash.value,
    fileName: currentFile.value.name,
    fileSize: currentFile.value.size,
    chunkSize: chunkSize.value,
    totalChunks: total,
    uploadedChunks: uploaded,
    failedChunks: failedChunks.value,
    status: isPaused.value ? 'paused' : isUploading.value ? 'uploading' : 'pending',
    overallProgress: progress,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  // 更新历史记录
  await loadUploadHistory();
}

// 暂停/继续上传
function togglePause() {
  isPaused.value = !isPaused.value;
  
  if (isPaused.value) {
    addLog('上传已暂停', 'info');
    updateTaskStatus('paused');
  } else {
    addLog('继续上传', 'info');
    updateTaskStatus('uploading');
    processUploadQueue();
  }
}

// 取消上传
async function cancelUpload() {
  if (!fileHash.value) return;
  
  isUploading.value = false;
  isPaused.value = false;
  uploadQueue = [];
  
  // 更新任务状态
  await db!.saveUploadTask({
    ...(await db!.getUploadTask(fileHash.value))!,
    status: 'failed',
    updatedAt: Date.now()
  });
  
  addLog('上传已取消', 'error');
  await loadUploadHistory();
}

// 完成上传
async function completeUpload() {
  isUploading.value = false;
  isCompleted.value = true;
  
  // 更新任务状态
  await db!.saveUploadTask({
    ...(await db!.getUploadTask(fileHash.value))!,
    status: 'completed',
    overallProgress: 1,
    updatedAt: Date.now()
  });
  
  addLog('文件上传完成！', 'success');
  await loadUploadHistory();
}

// 清除当前文件
function clearCurrent() {
  currentFile.value = null;
  fileHash.value = '';
  totalChunks.value = 0;
  chunks.value = [];
  overallProgress.value = 0;
  isUploading.value = false;
  isPaused.value = false;
  isCompleted.value = false;
  hasError.value = false;
  uploadQueue = [];
}

// 恢复任务
async function resumeTask(task: UploadTask) {
  if (!db) return;
  
  // 加载文件分片
  const savedChunks = await db.getFileChunks(task.fileHash);
  if (savedChunks.length === 0) {
    addLog('无法找到分片数据', 'error');
    return;
  }
  
  // 恢复状态
  fileHash.value = task.fileHash;
  chunkSize.value = task.chunkSize;
  totalChunks.value = task.totalChunks;
  chunks.value = savedChunks;
  overallProgress.value = task.overallProgress;
  
  addLog(`恢复任务: ${task.fileName}`, 'info');
  
  // 如果任务未完成，自动开始上传
  if (task.status !== 'completed') {
    startUpload();
  }
}

// 删除任务
async function deleteTask(fileHash: string) {
  if (!db) return;
  
  await db.deleteUploadTask(fileHash);
  await db.deleteFileChunks(fileHash);
  await loadUploadHistory();
  
  addLog('删除上传记录', 'info');
}

// 更新任务状态
async function updateTaskStatus(status: UploadTask['status']) {
  if (!fileHash.value || !db) return;
  
  const task = await db.getUploadTask(fileHash.value);
  if (task) {
    task.status = status;
    task.updatedAt = Date.now();
    await db.saveUploadTask(task);
    await loadUploadHistory();
  }
}

// 加载上传历史
async function loadUploadHistory() {
  if (!db) return;
  
  const tasks = await db.getAllUploadTasks();
  uploadHistory.value = tasks.sort((a, b) => b.updatedAt - a.updatedAt);
}

// 添加日志
function addLog(message: string, type: string = 'info') {
  const time = new Date().toLocaleTimeString();
  uploadLog.value.push({ time, message, type });
  
  // 限制日志数量
  if (uploadLog.value.length > 100) {
    uploadLog.value.shift();
  }
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
  else return (bytes / 1073741824).toFixed(2) + ' GB';
}
</script>

<style scoped>
.file-selector {
  margin-bottom: 20px;
}

.file-selector label {
  position: relative;
  display: inline-block;
}

.file-selector input[type="file"] {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 10;
  }

.file-selector label:disabled input[type="file"] {
  pointer-events: none;
}

.file-selector label:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-log {
  margin-top: 30px;
}

.upload-log h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

.log-list {
  max-height: 200px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
}

.log-item {
  padding: 4px 0;
  font-size: 12px;
  display: flex;
  gap: 12px;
}

.log-time {
  color: #666;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-item.info .log-message {
  color: #2196f3;
}

.log-item.success .log-message {
  color: #4caf50;
}

.log-item.warning .log-message {
  color: #ff9800;
}

.log-item.error .log-message {
  color: #f44336;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: #999;
  background: #fafafa;
  border-radius: 4px;
}
</style>