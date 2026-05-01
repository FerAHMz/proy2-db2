<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Network, type Data } from 'vis-network/standalone'

interface NodeIn { id: string; label: string; group?: string; title?: string }
interface EdgeIn { from: string; to: string; label?: string; title?: string }

const props = defineProps<{
  nodes: NodeIn[]
  edges: EdgeIn[]
  height?: number
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const container = ref<HTMLDivElement | null>(null)
let network: Network | null = null

const groupColors: Record<string, string> = {
  Cliente: '#7c3aed',
  Cuenta: '#0ea5e9',
  Tarjeta: '#10b981',
  Transaccion: '#f59e0b',
  Dispositivo: '#6366f1',
  Ubicacion: '#14b8a6',
  Comercio: '#ec4899',
  AlertaFraude: '#ef4444',
  default: '#94a3b8',
}

function colorFor(group?: string) {
  return groupColors[group || 'default'] || groupColors.default
}

function render() {
  if (!container.value) return
  const data: Data = {
    nodes: props.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      title: n.title,
      shape: 'dot',
      size: 18,
      color: { background: colorFor(n.group), border: '#fff' },
      font: { color: '#0f172a', size: 12, face: 'Inter, system-ui' },
    })),
    edges: props.edges.map((e, i) => ({
      id: `e-${i}`,
      from: e.from,
      to: e.to,
      label: e.label,
      title: e.title,
      arrows: 'to',
      color: { color: '#cbd5e1', highlight: '#7c3aed' },
      font: { size: 10, color: '#64748b', background: '#fff' },
      smooth: { enabled: true, type: 'dynamic', roundness: 0.4 },
    })),
  }

  if (network) network.destroy()
  network = new Network(container.value, data, {
    autoResize: true,
    interaction: { hover: true, dragNodes: true, zoomView: true },
    physics: {
      enabled: true,
      stabilization: { iterations: 120 },
      barnesHut: { gravitationalConstant: -3000, springLength: 140 },
    },
  })
  network.on('selectNode', (params: { nodes: string[] }) => {
    if (params.nodes[0]) emit('select', params.nodes[0])
  })
}

onMounted(render)
watch(() => [props.nodes, props.edges], render, { deep: true })
onBeforeUnmount(() => network?.destroy())
</script>

<template>
  <div
    ref="container"
    class="w-full rounded-lg border border-slate-200 bg-slate-50"
    :style="{ height: (height || 420) + 'px' }"
  />
</template>
