<script setup lang="ts">
import type { ActionButton } from '@/types'
import { mdiArrowLeft, mdiArrowRight, mdiCheck, mdiDelete, mdiGestureTapButton, mdiPencil, mdiPlus } from '@mdi/js'
import { computed, onMounted, ref, watch } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VIcon, VRow, VSelect, VTextarea, VTextField } from 'vuetify/components'
import { useActionButtonStore } from '@/stores/action-buttons'
import { useDeviceStore } from '@/stores/device'
import { useScreensStore } from '@/stores/screens'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const actionButtonStore = useActionButtonStore()
const screensStore = useScreensStore()

const device = computed(() => deviceStore.getById(props.deviceId))
const editing = ref<Record<string, boolean>>({})

const availableButtons = computed(() => {
  const configured = new Set(actionButtonStore.actionButtons.map(ab => ab.button))
  return (device.value?.buttons ?? ['back', 'left', 'right', 'confirm']).filter(b => !configured.has(b))
})

const screenOptions = computed(() => {
  return screensStore.screens.map(s => ({
    title: s.filename ?? s.type ?? 'Untitled',
    value: s.id,
  }))
})

const webhookMethods = [
  { title: 'POST', value: 'POST' },
  { title: 'GET', value: 'GET' },
  { title: 'PUT', value: 'PUT' },
]

const actionTypes = [
  { title: 'Display Screen', value: 'display_screen' },
  { title: 'Webhook', value: 'webhook' },
]

const buttonIcons: Record<string, string> = {
  back: mdiArrowLeft,
  left: mdiArrowLeft,
  right: mdiArrowRight,
  confirm: mdiCheck,
}

// New action button form
const showAddForm = ref(false)
const newButton = ref('')
const newActionType = ref<'display_screen' | 'webhook'>('display_screen')
const newScreenId = ref<string | null>(null)
const newWebhookUrl = ref('')
const newWebhookMethod = ref('POST')
const newWebhookPayload = ref('')

function resetForm() {
  newButton.value = ''
  newActionType.value = 'display_screen'
  newScreenId.value = null
  newWebhookUrl.value = ''
  newWebhookMethod.value = 'POST'
  newWebhookPayload.value = ''
  showAddForm.value = false
}

async function addActionButton() {
  if (!newButton.value)
    return
  await actionButtonStore.createActionButton(props.deviceId, {
    button: newButton.value,
    actionType: newActionType.value,
    screenId: newActionType.value === 'display_screen' ? newScreenId.value : null,
    webhookUrl: newActionType.value === 'webhook' ? newWebhookUrl.value : null,
    webhookMethod: newActionType.value === 'webhook' ? newWebhookMethod.value : null,
    webhookPayload: newActionType.value === 'webhook' ? newWebhookPayload.value : null,
  })
  resetForm()
}

async function saveActionButton(ab: ActionButton) {
  await actionButtonStore.updateActionButton(ab.id, {
    actionType: ab.actionType,
    screenId: ab.screenId,
    webhookUrl: ab.webhookUrl,
    webhookMethod: ab.webhookMethod,
    webhookPayload: ab.webhookPayload,
  })
  editing.value[ab.id] = false
}

async function deleteActionButton(id: string) {
  await actionButtonStore.deleteActionButton(id)
}

watch(() => props.deviceId, () => {
  actionButtonStore.fetchActionButtons(props.deviceId)
}, { immediate: true })

onMounted(() => {
  if (device.value)
    screensStore.fetchScreensForDevice(device.value.id)
})
</script>

