<script>
import { ArrowLeftRight, BusFront, Plus, RefreshCw, Shield, Ticket, Trash2, User, Users, Pencil } from '@lucide/vue';
export default {
  props: ['currentUser'], emits: ['navigate', 'logout'],
  components: { ArrowLeftRight, BusFront, Plus, RefreshCw, Shield, Ticket, Trash2, User, Users, Pencil },
  data() { return {
      adminTab: 'trips',
      adminLoading: false,
      adminTrips: [],
      adminUsers: [],
      adminBookings: [],
      adminRoutes: [],
      adminVehicles: [],
      adminLocations: [],
      editorDataError: '',
      editType: '',
      editId: '',
      editDraft: {},
      editSaving: false,
      editError: '',
      editNotice: '',
      showAddTripForm: false,
      showAddUserForm: false,
      newTrip: {
        route_id: '',
        vehicle_id: '',
        departure_date: new Date().toISOString().split('T')[0],
        departure_time: '08:00',
        arrival_time: '10:15',
        fare: 180,
        total_seats: 13,
        available_seats: 13,
      },
      newUser: {
        username: '',
        role: 'user',
      },
  }; },
  mounted() { this.initAdminDashboard(); },
  methods: {
    navigate(path) { this.$emit('navigate', path); },
    logout() { this.$emit('logout'); },
    async safeJson(res, fallback) { const text = await res.text(); return text ? JSON.parse(text) : fallback; },
    adminHeaders() {
      return {
        'Content-Type': 'application/json',
        'x-admin-user': this.currentUser?.username || '',
      };
    },
    async initAdminDashboard() {
      if (!this.currentUser || this.currentUser.role !== 'admin') return;
      this.adminLoading = true;
      await Promise.all([
        this.loadAdminTrips(),
        this.loadAdminRoutes(),
        this.loadAdminVehicles(),
        this.loadAdminLocations(),
        this.loadAdminUsers(),
        this.loadAdminBookings(),
      ]);
      this.adminLoading = false;
    },
    async loadAdminTrips() {
      try {
        const res = await fetch('/api/admin/trips', { headers: this.adminHeaders() });
        if (res.ok) {
          const data = await this.safeJson(res, []);
          this.adminTrips = Array.isArray(data) ? data : [];
        }
      } catch (err) {
        console.error('Failed to load admin trips:', err);
      }
    },
    async loadAdminRoutes() {
      try {
        const res = await fetch('/api/admin/routes', { headers: this.adminHeaders() });
        if (res.ok) {
          const data = await this.safeJson(res, []);
          this.adminRoutes = Array.isArray(data) ? data : [];
          if (this.adminRoutes.length && !this.newTrip.route_id) {
            this.newTrip.route_id = this.adminRoutes[0].id;
          }
        }
      } catch (err) {
        console.error('Failed to load routes:', err);
      }
    },
    async loadAdminVehicles() {
      try {
        const res = await fetch('/api/admin/vehicles', { headers: this.adminHeaders() });
        if (res.ok) {
          const data = await this.safeJson(res, []);
          this.adminVehicles = Array.isArray(data) ? data : [];
          if (this.adminVehicles.length && !this.newTrip.vehicle_id) {
            this.newTrip.vehicle_id = this.adminVehicles[0].id;
          }
        }
      } catch (err) {
        console.error('Failed to load vehicles:', err);
      }
    },
    async loadAdminUsers() {
      try {
        const res = await fetch('/api/admin/users', { headers: this.adminHeaders() });
        if (res.ok) {
          const data = await this.safeJson(res, []);
          this.adminUsers = Array.isArray(data) ? data : [];
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    },
    async loadAdminLocations() {
      try {
        const res = await fetch('/api/admin/locations', { headers: this.adminHeaders() });
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error('Locations unavailable');
        const locations = await this.safeJson(res, []);
        if (!Array.isArray(locations) || !locations.length) throw new Error('Locations unavailable');
        this.adminLocations = locations;
        this.editorDataError = '';
      } catch (err) { this.editorDataError = 'Route details could not load. Refresh the page after restarting the website server.'; }
    },
    beginEdit(type, item) {
      this.editType = type;
      this.editId = item.id;
      const fields = type === 'booking' ? ['passenger_name', 'passenger_phone', 'passenger_email', 'payment_status', 'booking_status', 'notes'] : type === 'route' ? ['origin_id', 'destination_id', 'base_fare', 'duration_minutes', 'distance_km'] : ['route_id', 'vehicle_id', 'departure_date', 'departure_time', 'arrival_time', 'fare', 'status'];
      this.editDraft = Object.fromEntries(fields.map(key => [key, item[key]]));
      if (type === 'booking') {
        this.editDraft.seatText = JSON.parse(item.seat_numbers || '[]').join(', ');
        this.editDraft.notes = item.notes || '';
      }
      this.editError = ''; this.editNotice = '';
      if (type === 'route' && (this.editorDataError || !item.origin_id || !item.destination_id || item.duration_minutes == null)) this.editError = this.editorDataError || 'Route details are incomplete. Refresh the page after restarting the website server.';
      this.$nextTick(() => {
        const panels = this.$refs.editPanel;
        const panel = Array.isArray(panels) ? panels.find(el => el?.isConnected) : panels;
        panel?.scrollIntoView({ block: 'nearest' });
      });
    },
    async saveEdit() {
      if (this.editSaving) return;
      if (this.editType === 'route' && (this.editorDataError || !this.editDraft.origin_id || !this.editDraft.destination_id || this.editDraft.duration_minutes == null)) {
        this.editError = this.editorDataError || 'Route details are incomplete. Refresh the page after restarting the website server.';
        return;
      }
      this.editSaving = true; this.editError = '';
      try {
        const payload = { ...this.editDraft };
        if (this.editType === 'booking') {
          payload.seats = payload.seatText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
          delete payload.seatText;
        }
        if (this.editType === 'route' && (payload.distance_km === '' || payload.distance_km == null)) payload.distance_km = null;
        const res = await fetch(`/api/admin/${this.editType === 'booking' ? 'bookings' : this.editType === 'route' ? 'routes' : 'trips'}/${encodeURIComponent(this.editId)}`, { method: 'PUT', headers: this.adminHeaders(), body: JSON.stringify(payload) });
        const data = await this.safeJson(res, {});
        if (!res.ok) { this.editError = data.error || 'Could not save changes. Please try again.'; return; }
        await Promise.all([this.loadAdminRoutes(), this.loadAdminTrips(), this.loadAdminBookings()]);
        this.editNotice = this.editType === 'booking' ? 'Reservation changes saved.' : this.editType === 'route' ? 'Route changes saved.' : 'Trip changes saved.';
        this.editType = '';
      } catch (err) { this.editError = 'Could not save changes. Check your connection and try again.'; }
      finally { this.editSaving = false; }
    },
    async loadAdminBookings() {
      try {
        const res = await fetch('/api/admin/bookings', { headers: this.adminHeaders() });
        if (res.ok) {
          const data = await this.safeJson(res, []);
          this.adminBookings = Array.isArray(data) ? data : [];
        }
      } catch (err) {
        console.error('Failed to load bookings:', err);
      }
    },
    async removeBooking(booking) {
      if (this.editSaving || !confirm(`Permanently remove reservation ${booking.booking_code}? This releases its seats and removes it from My trips. This cannot be undone.`)) return;
      this.editSaving = true;
      try {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(booking.id)}`, { method: 'DELETE', headers: this.adminHeaders() });
        const data = await this.safeJson(res, {});
        if (!res.ok) throw new Error(data.error || 'Could not remove reservation.');
        this.editType = '';
        await Promise.all([this.loadAdminBookings(), this.loadAdminTrips()]);
        this.editNotice = 'Reservation removed. Its seats are available again.';
      } catch (err) { alert(err.message || 'Could not remove reservation. Please try again.'); }
      finally { this.editSaving = false; }
    },
    onRouteChange() {
      const r = this.adminRoutes.find(item => item.id === this.newTrip.route_id);
      if (r && r.base_fare != null) {
        this.newTrip.fare = Number(r.base_fare);
      }
    },
    onVehicleChange() {
      const v = this.adminVehicles.find(item => item.id === this.newTrip.vehicle_id);
      if (v && v.total_seats) {
        this.newTrip.total_seats = Number(v.total_seats);
        this.newTrip.available_seats = Number(v.total_seats);
      }
    },
    async createTrip() {
      this.newTrip.total_seats = Math.max(1, Number(this.newTrip.total_seats) || 13);
      this.newTrip.available_seats = this.newTrip.total_seats;

      try {
        const res = await fetch('/api/admin/trips', {
          method: 'POST',
          headers: this.adminHeaders(),
          body: JSON.stringify(this.newTrip),
        });
        const data = await this.safeJson(res, {});
        if (!res.ok) {
          alert('Error creating trip: ' + (data?.message || data?.error || 'Failed to add trip'));
          return;
        }
        this.showAddTripForm = false;
        await this.loadAdminTrips();
      } catch (err) {
        alert('Network error adding trip: ' + err.message);
      }
    },
    async deleteTrip(tripId) {
      if (!confirm(`Are you sure you want to delete trip ${tripId}?`)) return;
      try {
        const res = await fetch(`/api/admin/trips/${tripId}`, {
          method: 'DELETE',
          headers: this.adminHeaders(),
        });
        if (res.ok) {
          await this.loadAdminTrips();
        } else {
          alert('Failed to delete trip.');
        }
      } catch (err) {
        alert('Network error deleting trip');
      }
    },
    async createUser() {
      if (!this.newUser.username.trim()) return;
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: this.adminHeaders(),
          body: JSON.stringify(this.newUser),
        });
        const data = await this.safeJson(res, {});
        if (!res.ok) {
          alert('Error: ' + (data?.error || 'Failed to create user'));
          return;
        }
        this.newUser.username = '';
        this.showAddUserForm = false;
        await this.loadAdminUsers();
      } catch (err) {
        alert('Error creating user: ' + err.message);
      }
    },
    async deleteUser(userId) {
      if (!confirm('Are you sure you want to delete this user?')) return;
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: this.adminHeaders(),
        });
        if (res.ok) await this.loadAdminUsers();
      } catch (err) {
        alert('Error deleting user');
      }
    },
    async toggleUserRole(user) {
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          headers: this.adminHeaders(),
          body: JSON.stringify({ role: newRole }),
        });
        if (res.ok) await this.loadAdminUsers();
      } catch (err) {
        alert('Error updating user role');
      }
    },
    async togglePaymentStatus(booking) {
      const nextStatus = booking.payment_status === 'paid' ? 'pending_payment' : 'paid';
      try {
        const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
          method: 'PUT',
          headers: this.adminHeaders(),
          body: JSON.stringify({ payment_status: nextStatus }),
        });
        if (res.ok) await this.loadAdminBookings();
      } catch (err) {
        alert('Error updating payment status');
      }
    },
    async cancelBooking(booking) {
      if (!confirm(`Cancel booking ${booking.booking_code}?`)) return;
      try {
        const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
          method: 'PUT',
          headers: this.adminHeaders(),
          body: JSON.stringify({ booking_status: 'cancelled' }),
        });
        if (res.ok) await this.loadAdminBookings();
      } catch (err) {
        alert('Error cancelling booking');
      }
    },
  }
};
</script>
<template><div class="admin-shell">
      <section class="admin-page">
        <!-- ACCESS DENIED GUARD: When user is not an admin -->
        <div v-if="!currentUser || currentUser.role !== 'admin'" class="access-denied-wrapper">
          <div class="access-denied-card">
            <div class="denied-icon"><Shield :size="30" /></div>
            <h2>Access Denied / เฉพาะผู้ดูแลระบบ</h2>
            <p>
              The account <b>{{ currentUser ? currentUser.username : 'Guest' }}</b> has role <code>{{ currentUser ? currentUser.role : 'none' }}</code>, which is not permitted to access the Admin Panel.
            </p>
            <div class="denied-actions">
              <button class="btn-sm btn-sm-primary" type="button" @click="navigate('/')">
                <ArrowLeftRight :size="12" /> Back to Website
              </button>
              <button class="btn-sm btn-sm-secondary" type="button" @click="logout">
                <User :size="12" /> Switch to Admin Account
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <!-- Admin Header -->
          <header class="admin-header">
            <div class="admin-title-area">
              <BusFront :size="24" style="color: var(--brand);" />
              <div>
                <h1>Sriracha Tour · Admin Panel</h1>
                <small style="color: var(--muted);">Manage routes, trips, bookings & accounts</small>
              </div>
            </div>
            <div class="admin-actions">
              <span v-if="currentUser" class="user-badge">
                <User :size="13" /> {{ currentUser.username }}
                <span class="user-badge-role" :class="{ 'role-admin': currentUser.role === 'admin' }">{{ currentUser.role }}</span>
              </span>
              <button class="top-btn top-btn-secondary" type="button" @click="navigate('/')">
                <ArrowLeftRight :size="13" /> Back to Website
              </button>
            </div>
          </header>

          <!-- Admin Tabs -->
          <nav class="admin-tabs" aria-label="Admin Navigation">
            <button class="admin-tab-btn" :class="{ active: adminTab === 'routes' }" type="button" @click="adminTab = 'routes'; editType = ''; editNotice = ''" :disabled="editSaving">
              <ArrowLeftRight :size="15" /> Routes ({{ adminRoutes.length }})
            </button>
            <button class="admin-tab-btn" :class="{ active: adminTab === 'trips' }" type="button" :disabled="editSaving" @click="adminTab = 'trips'; editType = ''">
              <BusFront :size="15" /> Trips ({{ adminTrips.length }})
            </button>
            <button class="admin-tab-btn" :class="{ active: adminTab === 'users' }" type="button" :disabled="editSaving" @click="adminTab = 'users'; editType = ''">
              <Users :size="15" /> Accounts ({{ adminUsers.length }})
            </button>
            <button class="admin-tab-btn" :class="{ active: adminTab === 'bookings' }" type="button" :disabled="editSaving" @click="adminTab = 'bookings'; editType = ''">
              <Ticket :size="15" /> Bookings ({{ adminBookings.length }})
            </button>
          </nav>

          <p v-if="editNotice" class="edit-notice" role="status">{{ editNotice }}</p>


          <div v-if="adminTab === 'routes'" class="admin-card">
            <div class="admin-card-head"><h2>Manage Routes</h2><button class="btn-sm btn-sm-secondary" type="button" @click="loadAdminRoutes"><RefreshCw :size="13"/> Refresh</button></div>
            <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Origin</th><th>Destination</th><th>Base fare</th><th>Duration</th><th>Distance</th><th>Actions</th></tr></thead><tbody><template v-for="route in adminRoutes" :key="route.id"><tr><td>{{ route.from_en }}<br/><small>{{ route.from_th }}</small></td><td>{{ route.to_en }}<br/><small>{{ route.to_th }}</small></td><td>฿{{ route.base_fare }}</td><td>{{ route.duration_display_en }}</td><td>{{ route.distance_km == null ? '—' : route.distance_km + ' km' }}</td><td><button class="btn-sm btn-sm-secondary" :disabled="editSaving" type="button" @click="beginEdit('route', route)"><Pencil :size="12"/> Edit route</button></td></tr><tr v-if="editType === 'route' && editId === route.id" class="editor-row"><td colspan="6">          <section ref="editPanel" class="admin-form-panel inline-editor" aria-label="Edit existing record">
            <h3>{{ editType === 'route' ? 'Edit Route' : 'Edit Trip' }}</h3>
            <p v-if="editType === 'route'" class="edit-help">Base fare is the default for new trips. Existing trip fares stay unchanged.</p>
            <p v-else class="edit-help">Seat availability is maintained automatically. Booked trips keep their route and seat layout.</p>
            <form @submit.prevent="saveEdit">
              <fieldset :disabled="editSaving" class="edit-fields">
                <div class="admin-form-grid">
                  <template v-if="editType === 'route'">
                    <label>Origin<select v-model="editDraft.origin_id" required><option v-for="location in adminLocations" :key="location.id" :value="location.id">{{ location.name_en }} · {{ location.name_th }}</option></select></label>
                    <label>Destination<select v-model="editDraft.destination_id" required><option v-for="location in adminLocations" :key="location.id" :value="location.id">{{ location.name_en }} · {{ location.name_th }}</option></select></label>
                    <label>Base fare (฿)<input v-model.number="editDraft.base_fare" type="number" min="0" step="0.01" required/></label>
                    <label>Duration (minutes)<input v-model.number="editDraft.duration_minutes" type="number" min="1" step="1" required/></label>
                    <label>Distance (km, optional)<input v-model.number="editDraft.distance_km" type="number" min="0" step="0.1"/></label>
                  </template>
                  <template v-else>
                    <label>Route<select v-model="editDraft.route_id" required><option v-for="r in adminRoutes" :key="r.id" :value="r.id">{{ r.from_en }} → {{ r.to_en }}</option></select></label>
                    <label>Vehicle<select v-model="editDraft.vehicle_id" required><option v-for="v in adminVehicles" :key="v.id" :value="v.id">{{ v.name }} ({{ v.total_seats }} seats)</option></select></label>
                    <label>Date<input v-model="editDraft.departure_date" type="date" required/></label>
                    <label>Departure Time<input v-model="editDraft.departure_time" type="time" required/></label>
                    <label>Arrival Time<input v-model="editDraft.arrival_time" type="time" required/></label>
                    <label>Fare (฿)<input v-model.number="editDraft.fare" type="number" min="0" step="0.01" required/></label>
                    <label>Status<select v-model="editDraft.status"><option v-for="status in ['scheduled','boarding','departed','completed','cancelled']" :key="status">{{ status }}</option></select></label>
                  </template>
                </div>
                <p v-if="editError" class="edit-error" role="alert">{{ editError }}</p>
                <div class="edit-actions"><button class="btn-sm btn-sm-primary" type="submit">{{ editSaving ? 'Saving…' : 'Save changes' }}</button><button class="btn-sm btn-sm-secondary" type="button" @click="editType = ''">Cancel</button></div>
              </fieldset>
            </form>
          </section></td></tr></template><tr v-if="!adminRoutes.length"><td colspan="6">No active routes found.</td></tr></tbody></table></div>
          </div>

          <!-- TAB 1: TRIPS MANAGEMENT -->
          <div v-if="adminTab === 'trips'" class="admin-card">
            <div class="admin-card-head">
              <h2>Manage Departures & Trips</h2>
              <div style="display: flex; gap: 8px;">
                <button class="btn-sm btn-sm-secondary" type="button" @click="loadAdminTrips">
                  <RefreshCw :size="13" /> Refresh
                </button>
                <button class="btn-sm btn-sm-primary" type="button" @click="showAddTripForm = !showAddTripForm">
                  <Plus :size="13" /> {{ showAddTripForm ? 'Close Form' : 'Add New Trip' }}
                </button>
              </div>
            </div>

            <div v-if="showAddTripForm" class="admin-form-panel">
              <h3>Add New Scheduled Trip</h3>
              <form @submit.prevent="createTrip">
                <div class="admin-form-grid">
                  <label>Route
                    <select v-model="newTrip.route_id" @change="onRouteChange" required>
                      <option v-for="r in adminRoutes" :key="r.id" :value="r.id">
                        {{ r.from_en }} → {{ r.to_en }} (฿{{ r.base_fare }})
                      </option>
                    </select>
                  </label>
                  <label>Vehicle
                    <select v-model="newTrip.vehicle_id" @change="onVehicleChange">
                      <option v-for="v in adminVehicles" :key="v.id" :value="v.id">
                        {{ v.name }} ({{ v.vehicle_type }} - {{ v.total_seats }} seats)
                      </option>
                    </select>
                  </label>
                  <label>Date
                    <input v-model="newTrip.departure_date" type="date" required />
                  </label>
                  <label>Departure Time
                    <input v-model="newTrip.departure_time" type="time" required />
                  </label>
                  <label>Arrival Time
                    <input v-model="newTrip.arrival_time" type="time" required />
                  </label>
                  <label>Fare (฿)
                    <input v-model.number="newTrip.fare" type="number" min="0" required />
                  </label>
                  <label>Total Seats
                    <input v-model.number="newTrip.total_seats" type="number" min="1" @input="newTrip.available_seats = newTrip.total_seats" required />
                  </label>
                </div>
                <button class="btn-sm btn-sm-primary" type="submit" style="margin-top: 14px;">
                  Save Trip
                </button>
              </form>
            </div>

            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Route</th>
                    <th>Time</th>
                    <th>Vehicle</th>
                    <th>Fare</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="t in adminTrips" :key="t.id"><tr>
                    <td><b>{{ t.departure_date }}</b></td>
                    <td>{{ t.from_location }} → {{ t.to_location }}</td>
                    <td><b>{{ t.departure_time }}</b> - {{ t.arrival_time }}</td>
                    <td>{{ t.vehicle_name || t.vehicle_type }}</td>
                    <td>฿{{ t.fare }}</td>
                    <td>
                      <span class="badge" :class="t.available_seats > 3 ? 'badge-success' : 'badge-warning'">
                        {{ t.available_seats }} / {{ t.total_seats }}
                      </span>
                    </td>
                    <td><span class="badge badge-info">{{ t.status }}</span></td>
                    <td class="table-actions">
                      <button class="btn-sm btn-sm-secondary" :disabled="editSaving" type="button" @click="beginEdit('trip', t)"><Pencil :size="12"/> Edit trip</button>
                      <button class="btn-sm btn-sm-danger" type="button" @click="deleteTrip(t.id)">
                        <Trash2 :size="12" /> Delete
                      </button>
                    </td>
                  </tr><tr v-if="editType === 'trip' && editId === t.id" class="editor-row"><td colspan="8">          <section ref="editPanel" class="admin-form-panel inline-editor" aria-label="Edit existing record">
            <h3>{{ editType === 'route' ? 'Edit Route' : 'Edit Trip' }}</h3>
            <p v-if="editType === 'route'" class="edit-help">Base fare is the default for new trips. Existing trip fares stay unchanged.</p>
            <p v-else class="edit-help">Seat availability is maintained automatically. Booked trips keep their route and seat layout.</p>
            <form @submit.prevent="saveEdit">
              <fieldset :disabled="editSaving" class="edit-fields">
                <div class="admin-form-grid">
                  <template v-if="editType === 'route'">
                    <label>Origin<select v-model="editDraft.origin_id" required><option v-for="location in adminLocations" :key="location.id" :value="location.id">{{ location.name_en }} · {{ location.name_th }}</option></select></label>
                    <label>Destination<select v-model="editDraft.destination_id" required><option v-for="location in adminLocations" :key="location.id" :value="location.id">{{ location.name_en }} · {{ location.name_th }}</option></select></label>
                    <label>Base fare (฿)<input v-model.number="editDraft.base_fare" type="number" min="0" step="0.01" required/></label>
                    <label>Duration (minutes)<input v-model.number="editDraft.duration_minutes" type="number" min="1" step="1" required/></label>
                    <label>Distance (km, optional)<input v-model.number="editDraft.distance_km" type="number" min="0" step="0.1"/></label>
                  </template>
                  <template v-else>
                    <label>Route<select v-model="editDraft.route_id" required><option v-for="r in adminRoutes" :key="r.id" :value="r.id">{{ r.from_en }} → {{ r.to_en }}</option></select></label>
                    <label>Vehicle<select v-model="editDraft.vehicle_id" required><option v-for="v in adminVehicles" :key="v.id" :value="v.id">{{ v.name }} ({{ v.total_seats }} seats)</option></select></label>
                    <label>Date<input v-model="editDraft.departure_date" type="date" required/></label>
                    <label>Departure Time<input v-model="editDraft.departure_time" type="time" required/></label>
                    <label>Arrival Time<input v-model="editDraft.arrival_time" type="time" required/></label>
                    <label>Fare (฿)<input v-model.number="editDraft.fare" type="number" min="0" step="0.01" required/></label>
                    <label>Status<select v-model="editDraft.status"><option v-for="status in ['scheduled','boarding','departed','completed','cancelled']" :key="status">{{ status }}</option></select></label>
                  </template>
                </div>
                <p v-if="editError" class="edit-error" role="alert">{{ editError }}</p>
                <div class="edit-actions"><button class="btn-sm btn-sm-primary" type="submit">{{ editSaving ? 'Saving…' : 'Save changes' }}</button><button class="btn-sm btn-sm-secondary" type="button" @click="editType = ''">Cancel</button></div>
              </fieldset>
            </form>
          </section></td></tr></template>
                  <tr v-if="!adminTrips.length">
                    <td colspan="8" style="text-align: center; color: var(--muted); padding: 24px;">No trips found. Click "Add New Trip" to create one.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 2: USERS MANAGEMENT -->
          <div v-if="adminTab === 'users'" class="admin-card">
            <div class="admin-card-head">
              <h2>User Accounts</h2>
              <div style="display: flex; gap: 8px;">
                <button class="btn-sm btn-sm-secondary" type="button" @click="loadAdminUsers">
                  <RefreshCw :size="13" /> Refresh
                </button>
                <button class="btn-sm btn-sm-primary" type="button" @click="showAddUserForm = !showAddUserForm">
                  <Plus :size="13" /> {{ showAddUserForm ? 'Close Form' : 'Add Account' }}
                </button>
              </div>
            </div>

            <div v-if="showAddUserForm" class="admin-form-panel">
              <h3>Create User Account</h3>
              <form @submit.prevent="createUser" style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
                <label>Username
                  <input v-model="newUser.username" type="text" placeholder="e.g. manager_jane" required />
                </label>
                <label>Role
                  <select v-model="newUser.role">
                    <option value="user">user (Normal Passenger)</option>
                    <option value="admin">admin (Full Control)</option>
                  </select>
                </label>
                <button class="btn-sm btn-sm-primary" type="submit">Create User</button>
              </form>
            </div>

            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in adminUsers" :key="u.id">
                    <td><b>{{ u.username }}</b></td>
                    <td>
                      <span class="user-badge-role" :class="{ 'role-admin': u.role === 'admin' }">{{ u.role }}</span>
                    </td>
                    <td><small style="color: var(--muted);">{{ u.created_at }}</small></td>
                    <td style="display: flex; gap: 6px;">
                      <button class="btn-sm btn-sm-secondary" type="button" @click="toggleUserRole(u)">
                        Make {{ u.role === 'admin' ? 'User' : 'Admin' }}
                      </button>
                      <button v-if="u.username !== 'admin'" class="btn-sm btn-sm-danger" type="button" @click="deleteUser(u.id)">
                        <Trash2 :size="12" /> Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 3: BOOKINGS MANAGEMENT -->
          <div v-if="adminTab === 'bookings'" class="admin-card">
            <div class="admin-card-head">
              <h2>Customer Bookings & Reservations</h2>
              <button class="btn-sm btn-sm-secondary" type="button" @click="loadAdminBookings">
                <RefreshCw :size="13" /> Refresh
              </button>
            </div>

            <div class="admin-table-wrap">
              <table class="admin-table bookings-table"><colgroup><col style="width:15%"/><col style="width:14%"/><col style="width:17%"/><col style="width:18%"/><col style="width:15%"/><col style="width:7%"/><col style="width:14%"/></colgroup>
                <thead>
                  <tr>
                    <th class="reservation-actions">Actions</th>
                    <th>Code / Ticket</th>
                    <th>Customer</th>
                    <th>Trip Details</th>
                    <th>Seats</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="b in adminBookings" :key="b.id"><tr class="reservation-row">
                    <td class="reservation-actions" data-label="Actions"><div class="table-actions">
                      <button class="btn-sm btn-sm-secondary" :disabled="editSaving" type="button" aria-label="Edit reservation" @click="beginEdit('booking', b)"><Pencil :size="12"/> Edit</button>
                      <button class="btn-sm btn-sm-danger" :disabled="editSaving" type="button" @click="removeBooking(b)"><Trash2 :size="12"/> Remove</button>
                    </div></td>
                    <td data-label="Code / Ticket"><b>{{ b.booking_code }}</b><br><small style="color: var(--muted);">{{ b.ticket_number }}</small></td>
                    <td data-label="Customer">{{ b.passenger_name }}<br/><small>{{ b.passenger_phone }}</small></td>
                    <td data-label="Trip">{{ b.from_location }} → {{ b.to_location }}<br><small style="color: var(--muted);">{{ b.departure_date }} {{ b.departure_time }}</small></td>
                    <td class="reservation-seats" data-label="Seats"><b>{{ b.seats_count }}</b> · {{ JSON.parse(b.seat_numbers || '[]').join(', ') }}</td>
                    <td data-label="Total"><b>฿{{ b.total_amount }}</b></td>
                    <td data-label="Status">
                      <span class="badge" :class="b.payment_status === 'paid' ? 'badge-success' : 'badge-warning'">
                        {{ b.payment_status }}
                      </span>
                      <br/>
                      <span class="badge" :class="b.booking_status === 'confirmed' ? 'badge-success' : 'badge-danger'">
                        {{ b.booking_status }}
                      </span>
                    </td>

                  </tr>
                  <tr v-if="editType === 'booking' && editId === b.id" class="editor-row"><td colspan="7">
                    <section ref="editPanel" class="admin-form-panel inline-editor" aria-label="Edit reservation">
                      <h3>Edit Reservation · {{ b.booking_code }}</h3>
                      <p class="edit-help">Update contact details, seats or status for this trip. Separate seats with commas, for example 1A, 1B. The total uses the original price per seat. Holds keep their original expiry. Payment statuses are demo records; no money is transferred.</p>
                      <form @submit.prevent="saveEdit"><fieldset :disabled="editSaving" class="edit-fields">
                        <div class="admin-form-grid">
                          <label>Name<input v-model="editDraft.passenger_name" required maxlength="120"/></label>
                          <label>Phone<input v-model="editDraft.passenger_phone" required maxlength="30"/></label>
                          <label>Email (optional)<input v-model="editDraft.passenger_email" type="email" maxlength="254"/></label>
                          <label>Seats<input v-model="editDraft.seatText" required placeholder="1A, 1B"/></label>
                          <label>Payment status<select v-model="editDraft.payment_status"><option v-for="status in ['pending_payment','paid','refunded','cancelled']" :key="status">{{ status }}</option></select></label>
                          <label>Reservation status<select v-model="editDraft.booking_status"><option v-for="status in ['confirmed','completed','cancelled']" :key="status">{{ status }}</option></select></label>
                          <label>Notes<input v-model="editDraft.notes" maxlength="2000"/></label>
                        </div>
                        <p v-if="editError" class="edit-error" role="alert">{{ editError }}</p>
                        <div class="edit-actions"><button class="btn-sm btn-sm-primary" type="submit">{{ editSaving ? 'Saving…' : 'Save changes' }}</button><button class="btn-sm btn-sm-secondary" type="button" @click="editType = ''">Cancel</button></div>
                      </fieldset></form>
                    </section>
                  </td></tr></template>
                  <tr v-if="!adminBookings.length">
                    <td colspan="7" style="text-align: center; color: var(--muted); padding: 24px;">No customer bookings yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>

</div></template>
<style scoped>
.admin-table.bookings-table{white-space:normal;min-width:0;table-layout:fixed;font-size:11px}
.admin-table.bookings-table th,.admin-table.bookings-table td{padding:8px 6px;overflow-wrap:anywhere;line-height:1.4}
.bookings-table .reservation-actions{position:static;background:transparent;min-width:0;width:auto;box-shadow:none}
.bookings-table .reservation-actions .table-actions{gap:4px;flex-wrap:wrap}
.bookings-table .reservation-actions .btn-sm{min-height:30px;padding:4px 6px;font-size:10px}
.bookings-table .badge{white-space:normal;max-width:100%;padding:2px 4px;margin:2px 0;overflow-wrap:anywhere}
.bookings-table .reservation-seats{min-width:0;max-width:none}
@media(max-width:900px){
  .admin-table.bookings-table{display:block;width:100%}
  .bookings-table colgroup,.bookings-table thead{display:none}
  .bookings-table tbody,.bookings-table .editor-row{display:block;width:100%}
  .bookings-table .reservation-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 12px;padding:12px 0;border-bottom:1px solid var(--border)}
  .admin-table.bookings-table .reservation-row td{display:block;padding:0;border:0;min-width:0}
  .bookings-table .reservation-row td::before{content:attr(data-label);display:block;color:var(--muted);font-size:10px;margin-bottom:2px}
  .bookings-table .reservation-row .reservation-actions{grid-column:1/-1;grid-row:1;justify-self:end}
  .bookings-table .reservation-actions::before{display:none!important}
  .bookings-table .editor-row > td{display:block;width:100%;box-sizing:border-box}
  .bookings-table .inline-editor{padding:12px}
}
.editor-row > td{padding:0!important;white-space:normal}
.inline-editor{margin:0;padding:20px;border-radius:0}
.edit-fields{border:0;margin:0;padding:0;min-width:0}
.edit-help{font-size:13px;margin:10px 0 18px}
.edit-actions,.table-actions{display:flex;gap:8px;flex-wrap:wrap}
.edit-actions{margin-top:18px}
.edit-actions .btn-sm,.table-actions .btn-sm{min-height:36px}
.edit-notice{padding:14px 18px;background:#e6f5ed;border-radius:12px;color:#245a3c;margin-bottom:16px}
.edit-error{color:#a44435;margin-top:14px;font-size:13px}
.admin-shell { --navy:#002046; --brand:#00a89d; --brand-dark:#00877e; --brand-light:#e6f6f5; --border:#e2e8f0; --muted:#64748b; --subtle:#f8fafc; color:#0f172a; font-family:'DM Sans',sans-serif; }
button { border:1px solid var(--brand); background:var(--brand); color:white; border-radius:6px; }
.admin-table-wrap { overflow:auto; }
/* 2. Top Header User Controls */
.top-user-bar {
  position: fixed;
  top: 16px;
  left: max(20px, calc((100vw - 1160px) / 2));
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  font-size: 11px;
  font-weight: 700;
  color: var(--navy);
  box-shadow: 0 1px 3px rgba(0, 32, 70, 0.05);
}
.user-badge-role {
  font-size: 8px;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--subtle);
  border: 1px solid var(--border);
  color: var(--muted);
  font-weight: 700;
}
.user-badge-role.role-admin {
  background: var(--brand-light);
  color: var(--brand-dark);
  border-color: rgba(0, 168, 157, 0.25);
}
.top-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  border-radius: 6px;
  transition: all 140ms ease;
}
.top-btn-secondary {
  background: #ffffff;
  color: var(--navy);
  border: 1px solid var(--border);
}
.top-btn-secondary:hover {
  background: var(--subtle);
  border-color: var(--brand);
  color: var(--brand);
}
.top-btn-admin {
  background: var(--navy);
  color: #ffffff;
  border: 1px solid var(--navy);
}
.top-btn-admin:hover {
  background: var(--navy-dark);
  border-color: var(--navy-dark);
}

/* 3. Admin Dashboard Page */
@media screen and (min-width:1001px) {
  .admin-shell .admin-page { padding-inline:24px; }
}
.admin-page {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: #f6f8fa;
  color: #24292f;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px max(20px, calc((100vw - 1200px) / 2));
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.admin-header, .admin-tabs, .admin-card {
  flex-shrink: 0;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  flex-wrap: wrap;
  gap: 12px;
}
.admin-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}
.admin-title-area h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--navy);
}
.admin-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  min-height: 54px;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  box-shadow: 0 1px 3px rgba(0, 32, 70, 0.03);
}
.admin-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  min-height: 38px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 150ms ease;
  line-height: 1;
}
.admin-tab-btn:hover {
  background: var(--subtle);
  color: var(--navy);
  border-color: var(--border);
}
.admin-tab-btn.active {
  background: var(--brand);
  color: #ffffff;
  border-color: var(--brand);
  box-shadow: 0 2px 4px rgba(0, 168, 157, 0.25);
}
.admin-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.admin-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.admin-card-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--brand);
}
.admin-form-panel {
  background: var(--subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.admin-form-panel h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--brand);
}
.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.admin-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #57606a;
}
.admin-form-grid input, .admin-form-grid select {
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #24292f;
}
.admin-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.admin-table-container {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
}
.admin-table th {
  padding: 11px 14px;
  background: var(--subtle);
  border-bottom: 2px solid var(--border);
  color: #57606a;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.admin-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  color: #24292f;
  vertical-align: middle;
}
.admin-table tr:last-child td {
  border-bottom: none;
}
.admin-table tr:hover td {
  background: #fafbfc;
}
.badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}
.badge-success { background: var(--brand-light); color: var(--brand-dark); border: 1px solid rgba(0, 168, 157, 0.25); }
.badge-warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.badge-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.badge-info { background: var(--subtle); color: var(--navy); border: 1px solid var(--border); }
.btn-sm {
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.btn-sm-danger {
  background: #fff;
  color: #cf222e;
  border: 1px solid #cf222e;
}
.btn-sm-danger:hover {
  background: #cf222e;
  color: #fff;
}
.btn-sm-primary {
  background: var(--brand);
  color: #fff;
  border: 1px solid var(--brand);
}
.btn-sm-secondary {
  background: #fff;
  color: #24292f;
  border: 1px solid var(--border);
}
.btn-sm-secondary:hover {
  background: var(--subtle);
}

@media (max-width: 768px) {
  .top-user-bar {
    top: 10px;
    left: 10px;
  }
  .admin-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .admin-page {
    padding: 12px;
  }
}

/* 4. Access Denied Guard for /admin */
.access-denied-wrapper {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: #f6f8fa;
  z-index: 10;
}
.access-denied-card {
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
  width: min(100%, 420px);
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.denied-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #ffebe9;
  color: #cf222e;
  border: 1px solid #ffc1ba;
  display: grid;
  place-items: center;
}
.access-denied-card h2 {
  margin: 0;
  color: #cf222e;
  font-size: 18px;
  font-weight: 700;
}
.access-denied-card p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.access-denied-card code {
  background: var(--subtle);
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid var(--border);
  font-size: 11px;
}
.denied-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}


</style>
