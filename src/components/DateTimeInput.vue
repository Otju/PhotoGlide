<script setup lang="ts">
import { ref, watch } from 'vue'
import { splitAt } from '../utils'

const props = defineProps({
  onChange: {
    type: Function,
    required: true,
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const year = ref<string>('----')
const month = ref<string>('--')
const day = ref<string>('--')
const hour = ref<string>('--')
const minute = ref<string>('--')
const second = ref<string>('--')

const yearInput = ref<HTMLInputElement | null>(null)
const monthInput = ref<HTMLInputElement | null>(null)
const dayInput = ref<HTMLInputElement | null>(null)
const hourInput = ref<HTMLInputElement | null>(null)
const minuteInput = ref<HTMLInputElement | null>(null)
const secondInput = ref<HTMLInputElement | null>(null)

const model = defineModel()

const handleInputChange = (
  stringValue: string,
  nextInput: HTMLInputElement | null,
  firstDigitMaxValue: number,
  maxValue: number,
  length: number
): string => {
  // Remove all non-digit characters, and starting zeros
  const stringWithOnlyDigits = stringValue.replace(/\D/g, '')
  const value = stringWithOnlyDigits.replace(/^0+/, '')
  const asNumber = Number(value)

  if (value.length === 0) {
    if (stringWithOnlyDigits.includes('0')) {
      return '0'.repeat(length)
    }
    return '-'.repeat(length)
  } else if (value.length === 1) {
    if (asNumber > firstDigitMaxValue) {
      nextInput?.focus()
    }
    return `${'0'.repeat(length - 1)}${value}`
  } else if (value.length < length) {
    return `${'0'.repeat(length - value.length)}${value}`
  } else if (value.length === length) {
    nextInput?.focus()
    if (asNumber > maxValue) {
      return maxValue.toString()
    }
    return value
  }

  const newestDigit = value.slice(-1)
  if (Number(newestDigit) > firstDigitMaxValue) {
    nextInput?.focus()
  }

  return `${'0'.repeat(length - 1)}${newestDigit}`
}

const handleDayChange = () => {
  day.value = handleInputChange(day.value, monthInput.value, 3, 31, 2)
  handleChange()
}

const handleMonthChange = () => {
  month.value = handleInputChange(month.value, yearInput.value, 1, 12, 2)
  handleChange()
}

const handleYearChange = () => {
  year.value = handleInputChange(year.value, hourInput.value, 2, 9999, 4)
  handleChange()
}

const handleHourChange = () => {
  hour.value = handleInputChange(hour.value, minuteInput.value, 2, 23, 2)
  handleChange()
}

const handleMinuteChange = () => {
  minute.value = handleInputChange(minute.value, secondInput.value, 5, 59, 2)
  handleChange()
}

const handleSecondChange = () => {
  second.value = handleInputChange(second.value, null, 5, 59, 2)
  handleChange()
}

watch(
  model,
  (newValue) => {
    let [date, time] = splitAt(10, newValue as string).map((x) => x.replace(/ /g, ''))

    const [newYear, newMonth, newDay] = date.split(':')
    const [newHour, newMinute, newSecond] = time.split(':')

    if (newYear) {
      year.value = newYear
    } else {
      year.value = '----'
    }

    if (newMonth) {
      month.value = newMonth
    } else {
      month.value = '--'
    }

    if (newDay) {
      day.value = newDay
    } else {
      day.value = '--'
    }

    if (newHour) {
      hour.value = newHour
    } else {
      hour.value = '--'
    }

    if (newMinute) {
      minute.value = newMinute
    } else {
      minute.value = '--'
    }

    if (newSecond) {
      second.value = newSecond
    } else {
      second.value = '--'
    }
  },
  { immediate: true }
)

const handleChange = () => {
  // YYYY:MM:DD HH:mm:ss
  const newValue = `${year.value}:${month.value}:${day.value} ${hour.value}:${minute.value}:${second.value}`.replace(
    /-/g,
    ' '
  )
  props.onChange(newValue)
  model.value = newValue
}
</script>

<template>
  <div class="pl-3 py-2 rounded-bl-lg flex bg-white text-black">
    <input
      type="input"
      v-model="day"
      @input="handleDayChange"
      class="p-0 w-6 rounded-none text-center"
      @keydown.delete="day = '--'"
      ref="dayInput"
      @focus="dayInput?.select()"
      tabindex="3"
      :disabled="disabled"
    />
    /
    <input
      type="input"
      v-model="month"
      @input="handleMonthChange"
      class="p-0 w-6 rounded-none text-center"
      @keydown.delete="month = '--'"
      ref="monthInput"
      @focus="monthInput?.select()"
      tabindex="4"
      :disabled="disabled"
    />
    /
    <input
      type="input"
      v-model="year"
      @input="handleYearChange"
      class="p-0 w-10 rounded-none text-center"
      @keydown.delete="year = '----'"
      ref="yearInput"
      @focus="yearInput?.select()"
      tabindex="5"
      :disabled="disabled"
    />

    <input
      type="input"
      v-model="hour"
      @input="handleHourChange"
      class="p-0 w-6 rounded-none text-center"
      @keydown.delete="hour = '--'"
      ref="hourInput"
      @focus="hourInput?.select()"
      tabindex="6"
      :disabled="disabled"
    />
    .
    <input
      type="input"
      v-model="minute"
      @input="handleMinuteChange"
      class="p-0 w-6 rounded-none text-center"
      @keydown.delete="minute = '--'"
      ref="minuteInput"
      @focus="minuteInput?.select()"
      tabindex="7"
      :disabled="disabled"
    />
    .
    <input
      type="input"
      v-model="second"
      @input="handleSecondChange"
      class="p-0 w-6 rounded-none text-center"
      @keydown.delete="second = '--'"
      ref="secondInput"
      @focus="secondInput?.select()"
      tabindex="8"
      :disabled="disabled"
    />
  </div>
</template>
