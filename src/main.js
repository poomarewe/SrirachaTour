import { createApp } from 'vue';
import { ArrowLeftRight, ArrowRight, BusFront, CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, Search, Share2 } from '@lucide/vue';
import './styles.css';

const translations = {
  en: {
    from: 'From', to: 'To', travelDate: 'Travel date', search: 'Search route', yourTrip: 'YOUR TRIP',
    passenger: '1 passenger · One way', share: 'Share', copied: 'Copied!', filters: 'Filter trips', clear: 'Clear',
    departure: 'Departure time', morning: 'Morning', afternoon: 'Afternoon', vehicle: 'Vehicle type', minibus: 'Minibus',
    van: 'Van', filterNote: 'Showing available departures for your route.', available: 'AVAILABLE DEPARTURES',
    chooseHint: 'Choose a departure that works for you.', trips: 'trips', standard: 'Standard seat', seats: 'seats left',
    choose: 'Choose', selected: 'Selected', empty: 'No trips match these filters. Try clearing a filter.', edit: 'Edit search', today: 'TODAY',
  },
  th: {
    from: 'ต้นทาง', to: 'ปลายทาง', travelDate: 'วันเดินทาง', search: 'ค้นหาเที่ยวรถ', yourTrip: 'การเดินทางของคุณ',
    passenger: 'ผู้โดยสาร 1 คน · เที่ยวเดียว', share: 'แชร์', copied: 'คัดลอกแล้ว', filters: 'กรองเที่ยวรถ', clear: 'ล้าง',
    departure: 'เวลาออกเดินทาง', morning: 'ช่วงเช้า', afternoon: 'ช่วงบ่าย', vehicle: 'ประเภทรถ', minibus: 'มินิบัส',
    van: 'รถตู้', filterNote: 'เที่ยวรถที่ให้บริการตามเส้นทางที่เลือก', available: 'เที่ยวรถที่ให้บริการ',
    chooseHint: 'เลือกเวลาเดินทางที่สะดวก', trips: 'เที่ยวรถ', standard: 'ที่นั่งมาตรฐาน', seats: 'ที่นั่งว่าง',
    choose: 'เลือก', selected: 'เลือกแล้ว', empty: 'ไม่พบเที่ยวรถตามตัวกรอง ลองล้างตัวกรอง', edit: 'แก้ไขการค้นหา', today: 'วันนี้',
  },
};

