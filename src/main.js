import { createApp } from 'vue';
import { ArrowLeftRight, ArrowRight, BusFront, CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, Search, Share2 } from '@lucide/vue';
import './styles.css';

createApp({
  components: { ArrowLeftRight, ArrowRight, BusFront, CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, Search, Share2 },
  data() {
    return {
      loading: true,
      loadingTimer: null,
      revealBrand: false,
      brandTimer: null,
      route: { from: 'Sriracha', to: 'Bangkok', date: '' },
      searchedRoute: '',
      showResults: false,
      selectedDate: '',
      dateVersion: 0,
      selectedTime: '',
      selectedVehicle: '',
      shareCopied: false,
      mockRoutes: [
        { from: 'Sriracha', to: 'Bangkok', departure: '07:30', arrival: '09:45', duration: '2h 15m', fare: 180, seats: 12, vehicle: 'VIP Minivan' },
        { from: 'Sriracha', to: 'Bangkok', departure: '10:00', arrival: '12:15', duration: '2h 15m', fare: 180, seats: 8, vehicle: 'VIP Minivan' },
        { from: 'Sriracha', to: 'Bangkok', departure: '13:30', arrival: '15:45', duration: '2h 15m', fare: 180, seats: 5, vehicle: 'VIP Minivan' },
      ],
    };
  },
  computed: {
    dateTabs() {
      const base = this.selectedDate ? new Date(`${this.selectedDate}T12:00:00`) : new Date();
      const today = new Date();
      const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      return Array.from({ length: 5 }, (_, index) => {
        const date = new Date(base);
        date.setDate(base.getDate() + index - 2);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return {
          value,
          weekday: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
          dateLabel: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date),
          today: value === todayValue,
        };
      });
    },
    resultRoutes() {
      const matches = this.mockRoutes.filter(item => item.from === this.route.from && item.to === this.route.to);
      const trips = matches.length ? matches : [{
        from: this.route.from,
        to: this.route.to,
        departure: '08:00',
        arrival: '10:15',
        duration: '2h 15m',
        fare: 180,
        seats: 10,
        vehicle: 'VIP Minivan',
      }];
      return trips.filter(item => {
        const hour = Number(item.departure.slice(0, 2));
        const timeMatches = !this.selectedTime || (this.selectedTime === 'morning' ? hour < 12 : hour >= 12);
        const vehicleMatches = !this.selectedVehicle || (this.selectedVehicle === 'minibus' ? item.vehicle === 'Minibus' : item.vehicle !== 'Minibus');
        return timeMatches && vehicleMatches;
      });
    },
  },
  mounted() {
    this.loadingTimer = window.setTimeout(() => {
      this.loading = false;
      this.brandTimer = window.setTimeout(() => { this.revealBrand = true; }, 300);
    }, 900);
  },
  beforeUnmount() {
    window.clearTimeout(this.loadingTimer);
    window.clearTimeout(this.brandTimer);
  },
  methods: {
    searchRoute() {
      this.searchedRoute = `${this.route.from} → ${this.route.to}${this.route.date ? ` · ${this.route.date}` : ''}`;
      this.selectedDate = this.route.date || this.dateTabs[2].value;
      this.selectedTime = '';
      this.selectedVehicle = '';
      const tripCount = 10 + Math.floor(Math.random() * 11);
      const firstDeparture = 6 * 60;
      const lastDeparture = 18 * 60;
      this.mockRoutes = Array.from({ length: tripCount }, (_, index) => {
        const minuteOfDay = Math.round(firstDeparture + (lastDeparture - firstDeparture) * index / Math.max(1, tripCount - 1));
        const arrivalMinute = minuteOfDay + 135;
        const formatTime = minutes => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        return {
          from: this.route.from,
          to: this.route.to,
          departure: formatTime(minuteOfDay),
          arrival: formatTime(arrivalMinute),
          duration: '2h 15m',
          fare: 180 + Math.floor(Math.random() * 71),
          seats: 10 + Math.floor(Math.random() * 11),
          vehicle: Math.random() < 0.25 ? 'Minibus' : 'VIP Minivan',
        };
      });
      this.showResults = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    shareRoute() {
      if (navigator.share) navigator.share({ title: 'Sriracha Tour', text: this.searchedRoute }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(`${location.origin} · ${this.searchedRoute}`).then(() => { this.shareCopied = true; window.setTimeout(() => { this.shareCopied = false; }, 1600); });
    },
    shiftDate(amount) {
      const current = this.selectedDate ? new Date(`${this.selectedDate}T12:00:00`) : new Date();
      current.setDate(current.getDate() + amount);
      this.selectedDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      this.route.date = this.selectedDate;
      this.searchedRoute = `${this.route.from} → ${this.route.to} · ${this.selectedDate}`;
      this.dateVersion += 1;
    },
    selectDate(value) {
      this.selectedDate = value;
      this.route.date = value;
      this.searchedRoute = `${this.route.from} → ${this.route.to} · ${value}`;
      this.dateVersion += 1;
    },
  },
  template: `
    <main class="color-bends-page" :class="{ 'results-mode': showResults }" aria-label="Sriracha Tour">
      <section class="landing-content">
        <h1 class="brand-title" :class="{ 'brand-title-visible': revealBrand }" aria-label="Sriracha Tour"><span v-for="(letter, index) in 'Sriracha Tour'.split('')" :key="index" class="split-char" :style="{ '--char-index': index }" aria-hidden="true">{{ letter === ' ' ? '\u00a0' : letter }}</span></h1>
        <form class="route-search" @submit.prevent="searchRoute">
          <label>From
            <select v-model="route.from"><option>Sriracha</option><option>Bangkok</option><option>Pattaya</option><option>Chonburi</option></select>
          </label>
          <button class="route-swap" type="button" aria-label="Swap locations" @click="[route.from, route.to] = [route.to, route.from]"><ArrowLeftRight :size="16" :stroke-width="2" /></button>
          <label>To
            <select v-model="route.to"><option>Bangkok</option><option>Sriracha</option><option>Pattaya</option><option>Chonburi</option></select>
          </label>
          <label class="travel-date"><span class="field-label">Travel date <CalendarDays :size="13" /></span>
            <input v-model="route.date" type="date" />
          </label>
          <button class="search-button" type="submit"><Search :size="15" /> Search route <ArrowRight :size="15" aria-hidden="true" /></button>
        </form>
      </section>
      <Transition name="route-results">
        <section v-if="showResults" class="results-panel" aria-live="polite">
          <div class="route-overview"><span class="overview-label">YOUR TRIP</span><div class="overview-route"><b>{{ route.from }}</b><span class="overview-line"><MapPin :size="13" /><span></span><MapPin :size="13" /></span><b>{{ route.to }}</b></div><span class="overview-meta">{{ selectedDate }} · 1 passenger · One way</span><button type="button" class="share-button" @click="shareRoute"><Check v-if="shareCopied" :size="14" /> <Share2 v-else :size="14" /> {{ shareCopied ? 'Copied!' : 'Share' }}</button></div>
          <div class="results-layout">
            <aside class="filters-panel">
              <div class="filter-head"><b>Filter trips</b><button type="button" @click="selectedTime='';selectedVehicle=''">Clear</button></div>
              <div class="filter-group"><b>Departure time</b><label><input v-model="selectedTime" type="radio" value="morning"> Morning <span>06:00–12:00</span></label><label><input v-model="selectedTime" type="radio" value="afternoon"> Afternoon <span>12:00–18:00</span></label></div>
              <div class="filter-group"><b>Vehicle type</b><label><input v-model="selectedVehicle" type="radio" value="minibus"> Minibus</label><label><input v-model="selectedVehicle" type="radio" value="van"> Van</label></div>
              <div class="filter-note">Showing available departures for your route.</div>
            </aside>
            <div class="departures-column">
              <div class="date-tabs" aria-label="Choose travel date">
                <button class="date-arrow" type="button" aria-label="Previous day" @click="shiftDate(-1)"><ChevronLeft :size="18" /></button>
                <div class="date-viewport"><Transition name="date-window" mode="out-in"><div :key="dateVersion" class="date-items">
                  <button v-for="day in dateTabs" :key="day.value" type="button" :class="{ active: selectedDate === day.value, today: day.today }" :aria-pressed="selectedDate === day.value" @click="selectDate(day.value)">
                    <span class="date-weekday">{{ day.weekday }}</span><span class="date-number">{{ day.dateLabel }}</span><span v-if="day.today" class="today-tag">TODAY</span>
                  </button>
                </div></Transition></div>
                <button class="date-arrow" type="button" aria-label="Next day" @click="shiftDate(1)"><ChevronRight :size="18" /></button>
              </div>
              <div class="results-heading"><div><span class="results-kicker">AVAILABLE DEPARTURES</span><h2>{{ route.from }} <span>→</span> {{ route.to }}</h2><p>Choose a departure that works for you.</p></div><span class="result-count">{{ resultRoutes.length }} trips</span></div>
              <article v-for="(trip, index) in resultRoutes" :key="trip.departure" class="departure-card" :class="{ 'trip-selected': trip.selected }" :style="{ '--row-index': index }">
                <div class="operator-mark"><BusFront :size="18" :stroke-width="1.8" /></div>
                <div class="operator-name"><b>Sriracha Tour</b><span>{{ trip.vehicle }} · Standard seat</span></div>
                <div class="departure-time"><b>{{ trip.departure }}</b><span>{{ trip.from }}</span></div>
                <div class="trip-duration"><span class="duration-line"></span><small>{{ trip.duration }}</small></div>
                <div class="departure-time"><b>{{ trip.arrival }}</b><span>{{ trip.to }}</span></div>
                <div class="trip-fare"><b>฿{{ trip.fare }}</b><span>{{ trip.seats }} seats left</span></div>
                <button class="choose-trip" type="button" @click="trip.selected = true">{{ trip.selected ? 'Selected' : 'Choose' }} <Check v-if="trip.selected" :size="14" /><ArrowRight v-else :size="14" /></button>
              </article>
              <div v-if="!resultRoutes.length" class="empty-results">No trips match these filters. Try clearing a filter.</div>
              <button class="back-search" type="button" @click="showResults = false"><ChevronLeft :size="15" /> Edit search</button>
            </div>
          </div>
        </section>
      </Transition>
      <div class="loading-screen" :class="{ 'loading-screen-hidden': !loading }" :aria-hidden="!loading">
        <div class="loading-bar"><span></span></div>
      </div>
    </main>
  `,
}).mount('#app');
