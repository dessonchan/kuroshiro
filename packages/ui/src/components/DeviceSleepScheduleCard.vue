<script setup lang="ts">
import type { ScheduleConfig } from '@/types'
import { mdiPowerSleep } from '@mdi/js'
import { computed } from 'vue'
import { VCard, VCardText, VCardTitle, VCol, VDivider, VRow, VSelect } from 'vuetify/components'
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

const offSchedule = computed<ScheduleConfig | null>({
  get() {
    return device.value?.offSchedule ?? null
  },
  set(value: ScheduleConfig | null) {
    if (!device.value) return
    deviceStore.updateDevice(device.value.id, { offSchedule: value })
  },
})

const timezone = computed<string>({
  get() {
    return device.value?.timezone ?? 'UTC'
  },
  set(value: string) {
    if (!device.value) return
    deviceStore.updateDevice(device.value.id, { timezone: value })
  },
})

const screenSaverScreenId = computed<string | null>({
  get() {
    return device.value?.screenSaverScreenId ?? null
  },
  set(value: string | null) {
    if (!device.value) return
    deviceStore.updateDevice(device.value.id, { screenSaverScreenId: value })
  },
})
</script>

<template>
  <VCard v-if="device" elevation="1" class="mb-6">
    <VCardTitle class="d-flex align-center ga-2">
      <VIcon :icon="mdiPowerSleep" size="20" />
      Sleep Schedule
    </VCardTitle>
    <VDivider />
    <VCardText>
      <ScheduleConfigCard
        v-model="offSchedule"
        :timezone="timezone"
      />

      <VRow density="comfortable" class="mt-2">
        <VCol cols="12" sm="6">
          <VSelect
            v-model="timezone"
            :items="timezoneOptions"
            density="compact"
            label="Timezone"
            hint="Used for schedule time interpretation"
            persistent-hint
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VSelect
            v-model="screenSaverScreenId"
            :items="screenSaverOptions"
            density="compact"
            label="Screen Saver"
            hint="Screen shown when device is asleep"
            persistent-hint
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>