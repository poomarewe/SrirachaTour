import { reactive, watch, nextTick } from 'vue';
import { api, post } from './api.js';
import { translations, cities, stations } from './i18n.js';
import { bangkokDate, validDate, isBookable, contactErrors, normalizeBooking, holdActive, departureTimestamp, seatRows } from '../shared/journey.js';

const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* Browsing still works without storage. */ } };
export function useJourney() {
  const s = reactive({
    locale: /^\/en(?:\/|$)/.test(location.pathname) ? 'en' : /^\/th(?:\/|$)/.test(location.pathname) ? 'th' : read('sriracha_locale') || 'th',
    page: 'choose', user: null, ready: false, authBusy: false, authError: '', username: '',
    route: { from: 'Sriracha', to: 'Bangkok', date: bangkokDate() }, timeFilter: '', vehicleFilter: '',
    trips: [], tripsBusy: false, tripsError: '', selectedTrip: null, seats: [], occupied: [], capacity: 0,
    seatsBusy: false, seatsError: '', passenger: { name: '', phone: '', email: '' }, touched: {},
    busy: false, checkoutError: '', uncertain: false, booking: null, bookings: [], bookingsBusy: false, bookingsError: '',
    paymentMethod: 'promptpay', paymentError: '', clock: Date.now(), notice: '', pageError: '', bookingBusy: false,
  });
  let searchVersion = 0, seatVersion = 0, pageVersion = 0, interval;
  let pendingAttempt = null;
  s.t = key => translations[s.locale][key] || key;
  s.city = city => s.locale === 'th' ? cities[city] || city : city;
  s.station = (trip, side) => trip?.[`${side}_station${s.locale === 'th' ? '_th' : ''}`] || stations[trip?.[`${side}_location`]]?.[s.locale] || s.city(trip?.[`${side}_location`]);
  s.directions = (trip, side = 'from') => {
    const place = stations[trip?.[`${side}_location`]];
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place ? `${place.lat},${place.lng}` : s.station(trip, side))}`;
  };
  s.dateLabel = date => validDate(date) ? new Intl.DateTimeFormat(s.locale === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00+07:00`)) : '';
  s.money = value => new Intl.NumberFormat(s.locale === 'th' ? 'th-TH' : 'en-GB', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(Number(value) || 0);
  s.vehicle = trip => s.t((trip?.vehicle || trip?.vehicle_type) === 'Minibus' ? 'bus' : 'van');
  s.passengers = count => `${count} ${s.t(count === 1 ? 'passengerSingular' : 'passengerCount')}`;
  s.today = () => bangkokDate(new Date(s.clock));
  s.activeHold = booking => holdActive(booking, s.clock);
  s.paid = booking => booking?.status === 'paid' && booking.bookingStatus !== 'cancelled';
  s.remaining = () => {
    const seconds = Math.max(0, Math.ceil((Date.parse(s.booking?.expiresAt) - s.clock) / 1000)) || 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  s.total = () => s.seats.length * (s.selectedTrip?.fare || 0);
  s.contactErrors = () => contactErrors(s.passenger);
  s.validRoute = () => !!cities[s.route.from] && !!cities[s.route.to] && s.route.from !== s.route.to && validDate(s.route.date) && s.route.date >= s.today();
  s.validCheckout = () => !s.seatsBusy && !s.seatsError && seatRows(s.capacity).length > 0 && s.seats.length > 0 && !Object.keys(s.contactErrors()).length && isBookable(s.selectedTrip, s.clock);
  s.filteredTrips = () => s.trips.filter(trip => {
    const hour = Number(trip.departure.slice(0, 2));
    return isBookable(trip, s.clock) && (!s.timeFilter || (s.timeFilter === 'morning' ? hour < 12 : hour >= 12)) && (!s.vehicleFilter || trip.vehicle === s.vehicleFilter);
  });
  s.upcoming = () => s.bookings.filter(b => (s.paid(b) || s.activeHold(b)) && departureTimestamp(b.trip.departure_date, b.trip.departure) > s.clock).sort((a, b) => departureTimestamp(a.trip.departure_date, a.trip.departure) - departureTimestamp(b.trip.departure_date, b.trip.departure));
  s.history = () => s.bookings.filter(b => !s.upcoming().some(item => item.id === b.id));
  s.statusLabel = b => s.paid(b) ? s.t('paid') : s.activeHold(b) ? s.t('pending') : s.t(b.expired || b.status === 'pending_payment' ? 'expiredStatus' : ({ cancelled: 'cancelled', refunded: 'refunded', failed: 'failed' }[b.status] || 'cancelled'));
  const searchParams = () => new URLSearchParams({ from: s.route.from, to: s.route.to, date: s.route.date });
  const pathFor = (page, id) => {
    const base = `/${s.locale}`;
    if (page === 'admin') return '/admin';
    if (page === 'choose') return `${base}?${searchParams()}`;
    if (page === 'checkout') { const params = searchParams(); params.set('trip', id || s.selectedTrip?.id || ''); return `${base}/checkout?${params}`; }
    if (page === 'payment') return `${base}/pay/${encodeURIComponent(id || s.booking?.id || '')}`;
    if (page === 'ticket') return `${base}/ticket/${encodeURIComponent(id || s.booking?.id || '')}`;
    return `${base}/trips`;
  };
  async function focusPage() { await nextTick(); document.querySelector('main h1')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  s.focusPage = focusPage;
  s.go = (page, id, replace = false) => {
    if (s.busy) return;
    if (page === '/') page = 'choose';
    if (page === '/admin') page = 'admin';
    s.page = page; s.pageError = ''; s.notice = ''; pageVersion++;
    history[replace ? 'replaceState' : 'pushState']({}, '', pathFor(page, id));
    if (page === 'trips') s.loadBookings();
    if (page === 'choose' && !s.trips.length) s.fetchTrips();
    document.title = `${s.t('brand')} · ${s.t(page === 'trips' ? 'myTrips' : page === 'ticket' ? 'ticket' : 'home')}`;
    focusPage();
  };
  s.switchLanguage = () => {
    s.locale = s.locale === 'th' ? 'en' : 'th'; write('sriracha_locale', s.locale);
    document.documentElement.lang = s.locale; history.replaceState({}, '', pathFor(s.page));
    document.title = `${s.t('brand')} · ${s.t(s.page === 'trips' ? 'myTrips' : 'home')}`;
  };
  s.quickDate = offset => { s.route.date = bangkokDate(new Date(Date.now() + offset * 86400000)); };
  s.swap = () => { [s.route.from, s.route.to] = [s.route.to, s.route.from]; };
  s.clearFilters = () => { s.timeFilter = ''; s.vehicleFilter = ''; };
  s.fetchTrips = async () => {
    const version = ++searchVersion;
    s.tripsError = ''; s.trips = [];
    if (!s.user || !s.validRoute()) { s.tripsBusy = false; return; }
    s.tripsBusy = true;
    try { const rows = await api(`/api/trips?${searchParams()}`); if (version === searchVersion) s.trips = rows.map(row => ({ ...row, id: row.trip_id, fare: Number(row.fare), seats: Number(row.seats) })); }
    catch { if (version === searchVersion) s.tripsError = 'networkError'; }
    finally { if (version === searchVersion) s.tripsBusy = false; }
  };
  s.loadSeats = async (tripId = s.selectedTrip?.id, preserve = true) => {
    const version = ++seatVersion;
    s.seatsBusy = true; s.seatsError = '';
    try {
      const data = await api(`/api/trips/${encodeURIComponent(tripId)}/seats`);
      if (version !== seatVersion) return;
      s.selectedTrip = { ...s.selectedTrip, ...data.trip, departure: data.trip.departure_time, arrival: data.trip.arrival_time, fare: Number(data.trip.fare), vehicle: data.vehicleType };
      s.capacity = Number(data.totalSeats); s.occupied = data.occupiedSeats;
      s.seats = preserve ? s.seats.filter(seat => !s.occupied.includes(seat)) : [];
      if (!isBookable(s.selectedTrip, s.clock)) s.seatsError = 'tripUnavailable';
      else if (!seatRows(s.capacity).length) s.seatsError = 'unsupported';
    } catch (error) { if (version === seatVersion) s.seatsError = error.status === 404 ? 'tripUnavailable' : 'seatLoadError'; }
    finally { if (version === seatVersion) s.seatsBusy = false; }
  };
  s.openTrip = async (trip, preserveContact = false) => {
    if (s.busy) return;
    if (s.booking?.trip.id === trip.id && s.activeHold(s.booking)) { await s.openBooking(s.booking); return; }
    const sameTrip = !preserveContact && s.selectedTrip?.id === trip.id && !(s.booking?.trip.id === trip.id && s.paid(s.booking));
    s.selectedTrip = trip; if (!sameTrip) s.seats = []; s.occupied = []; s.capacity = 0; s.checkoutError = ''; s.uncertain = false; pendingAttempt = null;
    if (!preserveContact && !sameTrip) { s.passenger = { name: '', phone: '', email: '' }; s.touched = {}; }
    s.go('checkout', trip.id); await s.loadSeats(trip.id, sameTrip);
  };
  s.toggleSeat = seat => {
    if (s.busy || s.seatsBusy || s.seatsError || s.occupied.includes(seat) || s.uncertain) return;
    s.seats = s.seats.includes(seat) ? s.seats.filter(x => x !== seat) : [...s.seats, seat];
  };
  function rememberBooking(booking) {
    s.booking = booking; write('sriracha_active_booking', JSON.stringify({ username: s.user.username, id: booking.id }));
  }
  s.loadBookings = async () => {
    if (!s.user) return false;
    s.bookingsBusy = true; s.bookingsError = '';
    const user = s.user.username;
    try { const rows = await api(`/api/users/${encodeURIComponent(user)}/bookings`); if (s.user?.username !== user) return false; s.bookings = rows.map(normalizeBooking); return true; }
    catch { s.bookingsError = 'networkError'; return false; }
    finally { s.bookingsBusy = false; }
  };
  s.reconcile = async () => {
    if (!pendingAttempt || s.busy) return;
    s.busy = true;
    const ok = await s.loadBookings();
    const found = ok && s.bookings.find(b => b.trip.id === pendingAttempt.tripId && (s.activeHold(b) || s.paid(b)) && b.seats.slice().sort().join(',') === pendingAttempt.seats.slice().sort().join(',') && b.passenger.name === pendingAttempt.passenger.name && b.passenger.phone === pendingAttempt.passenger.phone);
    s.busy = false;
    if (found) { rememberBooking(found); s.uncertain = false; s.go(s.paid(found) ? 'ticket' : 'payment', found.id); }
    else if (ok) { s.uncertain = false; s.checkoutError = 'networkError'; await s.loadSeats(); }
    else { s.uncertain = true; s.checkoutError = 'uncertain'; }
  };
  s.reserve = async () => {
    if (s.busy || s.uncertain || !s.validCheckout()) return;
    s.busy = true; s.checkoutError = '';
    pendingAttempt = { tripId: s.selectedTrip.id, seats: [...s.seats], passenger: Object.fromEntries(Object.entries(s.passenger).map(([key, value]) => [key, value.trim()])), username: s.user.username };
    try {
      const data = await post('/api/bookings', pendingAttempt);
      rememberBooking(normalizeBooking(data)); s.busy = false; s.paymentMethod = 'promptpay'; s.paymentError = ''; s.go('payment');
    } catch (error) {
      s.busy = false;
      if (error.status === 409) { s.checkoutError = 'seatConflict'; await s.loadSeats(); }
      else if (error.status === 400 || error.status === 410 || error.status === 404) { s.checkoutError = error.data?.code === 'INVALID_CONTACT' ? 'detailsRequired' : 'tripUnavailable'; await s.loadSeats(); }
      else { s.uncertain = true; await s.reconcile(); }
    }
  };
  s.loadBooking = async id => {
    const version = pageVersion;
    s.bookingBusy = true; s.pageError = '';
    try {
      const row = await api(`/api/bookings/${encodeURIComponent(id)}`);
      if (version !== pageVersion) return;
      if (row.username?.toLowerCase() !== s.user?.username.toLowerCase()) throw new Error('ticketMissing');
      rememberBooking(normalizeBooking(row));
      if (s.page === 'payment' && s.paid(s.booking)) { s.bookingBusy = false; s.go('ticket', id, true); }
    } catch (error) { if (version === pageVersion) { s.booking = null; s.pageError = error.message === 'ticketMissing' || error.status === 404 ? 'ticketMissing' : 'networkError'; } }
    finally { if (version === pageVersion) s.bookingBusy = false; }
  };
  s.retryBooking = () => s.loadBooking(decodeURIComponent(location.pathname.split('/').pop()));
  s.openBooking = async b => { rememberBooking(b); s.paymentError = ''; s.paymentMethod = 'promptpay'; s.go(s.paid(b) ? 'ticket' : 'payment', b.id); await s.loadBooking(b.id); };
  s.reselect = async b => { s.passenger = { ...b.passenger }; s.route = { from: b.trip.from_location, to: b.trip.to_location, date: b.trip.departure_date >= s.today() ? b.trip.departure_date : s.today() }; if (isBookable({ ...b.trip, status: 'scheduled' }, s.clock)) await s.openTrip({ ...b.trip, status: 'scheduled' }, true); else s.go('choose'); };
  s.pay = async () => {
    if (s.busy || !s.activeHold(s.booking)) return;
    s.busy = true; s.paymentError = '';
    try { const data = await post(`/api/bookings/${encodeURIComponent(s.booking.id)}/pay`, { paymentMethod: s.paymentMethod }); rememberBooking(normalizeBooking(data.booking)); s.busy = false; s.go('ticket'); }
    catch (error) { s.busy = false; if (error.status === 410) { s.booking.status = 'cancelled'; s.paymentError = 'expired'; } else if (error.data?.failed) s.paymentError = 'paymentFailed'; else { await s.loadBooking(s.booking.id); if (s.paid(s.booking)) s.go('ticket', s.booking.id, true); else s.paymentError = 'networkError'; } }
  };
  s.payLater = () => { s.go('trips'); s.notice = 'savingLater'; };
  s.login = async () => {
    if (s.authBusy) return;
    if (!s.username.trim()) { s.authError = 'usernameRequired'; return; }
    s.authBusy = true; s.authError = '';
    try { const result = await post('/api/auth/login', { username: s.username.trim() }); s.user = result.user; write('sriracha_username', s.user.username); await applyLocation(); await s.fetchTrips(); }
    catch { s.authError = 'loginError'; }
    finally { s.authBusy = false; }
  };
  s.logout = () => { searchVersion++; seatVersion++; pageVersion++; s.user = null; s.bookings = []; s.booking = null; s.selectedTrip = null; s.seats = []; s.passenger = { name: '', phone: '', email: '' }; s.username = ''; s.authError = ''; s.pageError = ''; s.uncertain = false; write('sriracha_username', null); write('sriracha_active_booking', null); s.go(s.page === 'admin' ? 'admin' : 'choose', null, true); };
  async function applyLocation() {
    const path = location.pathname;
    if (/^\/(en|th)(?:\/|$)/.test(path)) s.locale = path.split('/')[1];
    document.documentElement.lang = s.locale;
    const params = new URLSearchParams(location.search);
    for (const key of ['from', 'to', 'date']) if (params.get(key)) s.route[key] = params.get(key);
    s.page = path.includes('/admin') ? 'admin' : path.includes('/checkout') ? 'checkout' : path.includes('/pay/') ? 'payment' : path.includes('/ticket/') ? 'ticket' : path.endsWith('/trips') ? 'trips' : 'choose';
    s.pageError = ''; pageVersion++;
    if (!s.user) return;
    if (s.page === 'checkout') {
      if (params.get('trip') && s.booking?.trip.id === params.get('trip') && (s.activeHold(s.booking) || s.paid(s.booking))) {
        s.go(s.paid(s.booking) ? 'ticket' : 'payment', s.booking.id, true);
      } else if (params.get('trip')) {
        const same = s.selectedTrip?.id === params.get('trip');
        if (!same) { s.selectedTrip = { id: params.get('trip') }; s.seats = []; }
        await s.loadSeats(params.get('trip'), same);
      } else if (!s.selectedTrip) s.go('choose', null, true);
    }
    if (s.page === 'payment' || s.page === 'ticket') await s.loadBooking(decodeURIComponent(location.pathname.split('/').pop()));
    if (s.page === 'trips') await s.loadBookings();
    document.title = `${s.t('brand')} · ${s.t(s.page === 'trips' ? 'myTrips' : 'home')}`;
    focusPage();
  }
  const popstate = () => { applyLocation(); };
  const visibility = () => { if (document.visibilityState === 'visible') { s.clock = Date.now(); if (s.user && s.page === 'payment' && s.booking) s.loadBooking(s.booking.id); } };
  watch(() => [s.route.from, s.route.to, s.route.date], () => { if (s.user) { s.fetchTrips(); if (s.page === 'choose') history.replaceState({}, '', pathFor('choose')); } });
  s.init = async () => {
    interval = setInterval(() => { s.clock = Date.now(); }, 1000);
    window.addEventListener('popstate', popstate); document.addEventListener('visibilitychange', visibility);
    await applyLocation();
    const username = read('sriracha_username');
    if (username) {
      try { s.user = await api(`/api/auth/me?username=${encodeURIComponent(username)}`); }
      catch (error) { s.username = username; if (error.status === 404) write('sriracha_username', null); else s.authError = 'loginError'; }
    }
    if (s.user) {
      await applyLocation(); await s.fetchTrips();
      if (s.page === 'choose') { try { const saved = JSON.parse(read('sriracha_active_booking')); if (saved?.username === s.user.username && saved.id) { const row = await api(`/api/bookings/${encodeURIComponent(saved.id)}`); if (row.username?.toLowerCase() === s.user.username.toLowerCase()) s.booking = normalizeBooking(row); } } catch { /* Optional resume banner. */ } }
    }
    s.ready = true;
  };
  s.dispose = () => { clearInterval(interval); window.removeEventListener('popstate', popstate); document.removeEventListener('visibilitychange', visibility); };
  return s;
}
