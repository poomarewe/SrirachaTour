<script setup>
import { inject } from 'vue';
import { ArrowRight } from '@lucide/vue';
import TravelArt from '../components/TravelArt.vue';

const j = inject('journey');
</script>

<template>
  <main id="main-content" class="sign-in-page">
    <section class="welcome-panel">
      <span class="eyebrow">{{ j.t('brand') }}</span>
      <h1 tabindex="-1">
        <template v-if="j.locale === 'th'">ระบบจองตั๋วรถตู้และมินิบัส<br/>ศรีราชา — กรุงเทพฯ</template>
        <template v-else>{{ j.t('welcome') }}</template>
      </h1>
      <p>{{ j.t('welcomeNote') }}</p>
      <TravelArt/>
      <div class="welcome-route">
        <span>{{ j.city('Sriracha') }}</span>
        <span class="dotted-route">······ <ArrowRight :size="15"/> ······</span>
        <span>{{ j.city('Bangkok') }}</span>
      </div>
    </section>

    <section class="sign-in-card card">
      <span class="sign-in-badge">{{ j.locale === 'th' ? 'เข้าสู่ระบบจองตั๋ว' : 'Passenger Sign In' }}</span>
      <h2>{{ j.t('signInTitle') }}</h2>
      <p>{{ j.t('signInNote') }}</p>

      <form @submit.prevent="j.login" novalidate>
        <label for="username">{{ j.t('username') }}</label>
        <input
          id="username"
          v-model="j.username"
          autocomplete="username"
          maxlength="80"
          :disabled="j.authBusy"
          :aria-invalid="!!j.authError"
          aria-describedby="username-hint auth-error"
          :placeholder="j.locale === 'th' ? 'เช่น somchai' : 'e.g. somchai'"
        />
        <p id="username-hint" class="field-hint">{{ j.t('usernameHint') }}</p>
        <p id="auth-error" v-if="j.authError" class="field-error" role="alert">{{ j.t(j.authError) }}</p>
        <button class="primary full-width" :disabled="j.authBusy" type="submit">
          {{ j.t(j.authBusy ? 'signingIn' : 'letsGo') }}
          <ArrowRight :size="16"/>
        </button>
      </form>

      <div class="sign-in-footnote">
        <span class="small-dot"></span>
        {{ j.t('demoFooter') }}
      </div>
    </section>
  </main>
</template>