createApp({
  components: { ArrowLeftRight, ArrowRight, BusFront, CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, Search, Share2 },
  data() {
    return {
      locale: window.location.pathname.replace(/\/+$/, '') === '/th' ? 'th' : 'en',
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
          weekday: new Intl.DateTimeFormat(this.locale === 'th' ? 'th-TH' : 'en', { weekday: 'short' }).format(date),
          dateLabel: new Intl.DateTimeFormat(this.locale === 'th' ? 'th-TH' : 'en', { month: 'short', day: 'numeric' }).format(date),
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
    document.documentElement.lang = this.locale;
    document.title = this.locale === 'th' ? 'ศรีราชาทัวร์ | จองรถโดยสารและรถตู้' : 'Sriracha Tour | Bus & Minivan Booking';
    const description = document.querySelector('meta[name="description"]');
    if (description && this.locale === 'th') description.content = 'ค้นหาและเปรียบเทียบเที่ยวรถโดยสารและรถตู้จากศรีราชา ตรวจสอบวันเดินทาง เวลา ราคา และที่นั่งว่าง';
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
    tr(key) { return translations[this.locale][key] || key; },
    locationName(name) {
      if (this.locale !== 'th') return name;
      return ({ Sriracha: 'ศรีราชา', Bangkok: 'กรุงเทพฯ', Pattaya: 'พัทยา', Chonburi: 'ชลบุรี' })[name] || name;
    },
    vehicleName(name) {
      if (this.locale !== 'th') return name;
      return name === 'Minibus' ? 'มินิบัส' : 'รถตู้ VIP';
    },
    durationName() { return this.locale === 'th' ? '2 ชม. 15 นาที' : '2h 15m'; },
    displayDate(value) {
      if (!value) return '';
      return new Intl.DateTimeFormat(this.locale === 'th' ? 'th-TH' : 'en', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
    },
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
      if (navigator.share) navigator.share({ title: 'Sriracha Tour', text: `${this.locationName(this.route.from)} → ${this.locationName(this.route.to)}` }).catch(() => {});
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
      <a class="language-toggle" :href="locale === 'th' ? '/' : '/th'" :lang="locale === 'th' ? 'en' : 'th'">{{ locale === 'th' ? 'EN' : 'ไทย' }}</a>
      <section class="landing-content">
        <h1 class="brand-title" :class="{ 'brand-title-visible': revealBrand }" aria-label="Sriracha Tour"><span v-for="(letter, index) in 'Sriracha Tour'.split('')" :key="index" class="split-char" :style="{ '--char-index': index }" aria-hidden="true">{{ letter === ' ' ? '\u00a0' : letter }}</span></h1>
        <form class="route-search" @submit.prevent="searchRoute">
          <label>{{ tr('from') }}
            <select v-model="route.from"><option value="Sriracha">{{ locationName('Sriracha') }}</option><option value="Bangkok">{{ locationName('Bangkok') }}</option><option value="Pattaya">{{ locationName('Pattaya') }}</option><option value="Chonburi">{{ locationName('Chonburi') }}</option></select>
          </label>
          <button class="route-swap" type="button" aria-label="Swap locations" @click="[route.from, route.to] = [route.to, route.from]"><ArrowLeftRight :size="16" :stroke-width="2" /></button>
          <label>{{ tr('to') }}
            <select v-model="route.to"><option value="Bangkok">{{ locationName('Bangkok') }}</option><option value="Sriracha">{{ locationName('Sriracha') }}</option><option value="Pattaya">{{ locationName('Pattaya') }}</option><option value="Chonburi">{{ locationName('Chonburi') }}</option></select>
          </label>
          <label class="travel-date"><span class="field-label">{{ tr('travelDate') }} <CalendarDays :size="13" /></span>
            <input v-model="route.date" type="date" />
          </label>
          <button class="search-button" type="submit"><Search :size="15" /> {{ tr('search') }} <ArrowRight :size="15" aria-hidden="true" /></button>
        </form>
      </section>
      <Transition name="route-results">
        <section v-if="showResults" class="results-panel" aria-live="polite">
          <div class="route-overview"><span class="overview-label">{{ tr('yourTrip') }}</span><div class="overview-route"><b>{{ locationName(route.from) }}</b><span class="overview-line"><MapPin :size="13" /><span></span><MapPin :size="13" /></span><b>{{ locationName(route.to) }}</b></div><span class="overview-meta">{{ displayDate(selectedDate) }} · {{ tr('passenger') }}</span><button type="button" class="share-button" @click="shareRoute"><Check v-if="shareCopied" :size="14" /> <Share2 v-else :size="14" /> {{ shareCopied ? tr('copied') : tr('share') }}</button></div>
          <div class="results-layout">
            <aside class="filters-panel">
              <div class="filter-head"><b>{{ tr('filters') }}</b><button type="button" @click="selectedTime='';selectedVehicle=''">{{ tr('clear') }}</button></div>
              <div class="filter-group"><b>{{ tr('departure') }}</b><label><input v-model="selectedTime" type="radio" value="morning"> {{ tr('morning') }} <span>06:00–12:00</span></label><label><input v-model="selectedTime" type="radio" value="afternoon"> {{ tr('afternoon') }} <span>12:00–18:00</span></label></div>
              <div class="filter-group"><b>{{ tr('vehicle') }}</b><label><input v-model="selectedVehicle" type="radio" value="minibus"> {{ tr('minibus') }}</label><label><input v-model="selectedVehicle" type="radio" value="van"> {{ tr('van') }}</label></div>
              <div class="filter-note">{{ tr('filterNote') }}</div>
            </aside>
            <div class="departures-column">
              <div class="date-tabs" aria-label="Choose travel date">
                <button class="date-arrow" type="button" aria-label="Previous day" @click="shiftDate(-1)"><ChevronLeft :size="18" /></button>
                <div class="date-viewport"><Transition name="date-window" mode="out-in"><div :key="dateVersion" class="date-items">
                  <button v-for="day in dateTabs" :key="day.value" type="button" :class="{ active: selectedDate === day.value, today: day.today }" :aria-pressed="selectedDate === day.value" @click="selectDate(day.value)">
                    <span class="date-weekday">{{ day.weekday }}</span><span class="date-number">{{ day.dateLabel }}</span><span v-if="day.today" class="today-tag">{{ tr('today') }}</span>
                  </button>
                </div></Transition></div>
                <button class="date-arrow" type="button" aria-label="Next day" @click="shiftDate(1)"><ChevronRight :size="18" /></button>
              </div>
              <div class="results-heading"><div><span class="results-kicker">{{ tr('available') }}</span><h2>{{ locationName(route.from) }} <span>→</span> {{ locationName(route.to) }}</h2><p>{{ tr('chooseHint') }}</p></div><span class="result-count">{{ resultRoutes.length }} {{ tr('trips') }}</span></div>
              <article v-for="(trip, index) in resultRoutes" :key="trip.departure" class="departure-card" :class="{ 'trip-selected': trip.selected }" :style="{ '--row-index': index }">
                <div class="operator-mark"><BusFront :size="18" :stroke-width="1.8" /></div>
                <div class="operator-name"><b>Sriracha Tour</b><span>{{ vehicleName(trip.vehicle) }} · {{ tr('standard') }}</span></div>
                <div class="departure-time"><b>{{ trip.departure }}</b><span>{{ locationName(trip.from) }}</span></div>
                <div class="trip-duration"><span class="duration-line"></span><small>{{ durationName() }}</small></div>
                <div class="departure-time"><b>{{ trip.arrival }}</b><span>{{ locationName(trip.to) }}</span></div>
                <div class="trip-fare"><b>฿{{ trip.fare }}</b><span>{{ trip.seats }} {{ tr('seats') }}</span></div>
                <button class="choose-trip" type="button" @click="trip.selected = true">{{ trip.selected ? tr('selected') : tr('choose') }} <Check v-if="trip.selected" :size="14" /><ArrowRight v-else :size="14" /></button>
              </article>
              <div v-if="!resultRoutes.length" class="empty-results">{{ tr('empty') }}</div>
              <button class="back-search" type="button" @click="showResults = false"><ChevronLeft :size="15" /> {{ tr('edit') }}</button>
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
