<script setup>
import { inject } from 'vue';
import { Check, ArrowUpRight, Printer, Ticket, ArrowRight, MapPin } from '@lucide/vue';

const j = inject('journey');
const print = () => window.print();
</script>

<template>
  <main id="main-content" class="content ticket-page">
    <div v-if="j.bookingBusy" class="loading-state" role="status">{{ j.t('loading') }}</div>

    <div v-else-if="j.pageError || !j.booking" class="empty-state card">
      <p>{{ j.t(j.pageError || 'ticketMissing') }}</p>
      <button v-if="j.pageError === 'networkError'" class="primary" @click="j.retryBooking">{{ j.t('retry') }}</button>
      <button class="secondary" @click="j.go('trips')">{{ j.t('myTrips') }}</button>
    </div>

    <div v-else-if="!j.paid(j.booking)" class="empty-state card">
      <p>{{ j.t('ticketNotPaid') }}</p>
      <button class="primary" @click="j.openBooking(j.booking)">{{ j.t('resume') }}</button>
    </div>

    <template v-else>
      <div class="ticket-celebration">
        <span class="success-circle"><Check :size="28"/></span>
        <h1 tabindex="-1">{{ j.t('ticketTitle') }}</h1>
        <p>{{ j.t('ticketNote') }}</p>
      </div>

      <article class="boarding-pass">
        <header>
          <span class="ticket-brand">
            <img src="/sriracha-express-logo.png" width="1024" height="419" alt="Sriracha Express" />
          </span>
          <span class="status-pill"><Check :size="13"/>{{ j.t('paid') }}</span>
        </header>

        <div class="ticket-route">
          <span class="eyebrow">{{ j.t('dateTime') }} · {{ j.dateLabel(j.booking.trip.departure_date) }}</span>
          <div class="ticket-times">
            <strong>{{ j.booking.trip.departure }}</strong>
            <ArrowRight :size="20"/>
            <strong>{{ j.booking.trip.arrival }}</strong>
          </div>
          <div class="ticket-cities">
            <b>{{ j.city(j.booking.trip.from_location) }}</b>
            <b>{{ j.city(j.booking.trip.to_location) }}</b>
          </div>
        </div>

        <section class="boarding-station">
          <MapPin :size="18"/>
          <div>
            <span class="eyebrow">{{ j.t('pickup') }}</span>
            <b>{{ j.station(j.booking.trip, 'from') }}</b>
            <a :href="j.directions(j.booking.trip)" target="_blank" rel="noopener noreferrer">
              {{ j.t('directions') }}<ArrowUpRight :size="13"/>
            </a>
          </div>
        </section>

        <div class="ticket-info">
          <div><span>{{ j.t('selectedSeats') }}</span><strong>{{ j.booking.seats.join(', ') }}</strong></div>
          <div><span>{{ j.t('name') }}</span><b>{{ j.booking.passenger.name }}</b></div>
          <div><span>{{ j.t('phone') }}</span><b>{{ j.booking.passenger.phone }}</b></div>
          <div><span>{{ j.t('vehicle') }}</span><b>{{ j.vehicle(j.booking.trip) }}</b></div>
        </div>

        <div class="ticket-tear"><span></span></div>

        <div class="ticket-bottom">
          <div>
            <span>{{ j.t('reference') }}</span>
            <b>{{ j.booking.code }}</b>
            <small>{{ j.booking.ticket }}</small>
          </div>
          <strong>{{ j.money(j.booking.total) }}</strong>
        </div>

        <p class="ticket-demo">{{ j.t('demoTicket') }} · {{ j.t('demo') }}</p>
      </article>

      <div class="ticket-actions">
        <button class="primary" @click="print"><Printer :size="16"/>{{ j.t('print') }}</button>
        <button class="secondary" @click="j.go('trips')"><Ticket :size="16"/>{{ j.t('myTrips') }}</button>
      </div>

      <p class="print-hint">{{ j.t('printNote') }}</p>
      <button class="text-button another-ride" @click="j.go('choose')">
        {{ j.t('newTrip') }}<ArrowRight :size="15"/>
      </button>
    </template>
  </main>
</template>
