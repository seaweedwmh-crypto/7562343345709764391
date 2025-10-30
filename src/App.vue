<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import TheWelcome from './components/TheWelcome.vue'
import CommandPalette from './components/CommandPalette.vue'
import { ref } from 'vue'

const showCommandPalette = ref(false)
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

    <CommandPalette v-model="showCommandPalette" />
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
