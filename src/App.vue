<script setup>
import { provide, ref, onMounted, onBeforeUnmount } from 'vue';
import { ArrowUpRight, Ticket, UserRound } from '@lucide/vue';
import { useJourney } from './useJourney';
import SignInScreen from './screens/SignInScreen.vue';
import ChooseScreen from './screens/ChooseScreen.vue';
import CheckoutScreen from './screens/CheckoutScreen.vue';
import PaymentScreen from './screens/PaymentScreen.vue';
import TicketScreen from './screens/TicketScreen.vue';
import MyTripsScreen from './screens/MyTripsScreen.vue';
import AdminScreen from './screens/AdminScreen.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import { revealLoadingScreen } from './loadingTransition';
const j = useJourney();
const loaderVisible = ref(true);
let cancelReveal;
provide('journey', j);
onMounted(j.init);
onBeforeUnmount(() => { cancelReveal?.(); j.dispose(); });
function leaveLoading(element, done) {
  cancelReveal = revealLoadingScreen(element, done);
}
</script>
<template>
  <Transition :css="false" @leave="leaveLoading" @after-leave="loaderVisible = false; j.focusPage()"><LoadingScreen v-if="!j.ready" /></Transition>
  <a class="skip-link" href="#main-content" :inert="loaderVisible">{{ j.locale === 'th' ? 'ข้ามไปเนื้อหา' : 'Skip to content' }}</a>
  <div v-if="j.page !== 'admin' || !j.user" class="site-shell" :inert="loaderVisible" :aria-busy="loaderVisible">
    <header class="site-header">
      <button class="brand" :disabled="j.busy" @click="j.user && j.go('choose')" :aria-label="j.t('brand')"><img class="brand-logo" src="/sriracha-express-logo.png" width="1024" height="419" alt="Sriracha Express" /></button>
      <div class="header-tools">
      <span v-if="j.user" class="header-account" :title="j.user.username" :aria-label="j.t('account') + ' ' + j.user.username"><UserRound :size="15"/><b>{{ j.user.username }}</b></span>
      <nav class="header-nav" :aria-label="j.locale === 'th' ? 'เมนูหลัก' : 'Main navigation'">
        <button v-if="j.user" class="nav-link" :class="{ active: j.page === 'choose' }" :disabled="j.busy" @click="j.go('choose')">{{ j.t('home') }}</button>
        <button v-if="j.user" class="nav-link" :class="{ active: j.page === 'trips' }" :disabled="j.busy" @click="j.go('trips')"><Ticket :size="17" />{{ j.t('myTrips') }}</button>
        <button class="language-button" :disabled="j.busy" @click="j.switchLanguage()" :aria-label="j.locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'">{{ j.locale === 'th' ? 'EN' : 'ไทย' }}</button>
      </nav>
      </div>
    </header>
    <SignInScreen v-if="j.ready && !j.user" />
    <template v-else-if="j.ready">
      <Transition name="page" mode="out-in" @after-enter="j.focusPage">
        <ChooseScreen v-if="j.page === 'choose'" />
        <CheckoutScreen v-else-if="j.page === 'checkout'" />
        <PaymentScreen v-else-if="j.page === 'payment'" />
        <TicketScreen v-else-if="j.page === 'ticket'" />
        <MyTripsScreen v-else />
      </Transition>
    </template>
    <footer class="site-footer"><span>{{ j.t('farewell') }}</span><span>Sriracha Express <ArrowUpRight :size="15" /></span></footer>
  </div>
  <AdminScreen v-else-if="j.ready" :current-user="j.user" @navigate="j.go" @logout="j.logout" />
</template>
