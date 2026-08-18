import type { CurrentScreen, Screen } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type UpdateScreen = Partial<Pick<Screen, 'enableSchedule'>>

export const useScreensStore = defineStore('screens', () => {
  const screens = ref<Screen[]>([])
  const currentScreen = ref<CurrentScreen | null>(null)

  async function fetchScreensForDevice(deviceId: string) {
    const res = await fetch(`/api/screens/device/${deviceId}`)
    screens.value = await res.json()
  }

  async function fetchCurrentScreenForDevice(mac: string, apikey: string) {
    const res = await fetch(`/api/current_screen`, {
      headers: {
        'id': mac,
        'access-token': apikey,
      },
    })
    currentScreen.value = await res.json()
  }

  async function addScreen(deviceId: string, externalLink: string, fetchManual: boolean, filename: string) {
    const res = await fetch('/api/screens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, filename, externalLink, fetchManual }),
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function addScreenFile(deviceId: string, file: File, filename: string) {
    const formData = new FormData()
    formData.append('deviceId', deviceId)
    formData.append('filename', filename)
    formData.append('file', file)
    const res = await fetch('/api/screens', {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function addScreenHtml(deviceId: string, html: string, filename: string) {
    const res = await fetch('/api/screens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, filename, html }),
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function deleteScreen(deviceId: string, screenId: string) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function updateExternalScreen(deviceId: string, screenId: string) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'POST',
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function reorderScreens(deviceId: string, screenIds: string[]) {
    const res = await fetch(`/api/screens/device/${deviceId}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenIds }),
    })
    if (!res.ok) {
      await fetchScreensForDevice(deviceId)
      throw new Error('Failed to reorder screens')
    }
    screens.value = await res.json()
  }

  async function updateScreen(screenId: string, update: UpdateScreen) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (res.ok) {
      // Refresh screens for the device that owns this screen
      const screen = screens.value.find(s => s.id === screenId)
      const deviceId = typeof screen?.device === 'string' ? screen.device : screen?.device?.id
      if (deviceId) {
        await fetchScreensForDevice(deviceId)
      }
    }
  }

  return { screens, currentScreen, fetchScreensForDevice, addScreen, addScreenFile, addScreenHtml, deleteScreen, updateExternalScreen, reorderScreens, updateScreen, fetchCurrentScreenForDevice }
})
