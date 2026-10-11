<script setup>
import { inject } from 'vue';
import { ArrowLeft, ArrowRight, Clock, CreditCard, QrCode, ShieldCheck } from '@lucide/vue';
import ProgressSteps from '../components/ProgressSteps.vue';
import TripSummary from '../components/TripSummary.vue';

const j = inject('journey');
</script>

<template>
  <main id="main-content" class="content payment-page">
    <div class="checkout-nav">
      <button class="back-button" :disabled="j.busy" @click="j.go('trips')">
        <ArrowLeft :size="16"/>{{ j.t('myTrips') }}
      </button>
      <ProgressSteps :step="3"/>
    </div>

    <div class="page-heading">
      <h1 tabindex="-1">{{ j.t('paymentTitle') }}</h1>
      <p>{{ j.t('paymentNote') }}</p>
    </div>

    <div v-if="j.bookingBusy" class="loading-state" role="status">{{ j.t('loading') }}</div>

    <div v-else-if="j.pageError || !j.booking" class="empty-state card" role="alert">
      <p>{{ j.t(j.pageError || 'ticketMissing') }}</p>
      <button v-if="j.pageError === 'networkError'" class="primary" @click="j.retryBooking">{{ j.t('retry') }}</button>
      <button class="secondary" @click="j.go('trips')">{{ j.t('myTrips') }}</button>
    </div>

    <template v-else>
      <div class="checkout-layout">
        <section class="card payment-card">
          <div class="hold-banner" :class="{ expired: !j.activeHold(j.booking) }">
            <Clock :size="18"/>
            <span>{{ j.t(j.activeHold(j.booking) ? 'held' : 'expired') }}</span>
            <strong v-if="j.activeHold(j.booking)" class="hold-timer">{{ j.remaining() }}</strong>
          </div>

          <template v-if="j.activeHold(j.booking)">
            <div class="payment-tabs" :aria-label="j.t('progressPay')">
              <button
                type="button"
                :class="{ active: j.paymentMethod === 'promptpay' }"
                :aria-pressed="j.paymentMethod === 'promptpay'"
                :disabled="j.busy"
                @click="j.paymentMethod = 'promptpay'; j.paymentError = ''"
              >
                <QrCode :size="18"/>
                <span>{{ j.t('promptpay') }}</span>
              </button>
              <button
                type="button"
                :class="{ active: j.paymentMethod === 'card' }"
                :aria-pressed="j.paymentMethod === 'card'"
                :disabled="j.busy"
                @click="j.paymentMethod = 'card'; j.paymentError = ''"
              >
                <CreditCard :size="18"/>
                <span>{{ j.t('card') }}</span>
              </button>
            </div>

            <div class="demo-payment-visual">
              <div v-if="j.paymentMethod === 'promptpay'" class="demo-qr">
                <QrCode :size="110" :stroke-width="1.3"/>
                <span class="demo-badge">DEMO</span>
              </div>
              <div v-else class="demo-card">
                <div class="demo-card-head">
                  <CreditCard :size="26"/>
                  <span>Sriracha Express</span>
                </div>
                <strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; DEMO</strong>
              </div>
              <p class="demo-caption">{{ j.t(j.paymentMethod === 'promptpay' ? 'demoQr' : 'demoCard') }}</p>
              <strong class="demo-amount">{{ j.money(j.booking.total) }}</strong>
            </div>

            <div class="demo-notice">
              <ShieldCheck :size="18"/>
              <div>
                <b>{{ j.t('demo') }}</b>
                <p>{{ j.t('demoNote') }}</p>
              </div>
            </div>
          </template>

          <div v-else class="expired-content">
            <h2>{{ j.t('expired') }}</h2>
            <p>{{ j.t('expiredNote') }}</p>
            <button class="primary" @click="j.reselect(j.booking)">
              {{ j.t('reselect') }}<ArrowRight :size="16"/>
            </button>
          </div>

          <p v-if="j.paymentError && j.activeHold(j.booking)" class="inline-notice error" role="alert">
            {{ j.t(j.paymentError) }}
          </p>
        </section>

        <TripSummary :trip="j.booking.trip" :seats="j.booking.seats" :total="j.booking.total"/>
      </div>

      <div v-if="j.activeHold(j.booking)" class="action-dock">
        <button class="text-button" :disabled="j.busy" @click="j.payLater">{{ j.t('later') }}</button>
        <button class="primary" :disabled="j.busy" @click="j.pay">
          {{ j.t(j.busy ? 'processing' : j.paymentError === 'paymentFailed' ? 'payRetry' : 'completePayment') }}
          <ArrowRight :size="16"/>
        </button>
      </div>
    </template>
  </main>
</template>
