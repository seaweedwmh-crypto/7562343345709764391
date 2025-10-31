/**
 * 虚拟列表核心逻辑
 * 实现可视区域计算、缓冲区管理和长任务切片
 */

// 定义虚拟列表项的类型
export interface VirtualListItem {
  id: string | number;
  height: number;
  [key: string]: any; // 其他自定义属性
}

// 定义虚拟列表的配置项
export interface VirtualListConfig {
  containerHeight: number; // 容器高度
  itemHeight: number; // 预估的项高度
  bufferSize: number; // 缓冲区大小（可视区域上下各显示多少项）
  overscan: number; // 预渲染的项数
}

// 定义虚拟列表的状态
export interface VirtualListState {
  scrollTop: number; // 当前滚动位置
  startIndex: number; // 可视区域开始索引
  endIndex: number; // 可视区域结束索引
  visibleItems: VirtualListItem[]; // 可视区域内的项
  totalHeight: number; // 列表总高度
}

/**
 * 计算可视区域内的项目
 * @param items 所有项目
 * @param config 虚拟列表配置
 * @param scrollTop 当前滚动位置
 * @returns 虚拟列表状态
 */
export function calculateVisibleItems(
  items: VirtualListItem[],
  config: VirtualListConfig,
  scrollTop: number
): VirtualListState {
  const { containerHeight, itemHeight, bufferSize } = config;
  
  // 计算开始索引和结束索引
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + bufferSize
  );
  
  // 获取可视区域内的项目
  const visibleItems = items.slice(startIndex, endIndex + 1);
  
  // 计算列表总高度
  const totalHeight = items.reduce((sum, item) => sum + item.height, 0);
  
  return {
    scrollTop,
    startIndex,
    endIndex,
    visibleItems,
    totalHeight
  };
}

/**
 * 生成模拟数据
 * @param count 数据数量
 * @param minHeight 最小项高度
 * @param maxHeight 最大项高度
 * @returns 模拟数据数组
 */
export function generateMockData(
  count: number,
  minHeight: number = 50,
  maxHeight: number = 150
): VirtualListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    height: Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight,
    text: `项目 ${index + 1}`,
    imageUrl: `https://picsum.photos/id/${index % 100}/120/80`
  }));
}

/**
 * 长任务切片处理
 * @param task 要处理的任务
 * @param batchSize 每批处理的数量
 * @returns Promise
 */
export function sliceTask<T, R>(
  task: (item: T) => R,
  items: T[],
  batchSize: number = 100
): Promise<R[]> {
  return new Promise((resolve) => {
    const results: R[] = [];
    let index = 0;
    
    function processBatch() {
      const batch = items.slice(index, index + batchSize);
      batch.forEach((item) => {
        results.push(task(item));
      });
      
      index += batchSize;
      
      if (index < items.length) {
        // 使用requestIdleCallback处理下一批
        requestIdleCallback(processBatch);
      } else {
        // 所有批次处理完毕
        resolve(results);
      }
    }
    
    // 开始处理第一批
    processBatch();
  });
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = window.setTimeout(() => {
      func(...args);
      timer = null;
    }, delay);
  };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit 限制时间
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
