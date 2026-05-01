<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div class="max-w-2xl">
    <div class="card card-body text-center py-12">
      <div class="text-5xl mb-3">🚧</div>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ route.meta?.title || 'En construcción' }}
      </h2>
      <p class="text-slate-500 mt-2">
        Esta pantalla se construye en un commit posterior.
      </p>
    </div>
  </div>
</template>
