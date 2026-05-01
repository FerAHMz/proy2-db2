<script setup lang="ts">
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps<{
  labels: string[]
  data: number[]
  label?: string
  color?: string
  height?: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function render() {
  if (!canvas.value) return
  if (chart) chart.destroy()
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: props.labels,
      datasets: [{
        label: props.label || 'valor',
        data: props.data,
        backgroundColor: props.color || '#7c3aed',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
      },
    },
  })
}

onMounted(render)
watch(() => [props.labels, props.data], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div :style="{ height: (height || 220) + 'px' }">
    <canvas ref="canvas" />
  </div>
</template>
