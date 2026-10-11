<script setup>
import { inject } from 'vue';
import { ArrowLeft, ArrowRight, Check, Armchair } from '@lucide/vue';
import { seatRows } from '../../shared/journey';
import ProgressSteps from '../components/ProgressSteps.vue';
import TripSummary from '../components/TripSummary.vue';

const j = inject('journey');
</script>

<template>
  <main id="main-content" class="content checkout-page">
    <div class="checkout-nav">
      <button class="back-button" :disabled="j.busy" @click="j.go('choose')">
        <ArrowLeft :size="16"/><span class="back-label">{{ j.t('back') }}</span>
      </button>
      <ProgressSteps :step="2"/>
    </div>

    <div class="page-heading">
      <h1 tabindex="-1">{{ j.t('checkoutTitle') }}</h1>
      <p>{{ j.t('checkoutNote') }}</p>
    </div>

    <div class="checkout-layout card">
      <!-- Seat Selection Section (Clean Grey Bus Silhouette) -->
      <section class="seat-card">
        <div class="section-heading">
          <span class="section-number">01</span>
          <div>
            <h2>{{ j.t('seatsTitle') }}</h2>
            <p>{{ j.seats.length ? j.seats.join(', ') + ' · ' + j.passengers(j.seats.length) : j.t('noSeats') }}</p>
          </div>
        </div>

        <div v-if="j.seatsBusy" class="loading-state" role="status">{{ j.t('seatsLoading') }}</div>
        <div v-else-if="j.seatsError" class="empty-state" role="alert">
          <p>{{ j.t(j.seatsError) }}</p>
          <button v-if="j.seatsError === 'seatLoadError'" class="secondary" @click="j.loadSeats()">{{ j.t('retry') }}</button>
          <button v-else class="secondary" @click="j.go('choose')">{{ j.t('home') }}</button>
        </div>
        <div v-else class="seat-selection">
          <div class="seat-legend">
            <span><i class="legend-swatch available"></i>{{ j.t('available') }}</span>
            <span><i class="legend-swatch selected"><Check :size="11"/></i>{{ j.t('selected') }}</span>
            <span><i class="legend-swatch occupied">×</i>{{ j.t('occupied') }}</span>
          </div>

          <div class="seat-picker">
            <div class="seat-grid" role="group" :aria-label="j.t('seatsTitle')">
              <template v-for="(row, ri) in seatRows(j.capacity)" :key="ri">
                <template v-for="(seat, ci) in row" :key="ri + '-' + ci">
                  <button
                    v-if="seat"
                    type="button"
                    class="seat-button"
                    :class="{ selected: j.seats.includes(seat), occupied: j.occupied.includes(seat) }"
                    :disabled="j.occupied.includes(seat) || j.busy || j.uncertain"
                    :aria-pressed="j.seats.includes(seat)"
                    :aria-label="j.t('seat') + ' ' + seat + ' · ' + j.t(j.occupied.includes(seat) ? 'occupied' : j.seats.includes(seat) ? 'selected' : 'available')"
                    @click="j.toggleSeat(seat)"
                  >
                    <span class="seat-icon-wrap" aria-hidden="true">
                      <Check v-if="j.seats.includes(seat)" :size="12"/>
                      <span v-else-if="j.occupied.includes(seat)" class="occupied-mark">×</span>
                      <Armchair v-else :size="11" class="seat-glyph"/>
                    </span>
                    <span class="seat-number">{{ seat }}</span>
                  </button>
                  <span v-else class="seat-space" aria-hidden="true"></span>
                </template>
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- Sidebar: Summary + Contact Form -->
      <div class="checkout-sidebar">
        <TripSummary compact :trip="j.selectedTrip" :seats="j.seats" :total="j.total()"/>

        <section class="contact-card">
          <div class="section-heading">
            <span class="section-number">02</span>
            <div>
              <h2>{{ j.t('contactTitle') }}</h2>
              <p>{{ j.t('contactNote') }}</p>
            </div>
          </div>

          <form id="contact-form" @submit.prevent="j.reserve" novalidate>
            <div class="contact-grid">
              <label
                v-for="field in ['name','phone','email']"
                :key="field"
                :class="{ 'full-field': field === 'name' }"
                :for="'contact-' + field"
              >
                <span class="field-title">
                  {{ j.t(field) }}
                  <small v-if="field === 'email'" class="optional-tag">({{ j.t('optional') }})</small>
                </span>
                <input
                  :id="'contact-' + field"
                  v-model="j.passenger[field]"
                  :type="field === 'phone' ? 'tel' : field === 'email' ? 'email' : 'text'"
                  :autocomplete="field === 'phone' ? 'tel' : field"
                  :maxlength="field === 'name' ? 120 : field === 'email' ? 254 : 30"
                  :disabled="j.busy || j.uncertain"
                  :aria-invalid="!!(j.touched[field] && j.contactErrors()[field])"
                  :aria-describedby="j.touched[field] && j.contactErrors()[field] ? field + '-error' : undefined"
                  @blur="j.touched[field] = true"
                />
                <span class="field-error" :id="field + '-error'" v-if="j.touched[field] && j.contactErrors()[field]">
                  {{ j.t(j.contactErrors()[field]) }}
                </span>
              </label>
            </div>
          </form>
        </section>

        <p v-if="j.checkoutError" class="inline-notice error" role="alert">{{ j.t(j.checkoutError) }}</p>

        <div class="action-dock">
          <div>
            <span class="dock-total">{{ j.money(j.total()) }}</span>
            <small>{{ j.t(j.validCheckout() ? 'holdNote' : 'detailsRequired') }}</small>
          </div>
          <button v-if="j.uncertain" class="primary" :disabled="j.busy" @click="j.reconcile">
            {{ j.t('checkReservation') }}
          </button>
          <button v-else class="primary" form="contact-form" type="submit" :disabled="j.busy || !j.validCheckout()">
            {{ j.t(j.busy ? 'reserving' : 'continuePayment') }}
            <span class="desktop-total"> · {{ j.money(j.total()) }}</span>
            <ArrowRight :size="16"/>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
