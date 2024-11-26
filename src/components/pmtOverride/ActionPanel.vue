<template>
  <teleport :to="'.comfyui-body-bottom'">
    <div id="pmt-action-panel">
      <ButtonGroup>
        <Button
          class="btn-run"
          size="small"
          :aria-label="'Run'"
          icon="pi pi-play-circle"
          severity="secondary"
          :loading="running"
          @click="run"
        />
        <Button
          class="btn-pip"
          size="small"
          :label="pipeline.name"
          icon="pi pi-circle-fill"
          severity="secondary"
          :style="{ color: pipeline.color }"
          @click="togglePipOver"
        />
        <Popover ref="pipOver">
          <div class="flex flex-col">
            <div class="flex items-center">
              <InputGroup>
                <InputGroupAddon>
                  <label
                    class="relative flex justify-center items-center overflow-hidden"
                  >
                    <input
                      type="color"
                      v-model="pipelineColor"
                      class="absolute inset-0 opacity-0 hover:cursor-pointer"
                      :disabled="false"
                    />
                    <i
                      class="pi pi-circle-fill"
                      :style="{ color: pipelineColor }"
                    ></i>
                  </label>
                </InputGroupAddon>
                <InputText
                  v-model="pipelineName"
                  placeholder="Enter Name"
                  type="text"
                  :style="{ color: pipelineColor }"
                  :readonly="false"
                />
              </InputGroup>
              <Button
                ref="delBtn"
                class="btn-del ml-2"
                :aria-label="'Delete'"
                icon="pi pi-trash"
                text
                :severity="delBtnHovered ? 'danger' : 'secondary'"
                :loading="false"
                :disabled="false"
                @click.stop
              />
            </div>
            <div class="flex items-center justify-end mt-3">
              <Button
                class="ml-2"
                :label="'Cancel'"
                outlined
                severity="secondary"
                size="small"
                :loading="false"
                @click="togglePipOver"
              />
              <Button
                class="ml-2"
                :label="'Update'"
                severity="contrast"
                size="small"
                :loading="false"
                :disabled="!pipelineName"
                @click="updateNameAndColor"
              />
            </div>
          </div>
        </Popover>
        <Button
          class="btn-sav"
          size="small"
          :aria-label="'Save'"
          icon="pi pi-save"
          severity="secondary"
          :loading="saving"
          @click="save"
        />
        <Button
          class="btn-exp"
          size="small"
          :aria-label="'Export'"
          icon="pi pi-download"
          severity="secondary"
          @click="exportJson"
        />
      </ButtonGroup>
    </div>
  </teleport>
</template>

<script setup>
import { shallowRef, ref, onMounted } from 'vue'
import { useElementHover } from '@vueuse/core'
import ButtonGroup from 'primevue/buttongroup'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import { SYSTEM_NODE_DEFS } from '@/stores/nodeDefStore'

const pipeline = shallowRef({
  name: 'New Pipeline',
  color: '#FFFFFF'
})

const pipelineColor = ref('New Pipeline')
const pipelineName = ref('#FFFFFF')

const initNameAndColor = () => {
  pipelineName.value = pipeline.value.name
  pipelineColor.value = pipeline.value.color
}

const updateNameAndColor = (e) => {
  pipeline.value = {
    ...pipeline.value,
    name: pipelineName.value,
    color: pipelineColor.value
  }
  togglePipOver(e)
}

onMounted(() => {
  Object.keys(SYSTEM_NODE_DEFS).forEach((type) => {
    window.LiteGraph.unregisterNodeType(type)
  })

  initNameAndColor()
})

const pipOver = ref()
function togglePipOver(e) {
  initNameAndColor()
  pipOver.value.toggle(e)
}

const delBtn = ref()
const delBtnHovered = useElementHover(delBtn)

function getWorkflowJson() {
  const workflow = window.graph.serialize()
  workflow.nodes.sort((a, b) => a.order - b.order)
  workflow.nodes.forEach(({ id }, i, nodes) => {
    const node = window.graph.getNodeById(id)
    console.log(node)
    // ...
  })
  return workflow
}

const running = ref(false)
function run() {
  if (running.value) {
    return
  }
  console.log(getWorkflowJson())
  // ...
}

const saving = ref(false)
function save() {
  if (saving.value) {
    return
  }
  console.log(getWorkflowJson())
  // ...
}

function exportJson() {
  console.log(getWorkflowJson())
  // ...
}
</script>

<style scoped>
#pmt-action-panel {
  position: fixed;
  bottom: 0;
  z-index: 1000;
  width: 100%;
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