<template>
  <VCard v-if="device" class="mb-4">
    <VCardTitle class="d-flex align-center ga-2">
      <VIcon :icon="mdiGestureTapButton" size="20" />
      Action Buttons
    </VCardTitle>
    <VCardText>
      <!-- Configured action buttons -->
      <div v-for="ab in actionButtonStore.actionButtons" :key="ab.id" class="mb-3">
        <VRow align="center" dense>
          <VCol cols="auto">
            <VIcon :icon="buttonIcons[ab.button] ?? mdiGestureTapButton" size="20" />
            <span class="ml-1 font-weight-medium text-capitalize">{{ ab.button }}</span>
          </VCol>
          <VCol>
            <VSelect
              v-model="ab.actionType"
              :items="actionTypes"
              :disabled="!editing[ab.id]"
              density="compact"
              hide-details
              label="Action Type"
              class="mb-1"
            />
            <!-- Display Screen config -->
            <template v-if="ab.actionType === 'display_screen'">
              <VSelect
                v-model="ab.screenId"
                :items="screenOptions"
                :disabled="!editing[ab.id]"
                density="compact"
                hide-details
                label="Screen"
                class="mt-1"
              />
            </template>
            <!-- Webhook config -->
            <template v-if="ab.actionType === 'webhook'">
              <VTextField
                v-model="ab.webhookUrl"
                :disabled="!editing[ab.id]"
                density="compact"
                hide-details
                label="URL"
                class="mt-1"
                placeholder="https://example.com/webhook"
              />
              <VSelect
                v-model="ab.webhookMethod"
                :items="webhookMethods"
                :disabled="!editing[ab.id]"
                density="compact"
                hide-details
                label="Method"
                class="mt-1"
              />
              <VTextarea
                v-model="ab.webhookPayload"
                :disabled="!editing[ab.id]"
                density="compact"
                hide-details
                label="JSON Payload (optional)"
                class="mt-1"
                rows="2"
                placeholder="{&quot;key&quot;: &quot;value&quot;}"
              />
            </template>
          </VCol>
          <VCol cols="auto">
            <VBtn
              v-if="!editing[ab.id]"
              :icon="mdiPencil"
              variant="text"
              size="small"
              @click="editing[ab.id] = true"
            />
            <template v-else>
              <VBtn
                :icon="mdiCheck"
                variant="text"
                size="small"
                color="primary"
                @click="saveActionButton(ab)"
              />
            </template>
            <VBtn
              :icon="mdiDelete"
              variant="text"
              size="small"
              color="error"
              @click="deleteActionButton(ab.id)"
            />
          </VCol>
        </VRow>
        <VDivider class="mt-2" />
      </div>

      <!-- Empty state -->
      <div v-if="actionButtonStore.actionButtons.length === 0" class="text-center text-grey py-4">
        No action buttons configured
      </div>

      <!-- Add new button -->
      <div class="mt-3">
        <VBtn
          v-if="!showAddForm"
          :prepend-icon="mdiPlus"
          variant="tonal"
          size="small"
          :disabled="availableButtons.length === 0"
          @click="showAddForm = true"
        >
          Add Action Button
        </VBtn>
        <template v-else>
          <VRow dense>
            <VCol cols="12" sm="4">
              <VSelect
                v-model="newButton"
                :items="availableButtons.map(b => ({ title: b.charAt(0).toUpperCase() + b.slice(1), value: b }))"
                density="compact"
                hide-details
                label="Button"
              />
            </VCol>
            <VCol cols="12" sm="4">
              <VSelect
                v-model="newActionType"
                :items="actionTypes"
                density="compact"
                hide-details
                label="Action Type"
              />
            </VCol>
            <VCol v-if="newActionType === 'display_screen'" cols="12" sm="4">
              <VSelect
                v-model="newScreenId"
                :items="screenOptions"
                density="compact"
                hide-details
                label="Screen"
              />
            </VCol>
          </VRow>
          <VRow v-if="newActionType === 'webhook'" dense class="mt-1">
            <VCol cols="12" sm="6">
              <VTextField
                v-model="newWebhookUrl"
                density="compact"
                hide-details
                label="URL"
                placeholder="https://example.com/webhook"
              />
            </VCol>
            <VCol cols="12" sm="3">
              <VSelect
                v-model="newWebhookMethod"
                :items="webhookMethods"
                density="compact"
                hide-details
                label="Method"
              />
            </VCol>
          </VRow>
          <VRow v-if="newActionType === 'webhook'" dense class="mt-1">
            <VCol cols="12">
              <VTextarea
                v-model="newWebhookPayload"
                density="compact"
                hide-details
                label="JSON Payload (optional)"
                rows="2"
                placeholder="{&quot;key&quot;: &quot;value&quot;}"
              />
            </VCol>
          </VRow>
          <div class="mt-2 d-flex ga-2">
            <VBtn size="small" color="primary" :disabled="!newButton" @click="addActionButton">
              Save
            </VBtn>
            <VBtn size="small" variant="text" @click="resetForm">
              Cancel
            </VBtn>
          </div>
        </template>
      </div>
    </VCardText>
  </VCard>
</template>
