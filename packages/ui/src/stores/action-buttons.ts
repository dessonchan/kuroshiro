import type { ActionButton } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useActionButtonStore = defineStore('action-buttons', () => {
  const actionButtons = ref<ActionButton[]>([])

  async function fetchActionButtons(deviceId: string) {
    const res = await fetch(`/api/devices/${deviceId}/action-buttons`)
    if (res.ok) {
      actionButtons.value = await res.json()
    }
  }

  async function createActionButton(deviceId: string, data: Partial<ActionButton>) {
    const res = await fetch(`/api/devices/${deviceId}/action-buttons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const created = await res.json()
      actionButtons.value.push(created)
      return created
    }
    return null
  }

  async function updateActionButton(id: string, data: Partial<ActionButton>) {
    const res = await fetch(`/api/action-buttons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      const idx = actionButtons.value.findIndex(ab => ab.id === id)
      if (idx !== -1)
        actionButtons.value[idx] = updated
      return updated
    }
    return null
  }

  async function deleteActionButton(id: string) {
    const res = await fetch(`/api/action-buttons/${id}`, { method: 'DELETE' })
    if (res.ok) {
      actionButtons.value = actionButtons.value.filter(ab => ab.id !== id)
    }
  }

  return { actionButtons, fetchActionButtons, createActionButton, updateActionButton, deleteActionButton }
})
