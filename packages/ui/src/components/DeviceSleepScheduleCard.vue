<script setup lang="ts">
import type { ScheduleConfig } from '@/types'
import { mdiContentSave } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VRow, VSelect } from 'vuetify/components'
import ScheduleConfigCard from '@/components/ScheduleConfigCard.vue'
import { useDeviceStore } from '@/stores/device'
import { useScreensStore } from '@/stores/screens'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const screensStore = useScreensStore()

const device = computed(() => deviceStore.getById(props.deviceId))

const timezoneOptions = [
  'UTC',
  'US/Pacific',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const screenSaverOptions = computed(() => {
  const screens = screensStore.screens.map(s => ({
    title: s.filename || s.type || 'Untitled',
    value: s.id,
  }))
  return [{ title: 'None', value: null }, ...screens]
})

// Local state for editing
const localOffSchedule = ref<ScheduleConfig | null>(device.value?.offSchedule ? { ...device.value.offSchedule, weekdays: [...device.value.offSchedule.weekdays] } : null)
const localTimezone = ref(device.value?.timezone ?? 'UTC')
const localScreenSaverScreenId = ref<string | null>(device.value?.screenSaverScreenId ?? null)

// Sync device changes into local state
watch(() => device.value, (dev) => {
  if (!dev)
    return
  localOffSchedule.value = dev.offSchedule ? { ...dev.offSchedule, weekdays: [...dev.offSchedule.weekdays] } : null
  localTimezone.value = dev.timezone ?? 'UTC'
  localScreenSaverScreenId.value = dev.screenSaverScreenId ?? null
}, { immediate: true })

const hasChanges = computed(() => {
  const dev = device.value
  if (!dev)
    return false
  const scheduleChanged = JSON.stringify(localOffSchedule.value) !== JSON.stringify(dev.offSchedule)
  const tzChanged = localTimezone.value !== (dev.timezone ?? 'UTC')
  const ssChanged = localScreenSaverScreenId.value !== (dev.screenSaverScreenId ?? null)
  return scheduleChanged || tzChanged || ssChanged
})

async function save() {
  if (!device.value)
    return
  await deviceStore.updateDevice(device.value.id, {
    offSchedule: localOffSchedule.value,
    timezone: localTimezone.value,
    screenSaverScreenId: localScreenSaverScreenId.value,
  })
}

function cancel() {
  const dev = device.value
  if (!dev)
    return
  localOffSchedule.value = dev.offSchedule ? { ...dev.offSchedule, weekdays: [...dev.offSchedule.weekdays] } : null
  localTimezone.value = dev.timezone ?? 'UTC'
  localScreenSaverScreenId.value = dev.screenSaverScreenId ?? null
}
</script>

<template>
  <VCard v-if="device" elevation="1" class="mb-6">
    <VCardTitle class="d-flex align-center ga-2">
      Sleep Schedule
    </VCardTitle>
    <VDivider />
    <VCardText>
      <ScheduleConfigCard
        v-model="localOffSchedule"
      />

      <VRow density="comfortable" class="mt-2">
        <VCol cols="12" sm="6">
          <VSelect
            v-model="localTimezone"
            :items="timezoneOptions"
            density="compact"
            label="Timezone"
            hint="Used for schedule time interpretation"
            persistent-hint
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VSelect
            v-model="localScreenSaverScreenId"
            :items="screenSaverOptions"
            density="compact"
            label="Screen Saver"
            hint="Screen shown when device is asleep"
            persistent-hint
          />
        </VCol>
      </VRow>
    </VCardText>

    <template v-if="hasChanges">
      <VDivider />
      <VCardText class="d-flex justify-end ga-2">
        <VBtn variant="text" @click="cancel">
          Cancel
        </VBtn>
        <VBtn color="primary" variant="tonal" :prepend-icon="mdiContentSave" @click="save">
          Save
        </VBtn>
      </VCardText>
    </template>
  </VCard>
</template>