<script setup>
import { ref, watch } from 'vue'
import {
  uploadImages as apiUploadImages,
  updateImage  as apiUpdateImage,
  deleteImage  as apiDeleteImage,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE
} from '@/services/api.js'

const props = defineProps({
  date:     { type: String,  required: true },
  images:   { type: Array,   default: () => [] },   // [{ id, url, naturalWidth, naturalHeight, x, y, w }]
  editable: { type: Boolean, default: false }         // false en PaperView (solo mostrar), true en EntryEditor
})
const emit = defineEmits(['change'])   // se emite con el array completo actualizado, tras cualquier cambio

// Copia local reactiva — así el arrastre se siente instantáneo (movemos
// esta copia en cada pointermove) sin esperar la respuesta del servidor
// en cada frame. Solo se re-sincroniza con la prop si no hay un arrastre
// en curso, para no "pelear" con el gesto del usuario a mitad de camino.
const local = ref(props.images.map(i => ({ ...i })))
const draggingId = ref(null)

watch(() => props.images, (next) => {
  if (draggingId.value) return
  local.value = next.map(i => ({ ...i }))
})

const canvasRef    = ref(null)
const fileInputRef = ref(null)
const uploading    = ref(false)
const isDragOver   = ref(false)
const errorMsg     = ref('')

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)) }

// Alto de una imagen, en % del canvas — se DERIVA del aspect ratio
// natural de la foto, nunca se guarda en la base de datos (ver
// schema.prisma). Solo lo necesitamos aquí para no dejar que una foto
// se arrastre más allá del borde inferior del lienzo.
function heightPercent(img, canvasRect) {
  const widthPx = (img.w / 100) * canvasRect.width
  const heightPx = widthPx * (img.naturalHeight / img.naturalWidth)
  return (heightPx / canvasRect.height) * 100
}

function showError(msg) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 4000)
}

// ── Subida ─────────────────────────────────────────────────────
function triggerFileSelect() {
  if (!uploading.value) fileInputRef.value?.click()
}

async function handleFiles(fileList) {
  const files = Array.from(fileList)
  const valid = []
  const rejected = []

  // Validación en el CLIENTE — feedback inmediato, pero decorativa:
  // la validación real (la que de verdad protege el servidor) vive
  // en upload.middleware.js y images.controller.js del backend.
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      rejected.push(`${file.name} — formato no permitido`)
    } else if (file.size > MAX_IMAGE_SIZE) {
      rejected.push(`${file.name} — supera 8MB`)
    } else {
      valid.push(file)
    }
  }

  if (rejected.length) showError(`No se subieron: ${rejected.join(', ')}`)
  if (valid.length === 0) return

  uploading.value = true
  try {
    const result = await apiUploadImages(props.date, valid)
    local.value = [...local.value, ...result.images]
    emit('change', local.value)
    if (result.failed?.length) {
      showError(`No se pudieron procesar: ${result.failed.join(', ')}`)
    }
  } catch (err) {
    showError(err.message || 'Error al subir las imágenes')
  } finally {
    uploading.value = false
  }
}

function onFileInputChange(e) {
  handleFiles(e.target.files)
  e.target.value = ''   // permite volver a elegir el mismo archivo después
}

function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
}

// ── Borrado ────────────────────────────────────────────────────
async function removeImage(img) {
  if (!confirm('¿Borrar esta foto?')) return
  try {
    await apiDeleteImage(img.id)
    local.value = local.value.filter(i => i.id !== img.id)
    emit('change', local.value)
  } catch (err) {
    showError(err.message || 'No se pudo borrar la imagen')
  }
}

// ── Arrastrar (reposicionar) ──────────────────────────────────────
// Usamos la Pointer Events API con setPointerCapture: una vez que el
// puntero "presiona" el elemento, TODOS los eventos siguientes (incluso
// si el cursor sale del elemento durante un arrastre rápido) se siguen
// entregando a ese mismo elemento. Es la forma moderna y robusta de
// implementar arrastre — más confiable que combinar mousedown/mousemove/
// mouseup a mano, y funciona igual con touch en móviles sin código extra.
function startDrag(img, e) {
  if (!props.editable) return
  e.preventDefault()

  const target = e.currentTarget
  target.setPointerCapture(e.pointerId)

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const startPointerX = e.clientX
  const startPointerY = e.clientY
  const startX = img.x
  const startY = img.y

  draggingId.value = img.id
  // "Traer al frente": la movemos al final del array local, así se
  // renderiza después que las demás y queda visualmente encima —
  // sin necesidad de gestionar z-index manualmente.
  local.value = [...local.value.filter(i => i.id !== img.id), img]

  function onMove(ev) {
    const dx = ((ev.clientX - startPointerX) / canvasRect.width) * 100
    const dy = ((ev.clientY - startPointerY) / canvasRect.height) * 100
    const h  = heightPercent(img, canvasRect)
    img.x = clamp(startX + dx, 0, 100 - img.w)
    img.y = clamp(startY + dy, 0, 100 - h)
  }

  function onUp() {
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    draggingId.value = null
    persist(img)
  }

  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp, { once: true })
}

