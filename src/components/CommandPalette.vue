<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useShortcut } from '../utils/shortcuts'

interface Command {
  id: string
  label: string
  description?: string
  shortcut?: string[]
  action: () => void
  category?: string
  disabled?: boolean
}

interface Props {
  modelValue: boolean
  toggleTheme?: (theme: 'light' | 'dark' | 'system') => void
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 从props接收toggleTheme方法
console.log('CommandPalette props:', props)

const searchQuery = ref('')
const selectedIndex = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)
const isMac = ref(false)

onMounted(() => {
  isMac.value = navigator.platform.includes('Mac')
})

const commands = computed(() => [
  // 导航命令
  { id: 'nav-home', label: '返回首页', shortcut: ['CmdOrCtrl', 'H'], action: () => console.log('跳转首页'), category: '导航' },
  { id: 'nav-dashboard', label: '仪表盘', shortcut: ['CmdOrCtrl', 'D'], action: () => console.log('打开仪表盘'), category: '导航' },
  { id: 'nav-settings', label: '设置', shortcut: ['CmdOrCtrl', ','], action: () => console.log('打开设置'), category: '导航' },
  { id: 'nav-help', label: '帮助中心', shortcut: ['F1'], action: () => console.log('打开帮助'), category: '导航' },
  
  // 主题命令
  { id: 'theme-light', label: '浅色主题', description: '切换到浅色模式', action: () => { console.log('theme-light clicked'); props.toggleTheme?.('light') }, category: '主题' },
  { id: 'theme-dark', label: '深色主题', description: '切换到深色模式', action: () => { console.log('theme-dark clicked'); props.toggleTheme?.('dark') }, category: '主题' },
  { id: 'theme-system', label: '系统主题', description: '跟随系统主题', action: () => { console.log('theme-system clicked'); props.toggleTheme?.('system') }, category: '主题' },
  
  // 工具命令
  { id: 'clear-cache', label: '清理缓存', description: '清除应用缓存数据', action: () => console.log('清理缓存'), category: '工具' },
  { id: 'refresh-page', label: '刷新页面', shortcut: ['CmdOrCtrl', 'R'], action: () => window.location.reload(), category: '工具' },
  { id: 'fullscreen', label: '全屏模式', shortcut: ['F11'], action: () => document.documentElement.requestFullscreen(), category: '工具' },
  { id: 'toggle-devtools', label: '开发者工具', shortcut: ['CmdOrCtrl', 'Shift', 'I'], action: () => console.log('打开开发者工具'), category: '工具' },
  
  // 编辑命令
  { id: 'select-all', label: '全选', shortcut: ['CmdOrCtrl', 'A'], action: () => document.execCommand('selectAll'), category: '编辑' },
  { id: 'copy', label: '复制', shortcut: ['CmdOrCtrl', 'C'], action: () => document.execCommand('copy'), category: '编辑' },
  { id: 'paste', label: '粘贴', shortcut: ['CmdOrCtrl', 'V'], action: () => document.execCommand('paste'), category: '编辑' },
  { id: 'cut', label: '剪切', shortcut: ['CmdOrCtrl', 'X'], action: () => document.execCommand('cut'), category: '编辑' },
  
  // 应用命令
  { id: 'about', label: '关于应用', action: () => console.log('打开关于页面'), category: '应用' },
  { id: 'feedback', label: '反馈意见', action: () => console.log('打开反馈表单'), category: '应用' },
  { id: 'changelog', label: '更新日志', action: () => console.log('查看更新日志'), category: '应用' },
  { id: 'logout', label: '退出登录', action: () => console.log('执行退出登录'), category: '应用' },
])

// 按分类分组命令
const groupedCommands = computed(() => {
  if (!searchQuery.value) {
    return commands.value.reduce((groups, command) => {
      const category = command.category || '未分类'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(command)
      return groups
    }, {} as Record<string, Command[]>)
  }
  
  const query = searchQuery.value.toLowerCase()
  const filtered = commands.value.filter(cmd => 
    cmd.label.toLowerCase().includes(query) || 
    cmd.description?.toLowerCase().includes(query) ||
    cmd.id.toLowerCase().includes(query) ||
    (cmd.category?.toLowerCase().includes(query) ?? false)
  ).slice(0, 20)
  
  return filtered.reduce((groups, command) => {
    const category = command.category || '未分类'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(command)
    return groups
  }, {} as Record<string, Command[]>)
})

