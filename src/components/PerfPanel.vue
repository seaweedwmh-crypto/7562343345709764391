<template>
  <div class="perf-panel">
    <div class="perf-panel-header">
      <h3>性能面板</h3>
      <button 
        class="toggle-button"
        @click="togglePanel"
      >
        {{ isExpanded ? '收起' : '展开' }}
      </button>
    </div>
    
    <div v-if="isExpanded" class="perf-panel-content">
      <div class="perf-metrics">
        <div class="metric-item">
          <div class="metric-label">FPS</div>
          <div class="metric-value" :class="getFpsClass(fps)">{{ fps.toFixed(1) }}</div>
        </div>
        
        <div class="metric-item">
          <div class="metric-label">渲染耗时</div>
          <div class="metric-value" :class="getRenderTimeClass(renderTime)">{{ renderTime.toFixed(2) }}ms</div>
        </div>
        
        <div class="metric-item">
          <div class="metric-label">DOM节点数</div>
          <div class="metric-value">{{ domNodeCount }}</div>
        </div>
        
        <div class="metric-item">
          <div class="metric-label">内存使用</div>
          <div class="metric-value">{{ formatMemory(memoryUsage) }}</div>
        </div>
      </div>
      
      <div class="perf-charts">
        <div class="chart-container">
          <div class="chart-label">FPS趋势</div>
          <div class="chart">
            <div 
              v-for="(value, index) in fpsHistory" 
              :key="index"
              class="chart-bar"
              :style="{ 
                height: `${Math.max(0, Math.min(100, (value / 60) * 100))}%`,
                backgroundColor: getFpsColor(value)
              }"
              title="FPS: {{ value.toFixed(1) }}"
            ></div>
          </div>
        </div>
        
        <div class="chart-container">
          <div class="chart-label">渲染耗时趋势</div>
          <div class="chart">
            <div 
              v-for="(value, index) in renderTimeHistory" 
              :key="index"
              class="chart-bar"
              :style="{ 
                height: `${Math.max(0, Math.min(100, (value / 30) * 100))}%`,
                backgroundColor: getRenderTimeColor(value)
              }"
              title="渲染耗时: {{ value.toFixed(2) }}ms"
            ></div>
          </div>
        </div>
      </div>
      
      <div class="perf-events">
        <div class="events-label">关键事件</div>
        <div class="events-list">
          <div 
            v-for="(event, index) in events" 
            :key="index"
            class="event-item"
            :class="event.type"
          >
            <div class="event-time">{{ formatTime(event.timestamp) }}</div>
            <div class="event-message">{{ event.message }}</div>
            <div class="event-duration" v-if="event.duration">耗时: {{ event.duration.toFixed(2) }}ms</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

// 组件props
const props = defineProps<{
  visible?: boolean;
  maxHistory?: number;
}>();

// 组件emit
const emit = defineEmits<{
  (e: 'toggle', isExpanded: boolean): void;
  (e: 'clearEvents'): void;
}>();

// 状态
const isExpanded = ref(true);
const fps = ref(0);
const renderTime = ref(0);
const domNodeCount = ref(0);
const memoryUsage = ref(0);

// 历史数据
const fpsHistory = ref<number[]>([]);
const renderTimeHistory = ref<number[]>([]);
const events = ref<{
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error';
  duration?: number;
}[]>([]);

// 配置
const maxHistory = computed(() => props.maxHistory || 50);

// FPS计算相关
let frameCount = 0;
let lastFpsUpdateTime = 0;
let animationFrameId: number | null = null;

// PerformanceObserver实例
let performanceObserver: PerformanceObserver | null = null;

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
};

// 格式化内存
const formatMemory = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 获取FPS颜色
const getFpsColor = (fps: number): string => {
  if (fps >= 50) return '#52c41a'; // 绿色
  if (fps >= 30) return '#faad14'; // 黄色
  return '#f5222d'; // 红色
};

// 获取FPS类名
const getFpsClass = (fps: number): string => {
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'warning';
  return 'error';
};

// 获取渲染时间颜色
const getRenderTimeColor = (time: number): string => {
  if (time <= 16) return '#52c41a'; // 绿色
  if (time <= 30) return '#faad14'; // 黄色
  return '#f5222d'; // 红色
};

// 获取渲染时间类名
const getRenderTimeClass = (time: number): string => {
  if (time <= 16) return 'good';
  if (time <= 30) return 'warning';
  return 'error';
};

// 切换面板展开状态
const togglePanel = () => {
  isExpanded.value = !isExpanded.value;
  emit('toggle', isExpanded.value);
};

// 清除事件
const clearEvents = () => {
  events.value = [];
  emit('clearEvents');
};

// 添加事件
const addEvent = (message: string, type: 'info' | 'warning' | 'error' = 'info', duration?: number) => {
  events.value.unshift({
    timestamp: performance.now(),
    message,
    type,
    duration
  });
  
  // 限制事件数量
  if (events.value.length > 20) {
    events.value = events.value.slice(0, 20);
  }
};

