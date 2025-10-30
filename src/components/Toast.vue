<template>
  <div v-if="visible" class="toast-container" :class="`toast-${type}`">
    <div class="toast-content">
      <div class="toast-message">{{ message }}</div>
      <div v-if="showRetry" class="toast-actions">
        <button @click="handleRetry" class="toast-button retry">重试一次</button>
        <button @click="handleClose" class="toast-button close">关闭</button>
      </div>
      <button v-else @click="handleClose" class="toast-close">&times;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  showRetry?: boolean;
  retryAction?: () => Promise<void>;
}

const props = withDefaults(defineProps<ToastOptions>(), {
  type: 'info',
  duration: 3000,
  showRetry: false,
  retryAction: undefined
});

const emit = defineEmits<{
  close: [];
}>();

const visible = ref(true);
const isRetrying = ref(false);

// 自动关闭定时器
let timer: number | null = null;

// 监听visible变化，控制自动关闭
watch(visible, (newValue: boolean) => {
  if (newValue && props.duration > 0) {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      visible.value = false;
      emit('close');
    }, props.duration);
  }
});

// 处理重试
const handleRetry = async () => {
  if (!props.retryAction || isRetrying.value) return;

  try {
    isRetrying.value = true;
    await props.retryAction();
    visible.value = false;
    emit('close');
  } catch (error) {
    console.error('重试失败:', error);
  } finally {
    isRetrying.value = false;
  }
};

// 处理关闭
const handleClose = () => {
  visible.value = false;
  emit('close');
};

// 清理定时器
onMounted(() => {
  return () => {
    if (timer) clearTimeout(timer);
  };
});
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  min-width: 300px;
  max-width: 400px;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideInRight 0.3s ease-out;
}

.toast-container.toast-success {
  background-color: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
}

.toast-container.toast-error {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  color: #f5222d;
}

.toast-container.toast-warning {
  background-color: #fffbe6;
  border: 1px solid #ffeeba;
  color: #faad14;
}

.toast-container.toast-info {
  background-color: #f0f5ff;
  border: 1px solid #adc6ff;
  color: #1890ff;
}

.toast-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toast-message {
  flex: 1;
  margin-right: 16px;
  word-break: break-word;
  line-height: 1.4;
}

.toast-actions {
  display: flex;
  gap: 8px;
}

.toast-button {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toast-button.retry {
  background-color: #1890ff;
  color: white;
}

.toast-button.retry:hover:not(:disabled) {
  background-color: #40a9ff;
}

.toast-button.retry:disabled {
  background-color: #adc6ff;
  cursor: not-allowed;
}

.toast-button.close {
  background-color: transparent;
  color: #666;
  border-color: #d9d9d9;
}

.toast-button.close:hover {
  background-color: #f5f5f5;
}

.toast-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: inherit;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.toast-close:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>