<script setup lang="ts">
import type { ScheduleConfig } from '@/types'
import { mdiClockOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VCheckbox, VCol, VDivider, VRow, VSwitch, VTextField } from 'vuetify/components'

const props = defineProps<{
  modelValue: ScheduleConfig | null
  timezone?: string
  hideActions?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScheduleConfig | null]
  'save': []
}>()

const WEEKDAY_LABELS: { value: number, label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const enabled = ref(props.modelValue !== null && (props.modelValue?.weekdays?.length ?? 0) > 0)

const localStartTime = ref(props.modelValue?.startTime ?? '23:00')
const localEndTime = ref(props.modelValue?.endTime ?? '07:00')
const localWeekdays = ref<number[]>(props.modelValue?.weekdays ? [...props.modelValue.weekdays] : [])

// Sync external modelValue changes into local state (e.g. when parent resets)
watch(() => props.modelValue, (val) => {
  if (val === null || !val.weekdays || val.weekdays.length === 0) {
    enabled.value = false
  }
  else {
    enabled.value = true
    localStartTime.value = val.startTime
    localEndTime.value = val.endTime
    localWeekdays.value = [...val.weekdays]
  }
}, { immediate: true })

function onWeekdayToggle(day: number) {
  const idx = localWeekdays.value.indexOf(day)
  if (idx >= 0) {
    localWeekdays.value.splice(idx, 1)
  }
  else {
    localWeekdays.value.push(day)
    localWeekdays.value.sort()
  }
  // If weekdays becomes empty, treat as disabled
  if (localWeekdays.value.length === 0) {
    enabled.value = false
  }
}

function save() {
  if (enabled.value && localWeekdays.value.length > 0) {
    emit('update:modelValue', {
      startTime: localStartTime.value,
      endTime: localEndTime.value,
      weekdays: [...localWeekdays.value],
    })
  }
  else {
    emit('update:modelValue', null)
  }
  emit('save')
}

const timeRules = [
  (v: string) => {
    if (!v)
      return 'Time is required'
    if (/^\d{2}:\d{2}$/.test(v))
      return true
    return 'Format must be HH:mm'
  },
]

const scheduleSummary = computed(() => {
  if (!enabled.value)
    return 'No schedule configured'
  const dayLabels = localWeekdays.value.map(d => WEEKDAY_LABELS.find(w => w.value === d)?.label).filter(Boolean)
  const crossesMidnight = localStartTime.value > localEndTime.value
  return `${localStartTime.value} – ${localEndTime.value}${crossesMidnight ? ' (next day)' : ''}, ${dayLabels.length === 7 ? 'Every day' : dayLabels.join(', ')}`
})

const hasChanges = computed(() => {
  const current = props.modelValue
  if (enabled.value && localWeekdays.value.length > 0) {
    if (!current)
      return true
    return current.startTime !== localStartTime.value
      || current.endTime !== localEndTime.value
      || JSON.stringify(current.weekdays) !== JSON.stringify(localWeekdays.value)
  }
  // disabled state
  return current !== null
})
</script>

<template>
  <VCard elevation="1" class="mb-4">
    <VCardTitle class="d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2">
        <VIcon :icon="mdiClockOutline" size="20" />
        <span>Schedule</span>
      </div>
      <VSwitch
        v-model="enabled"
        color="secondary"
        density="compact"
        hide-details
        label="Enabled"
        class="flex-grow-0"
      />
    </VCardTitle>
    <VDivider />

    <VCardText v-if="enabled">
      <VRow density="comfortable">
        <VCol cols="12" sm="6" md="4">
          <VTextField
            v-model="localStartTime"
            label="Start Time"
            placeholder="23:00"
            density="compact"
            :rules="timeRules"
            hint="HH:mm format"
            persistent-hint
          />
        </VCol>
        <VCol cols="12" sm="6" md="4">
          <VTextField
            v-model="localEndTime"
            label="End Time"
            placeholder="07:00"
            density="compact"
            :rules="timeRules"
            hint="HH:mm format (start > end crosses midnight)"
            persistent-hint
          />
        </VCol>
        <VCol v-if="timezone" cols="12" md="4" class="d-flex align-center">
          <span class="text-body-2 text-medium-emphasis">Timezone: <strong>{{ timezone }}</strong></span>
        </VCol>
      </VRow>

      <div class="mt-4">
        <div class="text-body-2 text-medium-emphasis mb-2">Active Days</div>
        <div class="d-flex flex-wrap ga-2">
          <VCheckbox
            v-for="day in WEEKDAY_LABELS"
            :key="day.value"
            :model-value="localWeekdays.includes(day.value)"
            :label="day.label"
            density="compact"
            hide-details
            color="secondary"
            @update:model-value="onWeekdayToggle(day.value)"
          />
        </div>
      </div>

      <div class="mt-4 text-body-2 text-medium-emphasis">
        {{ scheduleSummary }}
      </div>
    </VCardText>

    <VCardText v-else>
      <div class="text-center text-disabled py-4">
        No schedule configured. Enable the switch above to set an active schedule.
      </div>
    </VCardText>

    <VDivider v-if="hasChanges && !hideActions" />
    <VCardText v-if="hasChanges && !hideActions" class="d-flex justify-end ga-2">
      <VBtn variant="text" @click="enabled = !!(props.modelValue?.weekdays?.length); localStartTime = props.modelValue?.startTime ?? '23:00'; localEndTime = props.modelValue?.endTime ?? '07:00'; localWeekdays = props.modelValue?.weekdays ? [...props.modelValue.weekdays] : []">
        Cancel
      </VBtn>
      <VBtn color="primary" variant="tonal" @click="save">
        Save
      </VBtn>
    </VCardText>
  </VCard>
</template>