<template>
  <div class="virtual-list-container">
    <div 
      class="virtual-list-wrapper scroll-hidden"
      ref="listWrapper"
      @scroll="handleScroll"
    >
      <!-- 占位元素，用于创建正确的滚动高度 -->
      <div 
        class="virtual-list-placeholder"
        :style="{ height: totalHeight + 'px' }"
      ></div>
      
      <!-- 可视区域内的项目 -->
      <div 
        class="virtual-list-items"
        :style="{ transform: `translateY(${startIndex * averageItemHeight}px)` }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.id"
          class="virtual-list-item"
          :style="{ height: item.height + 'px' }"
          ref="itemRefs"
        >
          <div class="item-content">
            <div class="item-text">{{ item.text }}</div>
            <img
              v-if="item.imageUrl"
              class="item-image"
              :data-src="item.imageUrl"
              :src="svgPlaceholder"
              alt="Item image"
              @load="handleImageLoad"
              @error="handleImageError"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type {
  VirtualListItem,
  VirtualListConfig
} from '../utils/virtual';
import { calculateVisibleItems, generateMockData, debounce, throttle } from '../utils/virtual';

// 组件props
const props = defineProps<{
  items?: VirtualListItem[];
  containerHeight?: number;
  itemHeight?: number;
  bufferSize?: number;
  overscan?: number;
}>();

// 组件emit
const emit = defineEmits<{
  (e: 'scroll', scrollTop: number): void;
  (e: 'visibleItemsChange', items: VirtualListItem[]): void;
  (e: 'imageLoad', id: string | number): void;
  (e: 'imageError', id: string | number): void;
}>();

// 引用
const listWrapper = ref<HTMLDivElement | null>(null);
const itemRefs = ref<HTMLDivElement[]>([]);

// 状态
const scrollTop = ref(0);
const items = ref<VirtualListItem[]>([]);
const averageItemHeight = ref(100); // 平均项高度，用于预估滚动位置

// 配置
const config = computed<VirtualListConfig>(() => ({
  containerHeight: props.containerHeight || 600,
  itemHeight: averageItemHeight.value,
  bufferSize: props.bufferSize || 5,
  overscan: props.overscan || 10
}));

// 计算可视区域内的项目
const virtualState = computed(() => {
  return calculateVisibleItems(items.value, config.value, scrollTop.value);
});

const visibleItems = computed(() => virtualState.value.visibleItems);
const startIndex = computed(() => virtualState.value.startIndex);
const endIndex = computed(() => virtualState.value.endIndex);
const totalHeight = computed(() => virtualState.value.totalHeight);

// 图片懒加载观察者


// SVG占位图
const svgPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1 1"><defs><filter id="blur"><feGaussianBlur stdDeviation="0.005"/></filter></defs><rect width="100%" height="100%" fill="%23f0f0f0" filter="url(%23blur)"/><circle cx="0.5" cy="0.5" r="0.1" fill="%23e0e0e0" filter="url(%23blur)"/><path d="M0.5 0.7 L0.5 0.3 M0.3 0.5 L0.7 0.5" stroke="%23e0e0e0" stroke-width="0.02" filter="url(%23blur)"/></svg>';

// 性能测量标记
const performanceMarks = ref<Record<string, number>>({});

// 处理滚动事件
const handleScroll = throttle((e: Event) => {
  const target = e.target as HTMLDivElement;
  scrollTop.value = target.scrollTop;
  
  emit('scroll', scrollTop.value);
  emit('visibleItemsChange', visibleItems.value);
  
  // 性能测量
  performance.mark('scroll-handler-end');
  performance.measure('scroll-handler-duration', 'scroll-handler-start', 'scroll-handler-end');
  
  const measure = performance.getEntriesByName('scroll-handler-duration').pop();
  if (measure) {
    console.log(`滚动处理耗时: ${measure.duration.toFixed(2)}ms`);
    performance.clearMarks('scroll-handler-start');
    performance.clearMarks('scroll-handler-end');
    performance.clearMeasures('scroll-handler-duration');
  }
}, 16); // 约60fps

