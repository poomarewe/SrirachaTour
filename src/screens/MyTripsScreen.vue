<script setup>
import { inject } from 'vue';
import { Ticket, ArrowRight, LogOut, Settings } from '@lucide/vue';
import BookingCard from '../components/BookingCard.vue';

const j = inject('journey');
</script>

<template>
  <main id="main-content" class="content my-trips-page">
    <div class="my-trips-heading">
      <div class="page-heading">
        <h1 tabindex="-1">{{ j.t('myTrips') }}</h1>
        <p>{{ j.locale === 'th' ? 'รายการจองและตั๋วเดินทางทั้งหมดของคุณ' : 'All your bookings and e-tickets in one place.' }}</p>
      </div>

      <div class="account-actions">
        <button v-if="j.user.role === 'admin'" class="secondary" :disabled="j.busy" @click="j.go('admin')">
          <Settings :size="15"/>{{ j.t('admin') }}
        </button>
        <button class="text-button" :disabled="j.busy" @click="j.logout()">
          <LogOut :size="15"/>{{ j.t('logout') }}
        </button>
      </div>
    </div>

    <p v-if="j.notice" class="inline-notice" role="status">{{ j.t(j.notice) }}</p>
    <div v-if="j.bookingsBusy" class="loading-state" role="status">{{ j.t('loading') }}</div>
    <div v-else-if="j.bookingsError" class="empty-state card" role="alert">
      <p>{{ j.t(j.bookingsError) }}</p>
      <button class="secondary" @click="j.loadBookings">{{ j.t('retry') }}</button>
    </div>

    <div v-else-if="!j.bookings.length" class="empty-state card">
      <Ticket :size="36"/>
      <h2>{{ j.t('emptyBookings') }}</h2>
      <p>{{ j.t('emptyBookingsNote') }}</p>
      <button class="primary" @click="j.go('choose')">
        {{ j.t('home') }}<ArrowRight :size="15"/>
      </button>
    </div>

    <div v-else class="my-trips-sections">
      <section v-if="j.upcoming().length">
        <h2 class="booking-section-title">
          {{ j.t('upcoming') }}
          <span class="count-pill">{{ j.upcoming().length }}</span>
        </h2>
        <div class="bookings-grid">
          <BookingCard v-for="b in j.upcoming()" :key="b.id" :booking="b"/>
        </div>
      </section>

      <section v-if="j.history().length">
        <h2 class="booking-section-title">{{ j.t('history') }}</h2>
        <div class="bookings-grid">
          <BookingCard v-for="b in j.history()" :key="b.id" :booking="b"/>
        </div>
      </section>
    </div>
  </main>
</template>
