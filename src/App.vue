<template>
  <div id="app" class="app-container">
    <header class="app-header">
      <h1>Web 开发工具集</h1>
      <div class="fuse-status">
        <span class="status-label">熔断器状态:</span>
        <span class="status-value" :class="`status-${fuseStatus.state}`">
          {{ getFuseStateText(fuseStatus.state) }}
        </span>
        <span v-if="fuseStatus.state === 'open'" class="cool-down-time">
          (冷却剩余: {{ Math.ceil(fuseStatus.remainingCoolDownTime / 1000) }}秒)
        </span>
      </div>
    </header>

    <div class="app-tabs">
      <button 
        class="tab-button" 
        :class="{ 'active': activeTab === 'http' }"
        @click="activeTab = 'http'"
      >
        HTTP 测试工具
      </button>
      <button 
        class="tab-button" 
        :class="{ 'active': activeTab === 'file' }"
        @click="activeTab = 'file'"
      >
        大文件分片上传
      </button>
    </div>

    <main class="app-main">
      <div v-if="activeTab === 'http'" class="test-section">
        <div class="test-controls">
          <div class="url-input-group">
            <label for="url">测试URL:</label>
            <input
              id="url"
              v-model="testUrl"
              type="text"
              placeholder="输入测试URL"
              class="url-input"
            />
          </div>

          <div class="timeout-input-group">
            <label for="timeout">超时时间 (ms):</label>
            <input
              id="timeout"
              v-model.number="timeout"
              type="number"
              min="1000"
              max="10000"
              class="timeout-input"
            />
          </div>

          <div class="retry-input-group">
            <label for="retryCount">重试次数:</label>
            <input
              id="retryCount"
              v-model.number="retryCount"
              type="number"
              min="0"
              max="5"
              class="retry-input"
            />
          </div>

          <div class="button-group">
            <button @click="sendRequest(false)" :disabled="isSending" class="send-button">
              <span v-if="isSending" class="loading">发送中...</span>
              <span v-else>发送请求</span>
            </button>
            <button @click="handleResetFuse" class="reset-button">
              重置熔断器
            </button>
          </div>
        </div>

        <div class="test-results">
          <h3>请求结果:</h3>
          <div v-if="results.length === 0" class="no-results">
            暂无请求结果
          </div>
          <div v-else class="results-list">
            <div
              v-for="(result, index) in results.slice().reverse()"
              :key="index"
              class="result-item"
              :class="`result-${result.success ? 'success' : 'error'}`"
            >
              <div class="result-header">
                <span class="result-status">
                  {{ result.success ? '成功' : '失败' }}
                </span>
                <span class="result-time">
                  {{ result.timestamp }}
                </span>
              </div>
              <div class="result-details">
                <p>URL: {{ result.url }}</p>
                <p>状态码: {{ result.statusCode || 'N/A' }}</p>
                <p>耗时: {{ result.duration }}ms</p>
                <p v-if="result.errorType">错误类型: {{ result.errorType }}</p>
                <p v-if="result.errorMessage">错误信息: {{ result.errorMessage }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <main v-if="activeTab === 'file'" class="app-main">
      <FilePipeline />
    </main>

    <!-- Toast 组件 -->
    <Toast
      v-for="(toast, index) in toasts"
      :key="index"
      :message="toast.message"
      :type="toast.type"
      :duration="toast.duration"
      :show-retry="toast.showRetry"
      :retry-action="toast.retryAction"
      @close="removeToast(index)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { request, getFuseStatus, resetFuse, ErrorType } from './services/http';
import Toast from './components/Toast.vue';
import FilePipeline from './views/FilePipeline.vue';

// 标签页状态
const activeTab = ref('http');

// 测试URL预设选项
const presetUrls = [
  'https://httpbin.org/status/200',
  'https://httpbin.org/status/500',
  'https://httpbin.org/delay/3',
  'https://httpbin.org/status/404'
];

// 响应式状态
const testUrl = ref(presetUrls[0]);
const timeout = ref(5000);
const retryCount = ref(3);
const isSending = ref(false);
const results = ref<any[]>([]);
const toasts = ref<any[]>([]);

// 计算属性获取熔断器状态
const fuseStatus = computed(() => getFuseStatus());

// 获取熔断器状态文本
const getFuseStateText = (state: string): string => {
  switch (state) {
    case 'closed':
      return '关闭 (正常)';
    case 'open':
      return '打开 (已熔断)';
    case 'half-open':
      return '半开 (测试中)';
    default:
      return '未知';
  }
};

// 发送请求
const sendRequest = async (bypassFuse: boolean = false) => {
  if (!testUrl.value) {
    showToast('请输入测试URL', 'warning');
    return;
  }

  isSending.value = true;
  const startTime = Date.now();
  const result: any = {
    url: testUrl.value,
    timestamp: new Date().toLocaleTimeString(),
    startTime: startTime,
    success: false
  };

  try {
    const options = {
      timeout: timeout.value,
      retryCount: retryCount.value,
      headers: new Headers()
    };

    // 如果是绕过熔断的重试，添加特殊头部
    if (bypassFuse) {
      options.headers.set('X-Bypass-Fuse', 'true');
    }

    const response = await request(testUrl.value, options);
    const endTime = Date.now();

    result.success = response.ok;
    result.statusCode = response.status;
    result.duration = endTime - startTime;

    if (result.success) {
      showToast(`请求成功！状态码: ${response.status}`, 'success');
    } else {
      showToast(`请求失败！状态码: ${response.status}`, 'error');
    }
  } catch (error: any) {
    const endTime = Date.now();
    result.success = false;
    result.duration = endTime - startTime;
    result.errorType = error.type;
    result.errorMessage = error.message;

    // 根据错误类型显示不同的提示
    if (error.type === ErrorType.FUSE) {
      showToast(error.message, 'error', true, () => sendRequest(true));
    } else {
      showToast(`${error.message} (${error.type})`, 'error');
    }
  } finally {
    results.value.push(result);
    isSending.value = false;
  }
};

// 显示Toast
const showToast = (
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  showRetry: boolean = false,
  retryAction?: () => Promise<void>
) => {
  toasts.value.push({
    message,
    type,
    duration: showRetry ? 10000 : 3000,
    showRetry,
    retryAction
  });
};

// 移除Toast
const removeToast = (index: number) => {
  toasts.value.splice(index, 1);
};

// 重置熔断器
const handleResetFuse = () => {
  resetFuse();
  showToast('熔断器已重置', 'success');
};

// 组件挂载时初始化
onMounted(() => {
  console.log('HTTP 请求超时-重试-熔断器示例已启动');
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-header {
  background-color: #001529;
  color: white;
  padding: 20px 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.app-header h1 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
}

.app-tabs {
  display: flex;
  gap: 8px;
  padding: 0 40px;
  background-color: #001529;
  border-bottom: 1px solid #1d2129;
}

.tab-button {
  padding: 12px 24px;
  background-color: transparent;
  color: rgba(255, 255, 255, 0.8);
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.05);
}

.tab-button.active {
  color: white;
  border-bottom-color: #1890ff;
  background-color: rgba(24, 144, 255, 0.1);
}

.tab-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fuse-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 14px;
  opacity: 0.8;
}

.status-value {
  font-size: 14px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-closed {
  background-color: #52c41a;
  color: white;
}

.status-open {
  background-color: #f5222d;
  color: white;
}

.status-half-open {
  background-color: #faad14;
  color: white;
}

.cool-down-time {
  font-size: 12px;
  opacity: 0.8;
}

.app-main {
  flex: 1;
  padding: 40px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.test-section {
  background-color: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.test-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

@media (min-width: 768px) {
  .test-controls {
    flex-direction: row;
    align-items: flex-end;
  }
}

.url-input-group {
  flex: 1;
  min-width: 200px;
}

.url-input-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.url-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.url-input:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.timeout-input-group, .retry-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
}

.timeout-input-group label, .retry-input-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.timeout-input, .retry-input {
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
  transition: border-color 0.3s ease;
}

.timeout-input:focus, .retry-input:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.button-group {
  display: flex;
  gap: 12px;
  min-width: 200px;
}

.send-button, .reset-button {
  padding: 10px 20px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.send-button {
  background-color: #1890ff;
  color: white;
}

.send-button:hover:not(:disabled) {
  background-color: #40a9ff;
}

.send-button:disabled {
  background-color: #adc6ff;
  cursor: not-allowed;
}

.reset-button {
  background-color: #f0f0f0;
  color: #333;
  border-color: #d9d9d9;
}

.reset-button:hover {
  background-color: #e0e0e0;
}

.loading {
  display: inline-block;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.test-results {
  border-top: 1px solid #f0f0f0;
  padding-top: 24px;
}

.test-results h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.no-results {
  text-align: center;
  padding: 40px 0;
  color: #999;
  background-color: #fafafa;
  border-radius: 4px;
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  background-color: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.result-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.result-success {
  border-left: 4px solid #52c41a;
}

.result-error {
  border-left: 4px solid #f5222d;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-status {
  font-size: 14px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.result-success .result-status {
  background-color: #52c41a;
  color: white;
}

.result-error .result-status {
  background-color: #f5222d;
  color: white;
}

.result-time {
  font-size: 12px;
  color: #999;
}

.result-details p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}
</style>