// ── Redimensionar ──────────────────────────────────────────────
// Solo seguimos el desplazamiento horizontal del puntero para calcular
// el nuevo ancho (%) — el alto se sigue derivando automáticamente del
// aspect ratio, así que nunca se puede deformar la foto al agrandarla
// o encogerla.
function startResize(img, e) {
  if (!props.editable) return
  e.preventDefault()
  e.stopPropagation()   // no dispares también startDrag en el mismo gesto

  const target = e.currentTarget
  target.setPointerCapture(e.pointerId)

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const startPointerX = e.clientX
  const startW = img.w

  draggingId.value = img.id

  function onMove(ev) {
    const dx = ((ev.clientX - startPointerX) / canvasRect.width) * 100
    img.w = clamp(startW + dx, 8, 100 - img.x)
  }

  function onUp() {
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    draggingId.value = null
    persist(img)
  }

  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp, { once: true })
}

async function persist(img) {
  try {
    const updated = await apiUpdateImage(img.id, { x: img.x, y: img.y, w: img.w })
    Object.assign(img, updated)   // por si el servidor recortó algún valor
    emit('change', local.value)
  } catch (err) {
    showError(err.message || 'No se pudo guardar la posición')
  }
}
</script>

<template>
  <div v-if="editable || local.length > 0" class="image-section">

    <div
      ref="canvasRef"
      :class="['canvas', isDragOver ? 'drag-over' : '']"
      @dragover.prevent="editable && (isDragOver = true)"
      @dragleave="isDragOver = false"
      @drop="editable && onDrop($event)"
    >
      <!-- Estado vacío dentro del lienzo, solo en modo editable -->
      <div v-if="editable && local.length === 0" class="canvas-empty" @click="triggerFileSelect">
        <span class="canvas-empty-icon">📷</span>
        <p class="canvas-empty-title">Arrastra tus fotos aquí</p>
        <p class="canvas-empty-sub">o haz clic para seleccionar</p>
      </div>

      <!-- Fotos posicionadas -->
      <div
        v-for="img in local" :key="img.id"
        class="photo"
        :class="{ dragging: draggingId === img.id, editable }"
        :style="{
          left:  img.x + '%',
          top:   img.y + '%',
          width: img.w + '%',
          aspectRatio: `${img.naturalWidth} / ${img.naturalHeight}`
        }"
        @pointerdown="startDrag(img, $event)"
      >
        <img :src="img.url" :alt="''" class="photo-img" draggable="false" />

        <template v-if="editable">
          <button class="photo-delete" @pointerdown.stop @click.stop="removeImage(img)" title="Borrar foto">✕</button>
          <div class="photo-resize" @pointerdown="startResize(img, $event)" title="Redimensionar" />
        </template>
      </div>
    </div>

    <!-- Controles de subida (solo editable) -->
    <div v-if="editable" class="upload-row">
      <button class="upload-btn" @click="triggerFileSelect" :disabled="uploading">
        {{ uploading ? 'Subiendo...' : '+ Añadir fotos' }}
      </button>
      <div class="format-badges">
        <span class="format-badge">JPG</span>
        <span class="format-badge">JPEG</span>
        <span class="format-badge">PNG</span>
        <span class="format-note">· máx. 8MB</span>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png"
        multiple
        class="hidden-input"
        @change="onFileInputChange"
      />
    </div>

    <p v-if="errorMsg" class="upload-error">{{ errorMsg }}</p>
  </div>
</template>

<style scoped>
.image-section { display: flex; flex-direction: column; gap: 8px; }

.canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--sf2);
  border: 1px dashed var(--bd);
  border-radius: var(--r);
  overflow: hidden;
  transition: border-color .14s, background .14s;
}
.canvas.drag-over { border-color: var(--a); background: var(--ad); }

.canvas-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; color: var(--tm); text-align: center; gap: 2px;
}
.canvas-empty-icon  { font-size: 26px; opacity: .5; margin-bottom: 4px; }
.canvas-empty-title { font-family: var(--fb); font-style: italic; font-size: 13px; color: var(--tx); }
.canvas-empty-sub   { font-size: 11px; color: var(--tm); }

.photo {
  position: absolute;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 3px 10px rgba(0,0,0,.25);
  background: var(--sf3);
}
.photo.editable  { cursor: grab; touch-action: none; }
.photo.dragging  { cursor: grabbing; box-shadow: 0 8px 20px rgba(0,0,0,.35); z-index: 5; }
.photo-img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }

.photo-delete {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px; border-radius: 50%;
  border: none; background: rgba(0,0,0,.55); color: #fff;
  font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background .14s;
}
.photo-delete:hover { background: rgba(220,60,60,.85); }

.photo-resize {
  position: absolute; bottom: 0; right: 0;
  width: 16px; height: 16px;
  cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,.65) 50%);
}

.upload-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.upload-btn {
  padding: 6px 14px; border-radius: var(--rs); border: 1px solid var(--bd);
  background: var(--sf); color: var(--tm); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all .14s; font-family: 'Inter', sans-serif;
}
.upload-btn:hover:not(:disabled) { background: var(--sf2); color: var(--tx); border-color: var(--a); }
.upload-btn:disabled { opacity: .6; cursor: default; }

.format-badges { display: flex; align-items: center; gap: 5px; }
.format-badge {
  padding: 2px 7px; border-radius: 4px; background: var(--sf2);
  color: var(--tm); font-size: 9px; font-weight: 700; letter-spacing: .04em;
}
.format-note { font-size: 10px; color: var(--tf); margin-left: 2px; }

.hidden-input { display: none; }

.upload-error { font-size: 11px; color: #F87B74; }
</style>
