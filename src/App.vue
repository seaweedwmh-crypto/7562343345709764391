<template>
  <div id="app" class="app-container">
    <header class="app-header">
      <h1>虚拟滚动列表 + 图片懒加载 + 性能面板示例</h1>
    </header>

    <main class="app-main">
      <div class="virtual-list-section">
        <h2>虚拟滚动列表 (10,000 条数据)</h2>
        <div class="list-container">
          <VirtualList 
            :container-height="800"
            :item-height="100"
            :buffer-size="5"
            :overscan="10"
          />
        </div>
      </div>
    </main>

    <!-- 性能面板 -->
    <PerfPanel />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import VirtualList from './views/VirtualList.vue';
import PerfPanel from './components/PerfPanel.vue';

// 组件挂载时初始化
onMounted(() => {
  console.log('虚拟滚动列表 + 图片懒加载 + 性能面板示例已启动');
  
  // 调试代码：查看页面高度和宽度
  console.log('页面高度:', window.innerHeight);
  console.log('页面宽度:', window.innerWidth);
  
  // 查看虚拟列表容器的高度设置
  const listContainer = document.querySelector('.list-container');
  if (listContainer) {
    console.log('虚拟列表容器高度:', listContainer.clientHeight);
    console.log('虚拟列表容器max-height:', window.getComputedStyle(listContainer).maxHeight);
  }
  
  // 查看app-container的高度设置
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    console.log('app-container高度:', appContainer.clientHeight);
    console.log('app-container宽度:', appContainer.clientWidth);
  }
  
  // 查看body的高度设置
  console.log('body高度:', document.body.clientHeight);
  console.log('body宽度:', document.body.clientWidth);
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow: hidden;
  position: relative;
}

/* 确保body也没有滚动条 */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* 确保app-container占据整个视口 */
.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

/* 检查是否有元素超出视口 */
* {
  box-sizing: border-box;
  /* 调试边框，帮助查看元素是否超出视口 */
  border: 1px solid red;
}

/* 禁用调试边框的元素 */
img, .perf-panel, .virtual-list-item, .item-image {
  border: none;
}

/* 确保虚拟列表容器不会超出视口 */
.list-container {
  height: calc(100vh - 200px);
  overflow: hidden;
}

.app-header {
  background-color: #001529;
  color: white;
  padding: 20px 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.app-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.app-main {
  flex: 1;
  padding: 40px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.virtual-list-section {
  background-color: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.virtual-list-section h2 {
  margin: 0 0 24px 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.list-container {
  width: 100%;
  height: 800px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}
</style>

<style>
/* 引入滚动条样式 */
@import './styles/scroll.css';
</style>