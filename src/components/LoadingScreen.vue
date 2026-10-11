<script setup>
import { inject } from 'vue';
import { loadingMotion } from '../loadingTransition';
import loadingBus from '../assets/express-bus.svg';
const j = inject('journey');
</script>

<template>
  <div class="journey-loader" role="status" aria-live="polite" :style="{ '--departure-duration': `${loadingMotion.duration}ms`, '--layer-delay-step': `${loadingMotion.stagger}ms` }">
    <span class="journey-loader__accessible">{{ j.t('loading') }}</span>
    <div class="journey-loader__layer journey-loader__layer--last" aria-hidden="true"></div>
    <div class="journey-loader__layer journey-loader__layer--middle" aria-hidden="true"></div>
    <div class="journey-loader__layer journey-loader__layer--first" aria-hidden="true"></div>
    <div class="journey-loader__scene" aria-hidden="true">
      <div class="journey-loader__sun"></div>
      <div class="journey-loader__cloud"></div>
      <div class="journey-loader__cloud journey-loader__cloud--small"></div>
      <svg class="journey-loader__hills" viewBox="0 0 1440 420" preserveAspectRatio="none" fill="none">
        <path d="M-100 296C70 47 253 91 459 257c159-205 341-218 557-64 209-186 360-164 525 44v183H-100Z" fill="#c1d7bd" />
        <path d="M-100 377c210-199 375-173 573-45 236-164 430-178 649-59 173-108 302-99 419-11v158H-100Z" fill="#99ba9b" />
      </svg>
      <div class="journey-loader__ground"></div>
      <div class="journey-loader__road"></div>
    </div>
    <div class="journey-loader__bus" aria-hidden="true"><img :src="loadingBus" width="205" height="140" alt="" /></div>
  </div>
</template>
