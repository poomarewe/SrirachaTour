<script setup>
import { inject } from 'vue';
import { Check } from '@lucide/vue';
const j = inject('journey');
defineProps({ step: Number });
</script>
<template><ol class="progress-steps" :aria-label="j.locale === 'th' ? 'ขั้นตอนการจอง' : 'Booking progress'"><li v-for="(key, i) in ['progressTrip','progressSeats','progressPay']" :key="key" :class="{ current: step === i + 1, done: step > i + 1 }" :aria-current="step === i + 1 ? 'step' : undefined"><span><Check v-if="step > i + 1" :size="13"/><template v-else>{{ i + 1 }}</template></span>{{ j.t(key) }}</li></ol></template>
