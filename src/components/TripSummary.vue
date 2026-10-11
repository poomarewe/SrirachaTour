<script setup>
import { inject } from 'vue';
import { ArrowRight, BusFront, CalendarDays, Ticket } from '@lucide/vue';
import RouteDetails from './RouteDetails.vue';

const j = inject('journey');
defineProps({ trip: Object, seats: { type: Array, default: () => [] }, total: Number, compact: Boolean });
</script>

<template>
  <aside class="trip-summary card" v-if="trip">
    <div class="summary-title">
      <Ticket :size="16"/>
      <h2>{{ j.t('summary') }}</h2>
    </div>

    <div class="summary-journey">
      <div class="journey-node origin">
        <span class="route-dot"></span>
        <div class="node-info">
          <strong class="node-time">{{ trip.departure }}</strong>
          <b class="node-city">{{ j.city(trip.from_location) }}</b>
        </div>
      </div>

      <div class="journey-line">
        <ArrowRight v-if="compact" :size="16"/>
        <template v-else>
          <span></span>
          <small>{{ trip.duration || j.vehicle(trip) }}</small>
        </template>
      </div>

      <div class="journey-node destination">
        <span class="route-dot destination"></span>
        <div class="node-info">
          <strong class="node-time">{{ trip.arrival }}</strong>
          <b class="node-city">{{ j.city(trip.to_location) }}</b>
        </div>
      </div>
    </div>

    <div class="summary-meta">
      <span><CalendarDays :size="14"/>{{ j.dateLabel(trip.departure_date) }}</span>
      <span><BusFront :size="14"/>{{ j.vehicle(trip) }}</span>
    </div>

    <RouteDetails :trip="trip"/>

    <div v-if="!compact" class="summary-seats">
      <span>{{ j.t('selectedSeats') }}</span>
      <b>{{ seats.length ? seats.join(', ') : '—' }}</b>
      <small v-if="seats.length">{{ j.passengers(seats.length) }} × {{ j.money(trip.fare) }}</small>
    </div>

    <div v-if="!compact" class="summary-total">
      <span>{{ j.t('total') }}</span>
      <strong>{{ j.money(total) }}</strong>
    </div>
  </aside>
</template>