// 获取所有分组的命令数量
const totalCommands = computed(() => {
  return Object.values(groupedCommands.value).reduce((total, group) => total + group.length, 0)
})

const isEmpty = computed(() => totalCommands.value === 0)

const highlightText = (text: string) => {
  if (!searchQuery.value) return text
  const query = searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<span class="cp-highlight">$1</span>')
}

const executeCommand = (command?: Command) => {
  if (!command || command.disabled) return
  
  command.action()
  closePalette()
}

// 根据索引获取命令
const getCommandByIndex = (index: number) => {
  return flattenedCommands.value[index]
}

// 转换为扁平数组以便键盘导航
const flattenedCommands = computed(() => {
  return Object.values(groupedCommands.value).flat()
})

const selectNext = () => {
  if (isEmpty.value) return
  selectedIndex.value = (selectedIndex.value + 1) % flattenedCommands.value.length
  scrollToSelected()
}

const selectPrevious = () => {
  if (isEmpty.value) return
  selectedIndex.value = (selectedIndex.value - 1 + flattenedCommands.value.length) % flattenedCommands.value.length
  scrollToSelected()
}

const scrollToSelected = () => {
  const list = document.querySelector('.cp-list') as HTMLElement
  // 找到当前选中的命令元素
  const flattened = flattenedCommands.value
  let currentIndex = 0
  let found = false
  
  for (const [category, commands] of Object.entries(groupedCommands.value)) {
    // 跳过分组标题
    currentIndex++
    
    for (let i = 0; i < commands.length; i++) {
      if (currentIndex - 1 === selectedIndex.value) {
        const item = list.children[currentIndex] as HTMLElement
        if (item) {
          const listHeight = list.clientHeight
          const itemHeight = item.clientHeight
          const itemTop = item.offsetTop
          const itemBottom = itemTop + itemHeight
          
          if (itemTop < list.scrollTop) {
            list.scrollTop = itemTop
          } else if (itemBottom > list.scrollTop + listHeight) {
            list.scrollTop = itemBottom - listHeight
          }
        }
        found = true
        break
      }
      currentIndex++
    }
    
    if (found) break
  }
}

const closePalette = () => {
  emit('update:modelValue', false)
  searchQuery.value = ''
  selectedIndex.value = -1
}

const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectNext()
      break
    case 'ArrowUp':
      e.preventDefault()
      selectPrevious()
      break
    case 'Enter':
      e.preventDefault()
      executeCommand(getCommandByIndex(selectedIndex.value))
      break
    case 'Escape':
      e.preventDefault()
      closePalette()
      break
    case 'Tab':
      e.preventDefault()
      if (e.shiftKey) selectPrevious()
      else selectNext()
      break
  }
}

watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      inputRef.value?.focus()
      selectedIndex.value = 0
    }, 100)
  }
})

onMounted(() => {
  useShortcut(['CmdOrCtrl', 'K'], (e) => {
    e.preventDefault()
    emit('update:modelValue', !props.modelValue)
  })
})

onUnmounted(() => {
  // 清理快捷键
})
</script>

