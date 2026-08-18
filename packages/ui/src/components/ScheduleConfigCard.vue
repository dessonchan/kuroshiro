<script setup lang="ts">
import type { ScheduleConfig, ScheduleRule } from '@/types'
import { mdiClockOutline, mdiPlus, mdiTrashCan } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VCheckbox, VCol, VDivider, VIcon, VRow, VSwitch, VTextField } from 'vuetify/components'

const props = defineProps<{
  modelValue: ScheduleConfig
  timezone?: string
  hideActions?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScheduleConfig]
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

const enabled = ref((props.modelValue?.length ?? 0) > 0)
const localRules = ref<ScheduleRule[]>(
  props.modelValue
    ? props.modelValue.map(r => ({ ...r, weekdays: [...r.weekdays] }))
    : [{ startTime: '23:00', endTime: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6] }],
)

watch(() => props.modelValue, (val) => {
  if (!val || val.length === 0) {
    enabled.value = false
  }
  else {
    enabled.value = true
    localRules.value = val.map(r => ({ ...r, weekdays: [...r.weekdays] }))
  }
}, { immediate: true })

// When hideActions is true, emit update:modelValue reactively on every change
// so the parent (e.g. dialog) always has the latest value
watch([enabled, localRules], () => {
  if (props.hideActions) {
    if (enabled.value && localRules.value.some(r => r.weekdays.length > 0)) {
      const validRules = localRules.value.filter(r => r.weekdays.length > 0)
      emit('update:modelValue', validRules)
    }
    else {
      emit('update:modelValue', null)
    }
  }
}, { deep: true })

function addRule() {
  localRules.value.push({ startTime: '09:00', endTime: '17:00', weekdays: [1, 2, 3, 4, 5] })
}

function removeRule(index: number) {
  localRules.value.splice(index, 1)
  if (localRules.value.length === 0) {
    enabled.value = false
  }
}

function onWeekdayToggle(rule: ScheduleRule, day: number) {
  const idx = rule.weekdays.indexOf(day)
  if (idx >= 0) {
    rule.weekdays.splice(idx, 1)
  }
  else {
    rule.weekdays.push(day)
    rule.weekdays.sort()
  }
}

function save() {
  if (enabled.value && localRules.value.some(r => r.weekdays.length > 0)) {
    // Filter out rules with empty weekdays (inactive)
    const validRules = localRules.value.filter(r => r.weekdays.length > 0)
    emit('update:modelValue', validRules)
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

function ruleSummary(rule: ScheduleRule): string {
  const dayLabels = rule.weekdays.map(d => WEEKDAY_LABELS.find(w => w.value === d)?.label).filter(Boolean)
  const crossesMidnight = rule.startTime > rule.endTime
  return `${rule.startTime} – ${rule.endTime}${crossesMidnight ? ' (next day)' : ''}, ${dayLabels.length === 7 ? 'Every day' : dayLabels.join(', ')}`
}

const hasChanges = computed(() => {
  const current = props.modelValue
  if (enabled.value && localRules.value.some(r => r.weekdays.length > 0)) {
    const validRules = localRules.value.filter(r => r.weekdays.length > 0)
    if (!current)
      return true
    if (current.length !== validRules.length)
      return true
    return JSON.stringify(current) !== JSON.stringify(validRules)
  }
  return current !== null && current.length > 0
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
      <div
        v-for="(rule, index) in localRules"
        :key="index"
        class="rule-block"
      >
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 text-medium-emphasis">Rule {{ index + 1 }}</span>
          <VBtn
            v-if="localRules.length > 1"
            icon
            variant="text"
            size="small"
            :prepend-icon="mdiTrashCan"
            color="error"
            @click="removeRule(index)"
          >
            <VIcon :icon="mdiTrashCan" size="16" />
          </VBtn>
        </div>

        <VRow density="comfortable">
          <VCol cols="12" sm="6" md="4">
            <VTextField
              v-model="rule.startTime"
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
              v-model="rule.endTime"
              label="End Time"
              placeholder="07:00"
              density="compact"
              :rules="timeRules"
              hint="HH:mm (start > end crosses midnight)"
              persistent-hint
            />
          </VCol>
          <VCol v-if="timezone && index === 0" cols="12" md="4" class="d-flex align-center">
            <span class="text-body-2 text-medium-emphasis">Timezone: <strong>{{ timezone }}</strong></span>
          </VCol>
        </VRow>

        <div class="mt-2">
          <div class="text-body-2 text-medium-emphasis mb-1">Active Days</div>
          <div class="d-flex flex-wrap ga-2">
            <VCheckbox
              v-for="day in WEEKDAY_LABELS"
              :key="day.value"
              :model-value="rule.weekdays.includes(day.value)"
              :label="day.label"
              density="compact"
              hide-details
              color="secondary"
              @update:model-value="onWeekdayToggle(rule, day.value)"
            />
          </div>
        </div>

        <div class="mt-2 text-body-2 text-medium-emphasis">
          {{ ruleSummary(rule) }}
        </div>

        <VDivider v-if="index < localRules.length - 1" class="mt-3" />
      </div>

      <VBtn
        variant="tonal"
        color="secondary"
        size="small"
        :prepend-icon="mdiPlus"
        class="mt-3"
        @click="addRule"
      >
        Add Rule
      </VBtn>
    </VCardText>

    <VCardText v-else>
      <div class="text-center text-disabled py-4">
        No schedule configured. Enable the switch above to set active schedules.
      </div>
    </VCardText>

    <VDivider v-if="hasChanges && !hideActions" />
    <VCardText v-if="hasChanges && !hideActions" class="d-flex justify-end ga-2">
      <VBtn variant="text" @click="enabled = (props.modelValue?.length ?? 0) > 0; localRules = props.modelValue ? props.modelValue.map(r => ({ ...r, weekdays: [...r.weekdays] })) : [{ startTime: '23:00', endTime: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6] }]">
        Cancel
      </VBtn>
      <VBtn color="primary" variant="tonal" @click="save">
        Save
      </VBtn>
    </VCardText>
  </VCard>
</template>

<style scoped>
.rule-block {
  padding: 12px 0;
}
.rule-block:not(:last-child) {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>