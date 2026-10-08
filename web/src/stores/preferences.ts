import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { SortField, SortOrder, ThemeMode, ViewMode } from '@/types'

interface StoredPreferences {
  theme: ThemeMode
  defaultView: ViewMode
  sortField: SortField
  sortOrder: SortOrder
  showThumbnails: boolean
  autoRefresh: boolean
  showExtensions: boolean
  sidebarCollapsed: boolean
}

const STORAGE_KEY = 'dufs-preferences-v1'
const defaults: StoredPreferences = {
  theme: 'light',
  defaultView: 'medium',
  sortField: 'name',
  sortOrder: 'asc',
  showThumbnails: true,
  autoRefresh: true,
  showExtensions: true,
  sidebarCollapsed: false,
}

function load(): StoredPreferences {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { ...defaults }
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const stored = load()
  const theme = ref<ThemeMode>(stored.theme)
  const defaultView = ref<ViewMode>(stored.defaultView)
  const sortField = ref<SortField>(stored.sortField)
  const sortOrder = ref<SortOrder>(stored.sortOrder)
  const showThumbnails = ref(stored.showThumbnails)
  const autoRefresh = ref(stored.autoRefresh)
  const showExtensions = ref(stored.showExtensions)
  const sidebarCollapsed = ref(stored.sidebarCollapsed)
  const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = computed(() => theme.value === 'dark' || (theme.value === 'system' && systemDark.value))

  function persist(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: theme.value,
        defaultView: defaultView.value,
        sortField: sortField.value,
        sortOrder: sortOrder.value,
        showThumbnails: showThumbnails.value,
        autoRefresh: autoRefresh.value,
        showExtensions: showExtensions.value,
        sidebarCollapsed: sidebarCollapsed.value,
      } satisfies StoredPreferences),
    )
  }

  function applyTheme(): void {
    document.documentElement.classList.toggle('dark', isDark.value)
    document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      'content',
      isDark.value ? '#17191d' : '#f4f6f9',
    )
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', (event) => {
    systemDark.value = event.matches
    applyTheme()
  })
  watch(
    [theme, defaultView, sortField, sortOrder, showThumbnails, autoRefresh, showExtensions, sidebarCollapsed],
    () => {
      persist()
      applyTheme()
    },
    { deep: true },
  )
  applyTheme()

  return {
    theme,
    defaultView,
    sortField,
    sortOrder,
    showThumbnails,
    autoRefresh,
    showExtensions,
    sidebarCollapsed,
    isDark,
    applyTheme,
  }
})
