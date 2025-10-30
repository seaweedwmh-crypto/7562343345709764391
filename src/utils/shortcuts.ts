export type Key = 
  | 'CmdOrCtrl'
  | 'Shift'
  | 'Alt'
  | 'Ctrl'
  | 'Meta'
  | 'Enter'
  | 'Escape'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Tab'
  | string

interface ShortcutOptions {
  preventDefault?: boolean
  stopPropagation?: boolean
  target?: HTMLElement
}

export function useShortcut(
  keys: Key[],
  callback: (event: KeyboardEvent) => void,
  options?: ShortcutOptions
) {
  const { 
    preventDefault = true,
    stopPropagation = false,
    target = window
  } = options || {}

  const handleKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent
    // 检查所有修饰键
    const hasCmdOrCtrl = keys.includes('CmdOrCtrl') && 
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey)
    const hasShift = keys.includes('Shift') && keyboardEvent.shiftKey
    const hasAlt = keys.includes('Alt') && keyboardEvent.altKey
    const hasCtrl = keys.includes('Ctrl') && keyboardEvent.ctrlKey
    const hasMeta = keys.includes('Meta') && keyboardEvent.metaKey

    // 检查普通键
    const keyIndex = keys.findIndex(k => 
      k !== 'CmdOrCtrl' && 
      k !== 'Shift' && 
      k !== 'Alt' && 
      k !== 'Ctrl' && 
      k !== 'Meta'
    )

    const hasKey = keyIndex !== -1 ? 
      keyboardEvent.key.toLowerCase() === (keys[keyIndex]?.toLowerCase() ?? '') : 
      keys.length === 0

    // 验证所有条件
    const isValid = 
      (keys.includes('CmdOrCtrl') ? hasCmdOrCtrl : true) &&
      (keys.includes('Shift') ? hasShift : true) &&
      (keys.includes('Alt') ? hasAlt : true) &&
      (keys.includes('Ctrl') ? hasCtrl : true) &&
      (keys.includes('Meta') ? hasMeta : true) &&
      hasKey

    if (isValid) {
      if (preventDefault) keyboardEvent.preventDefault()
      if (stopPropagation) keyboardEvent.stopPropagation()
      callback(keyboardEvent)
    }
  }

  target.addEventListener('keydown', handleKeyDown as EventListener)

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener)
  }
}

export function isMac() {
  return navigator.platform.includes('Mac') || 
         navigator.userAgent.includes('Macintosh')
}

export function formatShortcut(keys: Key[]): string {
  return keys.map(key => {
    switch (key) {
      case 'CmdOrCtrl':
        return isMac() ? '⌘' : 'Ctrl'
      case 'Shift':
        return isMac() ? '⇧' : 'Shift'
      case 'Alt':
        return isMac() ? '⌥' : 'Alt'
      case 'Ctrl':
        return 'Ctrl'
      case 'Meta':
        return '⌘'
      case 'Enter':
        return 'Enter'
      case 'Escape':
        return 'Esc'
      case 'ArrowUp':
        return '↑'
      case 'ArrowDown':
        return '↓'
      case 'Tab':
        return 'Tab'
      default:
        return key.toUpperCase()
    }
  }).join('+')
}