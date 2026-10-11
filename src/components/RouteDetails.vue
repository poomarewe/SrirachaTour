<script setup>
import { inject, ref, nextTick, onBeforeUnmount } from 'vue';
import { MapPin, ArrowUpRight, ChevronDown, Map } from '@lucide/vue';
import { stations } from '../i18n';

const props = defineProps({ trip: Object });
const j = inject('journey');
const mapVisible = ref(false), mapElement = ref(null);
let map, disposed = false;

async function showMap() {
  if (mapVisible.value) return;
  mapVisible.value = true;
  await nextTick();
  const { default: L } = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  if (disposed || !mapElement.value) return;
  map = L.map(mapElement.value, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);

  const points = [];
  for (const side of ['from', 'to']) {
    const place = stations[props.trip[`${side}_location`]];
    if (place) {
      const point = [place.lat, place.lng];
      points.push(point);
      const popup = document.createElement('span');
      popup.textContent = j.station(props.trip, side);
      L.circleMarker(point, {
        radius: 7,
        color: '#002046',
        weight: 3,
        fillColor: '#008282',
        fillOpacity: 1
      }).addTo(map).bindPopup(popup);
    }
  }
  if (points.length) {
    map.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
  } else {
    map.setView([13.167812, 100.930432], 10);
  }
}

onBeforeUnmount(() => {
  disposed = true;
  map?.remove();
});
</script>

<template>
  <details class="route-details" @toggle="map?.invalidateSize()">
    <summary>
      <span class="summary-title-wrap"><MapPin :size="14"/>{{ j.t('details') }}</span>
      <ChevronDown class="chevron" :size="14"/>
    </summary>
    <div class="station-details">
      <div v-for="side in ['from','to']" :key="side" class="station-col">
        <span class="eyebrow">{{ j.t(side === 'from' ? 'pickup' : 'dropoff') }}</span>
        <b class="station-title">{{ j.station(trip, side) }}</b>
        <a :href="j.directions(trip, side)" target="_blank" rel="noopener noreferrer" class="directions-link">
          {{ j.t('directions') }}<ArrowUpRight :size="12"/>
        </a>
      </div>
    </div>
    <button type="button" class="text-button map-button" @click="showMap">
      <Map :size="14"/>{{ j.t('routeMap') }}
    </button>
    <div v-if="mapVisible" ref="mapElement" class="route-map" :aria-label="j.t('routeMap')" role="region"></div>
  </details>
</template>
