<script setup>
import { inject } from 'vue';
import { ArrowRight, ArrowLeftRight, MapPin, CalendarDays, BusFront, SlidersHorizontal, Ticket } from '@lucide/vue';
import { cities, stations } from '../i18n';
import RouteDetails from '../components/RouteDetails.vue';

const j = inject('journey');
</script>

<template>
  <main id="main-content" class="content choose-page">
    <div class="choose-workspace">
      <!-- Search & Route Sidebar -->
      <aside class="search-panel">
        <div class="search-panel-header">
          <h1 tabindex="-1">{{ j.t('home') }}</h1>
          <p>{{ j.t('chooseNote') }}</p>
        </div>

        <div v-if="j.activeHold(j.booking)" class="resume-banner">
          <Ticket :size="18"/>
          <div>
            <b>{{ j.t('heldRide') }}</b>
            <span>{{ j.city(j.booking.trip.from_location) }} → {{ j.city(j.booking.trip.to_location) }}</span>
          </div>
          <button class="secondary" @click="j.openBooking(j.booking)">
            {{ j.t('resume') }}<ArrowRight :size="15"/>
          </button>
        </div>

        <section class="search-card card" :aria-label="j.t('home')">
          <div class="route-inputs">
            <div class="route-field">
              <label for="route-from">
                <span class="field-label-text"><MapPin :size="14"/>{{ j.t('from') }}</span>
                <select id="route-from" v-model="j.route.from">
                  <option v-for="(_, key) in cities" :key="key" :value="key">{{ j.city(key) }}</option>
                </select>
              </label>
              <span class="terminal-hint" :title="stations[j.route.from]?.[j.locale] || stations[j.route.from]?.th">
                {{ stations[j.route.from]?.[j.locale] || stations[j.route.from]?.th }}
              </span>
            </div>

            <div class="swap-wrapper">
              <button
                type="button"
                class="swap-button"
                @click="j.swap"
                :aria-label="j.t('swap')"
                title="Swap origin and destination"
              >
                <ArrowLeftRight :size="16"/>
              </button>
            </div>

            <div class="route-field">
              <label for="route-to">
                <span class="field-label-text"><MapPin :size="14"/>{{ j.t('to') }}</span>
                <select id="route-to" v-model="j.route.to">
                  <option v-for="(_, key) in cities" :key="key" :value="key">{{ j.city(key) }}</option>
                </select>
              </label>
              <span class="terminal-hint" :title="stations[j.route.to]?.[j.locale] || stations[j.route.to]?.th">
                {{ stations[j.route.to]?.[j.locale] || stations[j.route.to]?.th }}
              </span>
            </div>
          </div>

          <div class="date-input">
            <label for="travel-date">
              <CalendarDays :size="14"/>{{ j.t('date') }}
            </label>
            <div class="date-input-row">
              <input id="travel-date" type="date" :min="j.today()" v-model="j.route.date"/>
              <div class="quick-dates">
                <button
                  type="button"
                  :class="{ active: j.route.date === j.today() }"
                  @click="j.quickDate(0)"
                >
                  {{ j.t('today') }}
                </button>
                <button
                  type="button"
                  :class="{ active: j.route.date !== j.today() }"
                  @click="j.quickDate(1)"
                >
                  {{ j.t('tomorrow') }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <p v-if="!j.validRoute()" class="inline-notice error" role="alert">
          {{ j.t(j.route.from === j.route.to ? 'routeInvalid' : 'pastDate') }}
        </p>
      </aside>

      <!-- Departures & Timetable List -->
      <section class="departures" :aria-label="j.t('departures')" :aria-busy="j.tripsBusy">
        <div class="results-top">
          <div class="results-heading-group">
            <h2>
              {{ j.t('departures') }}
              <span v-if="!j.tripsBusy && j.validRoute()" class="count-pill">
                {{ j.filteredTrips().length }}
              </span>
            </h2>
            <p class="results-date-caption">{{ j.dateLabel(j.route.date) }}</p>
          </div>

          <div class="filter-controls">
            <span class="filter-icon" aria-hidden="true"><SlidersHorizontal :size="15"/></span>
            <select v-model="j.timeFilter" :aria-label="j.t('allTimes')">
              <option value="">{{ j.t('allTimes') }}</option>
              <option value="morning">{{ j.t('morning') }}</option>
              <option value="afternoon">{{ j.t('afternoon') }}</option>
            </select>
            <select v-model="j.vehicleFilter" :aria-label="j.t('allVehicles')">
              <option value="">{{ j.t('allVehicles') }}</option>
              <option value="VIP Minivan">{{ j.t('van') }}</option>
              <option value="Minibus">{{ j.t('bus') }}</option>
            </select>
          </div>
        </div>

        <div v-if="j.tripsBusy" class="trip-skeletons" role="status">
          <span class="sr-only">{{ j.t('loadingTrips') }}</span>
          <div class="skeleton card" v-for="n in 3" :key="n"></div>
        </div>

        <div v-else-if="j.tripsError" class="empty-state card" role="alert">
          <h3>{{ j.t(j.tripsError) }}</h3>
          <button class="secondary" @click="j.fetchTrips">{{ j.t('retry') }}</button>
        </div>

        <div v-else-if="!j.filteredTrips().length && j.validRoute()" class="empty-state card">
          <BusFront :size="36"/>
          <h3>{{ j.t('noTrips') }}</h3>
          <p>{{ j.t('noTripsNote') }}</p>
          <div>
            <button v-if="j.timeFilter || j.vehicleFilter" class="secondary" @click="j.clearFilters">
              {{ j.t('clearFilters') }}
            </button>
            <button class="primary" @click="j.quickDate(1)">
              {{ j.t('tryTomorrow') }}<ArrowRight :size="15"/>
            </button>
          </div>
        </div>

        <div v-else class="trip-list">
          <article v-for="trip in j.filteredTrips()" :key="trip.id" class="trip-card card">
            <div class="trip-card-content">
              <!-- Timetable & Station Schedule -->
              <div class="trip-schedule">
                <div class="schedule-point origin">
                  <span class="schedule-time">{{ trip.departure }}</span>
                  <div class="schedule-location">
                    <strong class="city-name">{{ j.city(trip.from_location) }}</strong>
                    <span class="station-name">{{ j.station(trip, 'from') }}</span>
                  </div>
                </div>

                <div class="schedule-transit">
                  <span class="duration-badge">{{ trip.duration }}</span>
                  <div class="route-line-graphic" aria-hidden="true">
                    <span class="route-dot"></span>
                    <span class="route-line"></span>
                    <ArrowRight :size="13" class="route-arrow"/>
                    <span class="route-dot destination"></span>
                  </div>
                  <span class="vehicle-badge">
                    <BusFront :size="13"/>
                    {{ j.vehicle(trip) }}
                  </span>
                </div>

                <div class="schedule-point destination">
                  <span class="schedule-time">{{ trip.arrival }}</span>
                  <div class="schedule-location">
                    <strong class="city-name">{{ j.city(trip.to_location) }}</strong>
                    <span class="station-name">{{ j.station(trip, 'to') }}</span>
                  </div>
                </div>
              </div>

              <!-- Available Inventory Status -->
              <div class="trip-status">
                <span
                  class="seat-status-pill"
                  :class="{
                    'available': trip.seats > 3,
                    'limited': trip.seats > 0 && trip.seats <= 3,
                    'sold-out': trip.seats <= 0
                  }"
                >
                  <span class="status-indicator-dot" aria-hidden="true"></span>
                  {{ trip.seats > 0 ? trip.seats + ' ' + j.t('seatsLeft') : j.t('soldOut') }}
                </span>
              </div>

              <!-- Pricing & Action Button -->
              <div class="trip-action-group">
                <div class="trip-price">
                  <strong class="fare-amount">{{ j.money(trip.fare) }}</strong>
                  <span class="fare-unit">{{ j.t('perSeat') }}</span>
                </div>
                <button
                  class="primary choose-trip"
                  :disabled="trip.seats <= 0"
                  @click="j.openTrip(trip)"
                >
                  <span>{{ j.t(trip.seats <= 0 ? 'soldOut' : 'chooseTrip') }}</span>
                  <ArrowRight :size="15"/>
                </button>
              </div>
            </div>

            <RouteDetails :trip="trip"/>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>