<template>
  <Transition name="cp-fade">
    <div 
      v-if="modelValue"
      class="cp-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cp-title"
      @click="closePalette"
    >
      <div 
        class="cp-container"
        @click.stop
        @keydown="handleKeyDown"
      >
        <h2 id="cp-title" class="sr-only">命令面板</h2>
        
        <div class="cp-header">
          <span class="cp-search-icon">🔍</span>
          <input
            ref="inputRef"
            v-model="searchQuery"
            class="cp-input"
            placeholder="搜索命令…"
            aria-label="搜索命令"
            autocomplete="off"
            spellcheck="false"
          />
          <!-- 调试按钮 -->
          <div style="display: flex; gap: 8px; margin-left: 12px;">
            <button @click="props.toggleTheme?.('light')" style="padding: 4px 8px; background: #fff; border: 1px solid #ddd; border-radius: 4px;">浅色</button>
            <button @click="props.toggleTheme?.('dark')" style="padding: 4px 8px; background: #333; color: #fff; border: 1px solid #ddd; border-radius: 4px;">深色</button>
          </div>
        </div>
        
        <div class="cp-list-wrapper">
          <div class="cp-list">
            <TransitionGroup name="cp-item" tag="div">
              <!-- 分组显示命令 -->
              <template v-for="(commands, category) in groupedCommands" :key="category">
                <!-- 分组标题 -->
                <div class="cp-group-header">
                  {{ category }}
                </div>
                
                <!-- 组内命令 -->
                <div
                  v-for="(command, index) in commands"
                  :key="command.id"
                  class="cp-item"
                  :class="{
                    'cp-item-selected': flattenedCommands.indexOf(command) === selectedIndex,
                    'cp-item-disabled': command.disabled
                  }"
                  @click="executeCommand(command)"
                  @keydown.enter="executeCommand(command)"
                  role="option"
                  :aria-selected="flattenedCommands.indexOf(command) === selectedIndex"
                >
                  <div class="cp-item-content">
                    <span class="cp-item-label" v-html="highlightText(command.label)"></span>
                    <span class="cp-item-description" v-if="command.description">{{ command.description }}</span>
                  </div>
                  
                  <div class="cp-item-shortcut" v-if="command.shortcut">
                    <kbd v-for="(key, i) in command.shortcut" :key="i" class="cp-key">
                      {{ key === 'CmdOrCtrl' ? (isMac ? '⌘' : 'Ctrl') : key }}
                    </kbd>
                  </div>
                </div>
              </template>
            </TransitionGroup>
            
            <div v-if="isEmpty" class="cp-empty">
              <span class="cp-empty-icon">🔍</span>
              <p>未找到命令</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cp-fade-enter-active,
.cp-fade-leave-active {
  transition: opacity 120ms ease;
}

.cp-fade-enter-from,
.cp-fade-leave-to {
  opacity: 0;
}

.cp-item-enter-active,
.cp-item-leave-active {
  transition: all 120ms ease;
}

.cp-item-enter-from,
.cp-item-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.cp-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 64px 20px;
  z-index: 10000;
  overflow: hidden;
}

.cp-container {
  width: 100%;
  max-width: 640px;
  background-color: var(--cp-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  outline: none;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.cp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--cp-border, #e5e7eb);
}

.cp-search-icon {
  font-size: 18px;
  color: var(--cp-text-secondary, #6b7280);
  flex-shrink: 0;
}

.cp-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  font-family: inherit;
  color: var(--cp-text, #111827);
  background: transparent;
  padding: 8px 0;
}

.cp-input::placeholder {
  color: var(--cp-text-secondary, #9ca3af);
}

.cp-list-wrapper {
  flex: 1;
  overflow: hidden;
}

.cp-list {
  height: 100%;
  overflow-y: auto;
  padding: 8px 0;
}

.cp-group-header {
  padding: 8px 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 8px;
}

.cp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  padding-left: 32px; /* 缩进以区分分组 */
  cursor: pointer;
  transition: background-color 80ms ease;
  border-radius: 8px;
  margin: 0 8px;
}

.cp-item:hover:not(.cp-item-disabled) {
  background-color: var(--cp-hover, #f3f4f6);
}

.cp-item-selected {
  background-color: var(--cp-accent, #eff6ff);
}

.cp-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cp-item-content {
  flex: 1;
  min-width: 0;
}

.cp-item-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--cp-text, #111827);
  margin-bottom: 2px;
}

.cp-item-description {
  display: block;
  font-size: 12px;
  color: var(--cp-text-secondary, #6b7280);
}

.cp-highlight {
  background-color: var(--cp-highlight, #fef3c7);
  color: var(--cp-text, #111827);
  border-radius: 3px;
  padding: 0 2px;
}

.cp-item-shortcut {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.cp-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--cp-text-secondary, #6b7280);
  background-color: var(--cp-key-bg, #f3f4f6);
  border: 1px solid var(--cp-border, #e5e7eb);
  border-radius: 4px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
}

.cp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  color: var(--cp-text-secondary, #6b7280);
}

.cp-empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.cp-empty p {
  font-size: 14px;
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 滚动条样式 */
.cp-list::-webkit-scrollbar {
  width: 8px;
}

.cp-list::-webkit-scrollbar-track {
  background: transparent;
}

.cp-list::-webkit-scrollbar-thumb {
  background: var(--cp-border, #e5e7eb);
  border-radius: 4px;
}

.cp-list::-webkit-scrollbar-thumb:hover {
  background: var(--cp-text-secondary, #9ca3af);
}
</style>