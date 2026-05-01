<script setup lang="ts"></script>

<template>
  <div class="max-w-xl mx-auto text-center py-16">
    <div class="text-6xl mb-4">∅</div>
    <h2 class="text-2xl font-semibold text-slate-900">Ruta no encontrada</h2>
    <p class="text-slate-500 mt-2">
      La página que buscas no existe en el grafo.
    </p>
    <RouterLink :to="{ name: 'home' }" class="btn-primary mt-6 inline-flex">
      Volver al inicio
    </RouterLink>
  </div>
</template>