// 处理图片加载
const handleImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement;
  const itemId = (img.closest('.virtual-list-item') as HTMLElement)?.dataset.id;
  
  if (itemId) {
    emit('imageLoad', itemId);
  }
  
  // 添加loaded类，触发过渡效果
  img.classList.add('loaded');
};

// 处理图片错误
const handleImageError = (e: Event) => {
  const img = e.target as HTMLImageElement;
  const itemId = (img.closest('.virtual-list-item') as HTMLElement)?.dataset.id;
  
  if (itemId) {
    emit('imageError', itemId);
  }
  
  // 显示占位图
  img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1 1"><rect width="100%" height="100%" fill="%23f0f0f0"/></svg>';
};



// 模拟数据生成
const generateData = async () => {
  performance.mark('generate-data-start');
  
  // 生成10000条模拟数据
  const data = generateMockData(10000);
  items.value = data;
  
  // 计算平均项高度
  const totalHeight = data.reduce((sum, item) => sum + item.height, 0);
  averageItemHeight.value = totalHeight / data.length;
  
  performance.mark('generate-data-end');
  performance.measure('generate-data-duration', 'generate-data-start', 'generate-data-end');
  
  const measure = performance.getEntriesByName('generate-data-duration').pop();
  if (measure) {
    console.log(`数据生成耗时: ${measure.duration.toFixed(2)}ms`);
    performance.clearMarks('generate-data-start');
    performance.clearMarks('generate-data-end');
    performance.clearMeasures('generate-data-duration');
  }
  
  // 数据生成完成后，图片懒加载由浏览器原生loading="lazy"属性处理
}

// 组件挂载后初始化
onMounted(() => {
  performance.mark('component-mounted-start');
  
  // 生成模拟数据
  generateData();
  
  // 监听滚动容器的高度变化
  const resizeObserver = new ResizeObserver(() => {
    if (listWrapper.value) {
      config.value.containerHeight = listWrapper.value.clientHeight;
    }
  });
  
  if (listWrapper.value) {
    resizeObserver.observe(listWrapper.value);
  }
  
  performance.mark('component-mounted-end');
  performance.measure('component-mounted-duration', 'component-mounted-start', 'component-mounted-end');
  
  const measure = performance.getEntriesByName('component-mounted-duration').pop();
  if (measure) {
    console.log(`组件挂载耗时: ${measure.duration.toFixed(2)}ms`);
    performance.clearMarks('component-mounted-start');
    performance.clearMarks('component-mounted-end');
    performance.clearMeasures('component-mounted-duration');
  }
});

// 组件卸载前清理
onUnmounted(() => {
  // 清理性能标记
  performance.clearMarks();
  performance.clearMeasures();
});

// 监听items变化
watch(
  () => props.items,
  (newItems) => {
    if (newItems) {
      items.value = newItems;
      
      // 计算平均项高度
      const totalHeight = newItems.reduce((sum, item) => sum + item.height, 0);
      averageItemHeight.value = totalHeight / newItems.length;
    }
  },
  { deep: true }
);
</script>

<style scoped>
.virtual-list-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.virtual-list-wrapper {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
  -webkit-overflow-scrolling: touch; /* 流畅滚动 */
}

.virtual-list-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  opacity: 0;
  pointer-events: none;
}

.virtual-list-items {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transition: transform 0.1s ease-out; /* 平滑滚动 */
}

.virtual-list-item {
  width: 100%;
  border-bottom: 1px solid #e0e0e0;
  background-color: white;
  display: flex;
  align-items: center;
  padding: 16px;
  box-sizing: border-box;
  transition: background-color 0.2s ease;
}

.virtual-list-item:hover {
  background-color: #f5f5f5;
}

.item-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.item-text {
  flex: 1;
  font-size: 16px;
  color: #333;
  margin-right: 16px;
}

.item-image {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  background-color: #f0f0f0;
  transition: all 0.3s ease;
  opacity: 0;
  transform: scale(0.95);
}

.item-image.loaded {
  opacity: 1;
  transform: scale(1);
}
</style>