// 计算FPS
const calculateFps = () => {
  const now = performance.now();
  frameCount++;
  
  if (now - lastFpsUpdateTime >= 1000) {
    fps.value = (frameCount * 1000) / (now - lastFpsUpdateTime);
    
    // 更新历史数据
    fpsHistory.value.push(fps.value);
    if (fpsHistory.value.length > maxHistory.value) {
      fpsHistory.value = fpsHistory.value.slice(-maxHistory.value);
    }
    
    frameCount = 0;
    lastFpsUpdateTime = now;
  }
  
  animationFrameId = requestAnimationFrame(calculateFps);
};

// 计算DOM节点数
const calculateDomNodeCount = () => {
  domNodeCount.value = document.querySelectorAll('*').length;
};

// 计算内存使用
const calculateMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    memoryUsage.value = memory.usedJSHeapSize;
  }
};

// 初始化性能监控
const initPerformanceMonitoring = () => {
  // 创建PerformanceObserver实例
  performanceObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    
    entries.forEach((entry) => {
      if (entry.entryType === 'frame') {
        // 计算渲染耗时
        if (entry.duration) {
          renderTime.value = entry.duration;
          
          // 更新历史数据
          renderTimeHistory.value.push(renderTime.value);
          if (renderTimeHistory.value.length > maxHistory.value) {
            renderTimeHistory.value = renderTimeHistory.value.slice(-maxHistory.value);
          }
        }
      } else if (entry.entryType === 'measure') {
        // 添加性能测量事件
        addEvent(
          `${entry.name}`,
          'info',
          entry.duration
        );
      }
    });
  });
  
  // 订阅frame和measure事件
  performanceObserver.observe({ entryTypes: ['frame', 'measure'] });
  
  // 定期计算DOM节点数和内存使用
  setInterval(() => {
    calculateDomNodeCount();
    calculateMemoryUsage();
  }, 1000);
  
  // 开始计算FPS
  calculateFps();
  
  // 添加初始化事件
  addEvent('性能面板初始化完成', 'info');
};

// 组件挂载后初始化
onMounted(() => {
  initPerformanceMonitoring();
});

// 组件卸载前清理
onUnmounted(() => {
  // 停止性能监控
  if (performanceObserver) {
    performanceObserver.disconnect();
    performanceObserver = null;
  }
  
  // 停止FPS计算
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
});

// 监听visible属性变化
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible && !performanceObserver) {
      initPerformanceMonitoring();
    } else if (!newVisible && performanceObserver) {
      performanceObserver.disconnect();
      performanceObserver = null;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  }
);
</script>

<style scoped>
.perf-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  width: 320px;
  max-height: calc(100vh - 40px);
  overflow: hidden;
}

.perf-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
  border-radius: 8px 8px 0 0;
}

.perf-panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.toggle-button {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-button:hover {
  background-color: #f5f5f5;
  border-color: #1890ff;
}

.perf-panel-content {
  padding: 16px;
}

.perf-metrics {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 70px;
}

.metric-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  min-width: 50px;
  text-align: center;
}

.metric-value.good {
  color: #52c41a;
}

.metric-value.warning {
  color: #faad14;
}

.metric-value.error {
  color: #f5222d;
}

.perf-charts {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-label {
  font-size: 12px;
  color: #999;
}

.chart {
  display: flex;
  height: 80px;
  gap: 2px;
  align-items: flex-end;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  padding: 8px;
  background-color: #fafafa;
}

.chart-bar {
  flex: 1;
  min-width: 2px;
  border-radius: 2px;
  transition: height 0.3s ease;
}

.perf-events {
  max-height: 200px;
  overflow-y: auto;
}

.events-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-item {
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  border-left: 3px solid;
}

.event-item.info {
  background-color: #f6ffed;
  border-left-color: #52c41a;
  color: #2f54eb;
}

.event-item.warning {
  background-color: #fffbe6;
  border-left-color: #faad14;
  color: #faad14;
}

.event-item.error {
  background-color: #fff2f0;
  border-left-color: #f5222d;
  color: #f5222d;
}

.event-time {
  font-size: 10px;
  color: #999;
  margin-bottom: 2px;
}

.event-duration {
  font-size: 10px;
  color: #999;
  margin-top: 2px;
}

/* 滚动条样式 */
.perf-events::-webkit-scrollbar {
  width: 4px;
}

.perf-events::-webkit-scrollbar-track {
  background-color: #f0f0f0;
  border-radius: 2px;
}

.perf-events::-webkit-scrollbar-thumb {
  background-color: #d9d9d9;
  border-radius: 2px;
}

.perf-events::-webkit-scrollbar-thumb:hover {
  background-color: #b0b0b0;
}
</style>
