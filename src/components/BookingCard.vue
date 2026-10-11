<script setup>
import { inject } from 'vue';
import { ArrowRight, Ticket, CalendarDays, Armchair } from '@lucide/vue';

const j = inject('journey');
defineProps({ booking: Object });
</script>

<template>
  <article class="booking-card card">
    <div class="booking-card-top">
      <span class="status-pill" :class="{ muted: !j.paid(booking), pending: j.activeHold(booking) }">
        {{ j.statusLabel(booking) }}
      </span>
      <small class="booking-code">{{ booking.code }}</small>
    </div>

    <h3>
      <span>{{ j.city(booking.trip.from_location) }}</span>
      <ArrowRight :size="15"/>
      <span>{{ j.city(booking.trip.to_location) }}</span>
    </h3>

    <div class="booking-meta">
      <span><CalendarDays :size="14"/>{{ j.dateLabel(booking.trip.departure_date) }} · {{ booking.trip.departure }}</span>
      <span><Armchair :size="14"/>{{ booking.seats.join(', ') }}</span>
    </div>

    <div class="booking-card-bottom">
      <strong class="booking-price">{{ j.money(booking.total) }}</strong>
      <button v-if="j.paid(booking)" class="secondary" @click="j.openBooking(booking)">
        <Ticket :size="15"/>{{ j.t('openTicket') }}
      </button>
      <button v-else-if="j.activeHold(booking)" class="primary" @click="j.openBooking(booking)">
        {{ j.t('resume') }}<ArrowRight :size="15"/>
      </button>
      <button v-else class="secondary" @click="j.reselect(booking)">
        {{ j.t('reselect') }}<ArrowRight :size="15"/>
      </button>
    </div>
  </article>
</template>
