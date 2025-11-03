<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import TheWelcome from './components/TheWelcome.vue'
import CommandPalette from './components/CommandPalette.vue'
import { ref, computed, onMounted, watch } from 'vue'

const showCommandPalette = ref(false)

// 主题状态管理
const theme = ref<'light' | 'dark' | 'system'>('system')

// 监听系统主题变化
const systemTheme = ref('light')
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

const updateSystemTheme = () => {
  systemTheme.value = mediaQuery.matches ? 'dark' : 'light'
}

// 计算当前应用的实际主题
const currentTheme = computed(() => {
  if (theme.value === 'system') {
    return systemTheme.value
  }
  return theme.value
})

// 切换主题的方法
const toggleTheme = (newTheme: 'light' | 'dark' | 'system') => {
  console.log('toggleTheme called with:', newTheme)
  theme.value = newTheme
}

// 应用主题到DOM
const applyTheme = () => {
  console.log('applyTheme called, currentTheme:', currentTheme.value)
  const htmlElement = document.documentElement
  
  // 移除所有主题类
  htmlElement.classList.remove('light', 'dark')
  
  // 应用当前主题
  if (currentTheme.value === 'dark') {
    htmlElement.classList.add('dark')
  } else {
    htmlElement.classList.add('light')
  }
  console.log('Theme classes applied:', htmlElement.classList)
}

// 初始化和监听主题变化
onMounted(() => {
  updateSystemTheme()
  mediaQuery.addEventListener('change', updateSystemTheme)
  applyTheme()
})

// 监听当前主题变化并应用
watch(currentTheme, () => {
  applyTheme()
})

// 导出方法供CommandPalette使用
defineExpose({
  toggleTheme
})
</script>

<template>
  <div class="app-container">
    <header>
      <img alt="Vue logo" class="logo" src="./assets/logo.svg" width="125" height="125" />

      <div class="wrapper">
        <HelloWorld msg="You did it!" />
        <p class="shortcut-hint">按 Cmd/Ctrl+K 打开命令面板</p>
      </div>
    </header>

    <main>
      <TheWelcome />
    </main>

    <CommandPalette v-model="showCommandPalette" :toggle-theme="toggleTheme" />
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

.shortcut-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
  font-style: italic;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

<style>
@import './styles/index.css';
</style>
