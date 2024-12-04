<template>
  <teleport :to="'.comfyui-body-bottom'">
    <div
      id="pmt-action-panel"
      class="fixed bottom-0 inset-x-0 z-[1000] p-[10px] flex justify-center items-center pointer-events-none"
    >
      <ButtonGroup class="flex pointer-events-auto">
        <Button
          class="btn-run"
          size="small"
          :aria-label="'Run'"
          icon="pi pi-play-circle"
          severity="secondary"
          :loading="running"
          :disabled="saving"
          @click="run"
        />
        <Button
          class="btn-pip"
          size="small"
          :label="pipeline.name"
          icon="pi pi-circle-fill"
          severity="secondary"
          :style="{ color: pipeline.color }"
          :disabled="running || saving"
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
                @click="comfirmDelete"
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
          :disabled="running"
          @click="save"
        />
        <Button
          class="btn-exp"
          size="small"
          :aria-label="'Export'"
          icon="pi pi-download"
          severity="secondary"
          :loading="false"
          :disabled="false"
          @click="exportJson"
        />
      </ButtonGroup>
      <ConfirmDialog dismissable-mask :draggable="false"></ConfirmDialog>
    </div>
  </teleport>
</template>

<script setup>
import { shallowRef, ref, onMounted, onUnmounted } from 'vue'
import { useElementHover } from '@vueuse/core'
import ButtonGroup from 'primevue/buttongroup'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import ConfirmDialog from 'primevue/confirmdialog'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore, SYSTEM_NODE_DEFS } from '@/stores/nodeDefStore'

const nodeDefStore = useNodeDefStore()

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
  comfyApp.canvasEl.addEventListener('drop', onDrop)

  initNameAndColor()
})

onUnmounted(() => {
  comfyApp.canvasEl.removeEventListener('drop', onDrop)
})

function onDrop(e) {
  console.log('Drop:', JSON.parse(e.dataTransfer.getData('text') || 'null'))
  // ...

  e.preventDefault()
}

const pipOver = ref()
function togglePipOver(e) {
  initNameAndColor()
  pipOver.value.toggle(e)
}

const delBtn = ref()
const delBtnHovered = useElementHover(delBtn)

const confirm = useConfirm()
const comfirmDelete = (e) => {
  confirm.require({
    header: 'Delete Pipeline',
    message: 'Do you want to delete this pipeline?',
    icon: 'pi pi-exclamation-circle',
    rejectLabel: 'Cancel',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Delete',
      severity: 'danger'
    },
    reject: () => {},
    accept: async () => {
      console.log('deleting...')
      // ...
    }
  })
  togglePipOver(e)
}

const running = ref(false)
async function run() {
  if (running.value) {
    return
  }
  running.value = true
  // ...
  await new Promise((r) => setTimeout(r, 1000))
  running.value = false
}

const saving = ref(false)
async function save() {
  if (saving.value) {
    return
  }
  saving.value = true
  // ...
  await new Promise((r) => setTimeout(r, 1000))
  saving.value = false
}

function exportJson() {
  console.log(getWorkflowJson())
  // ...
}

function getWorkflowJson() {
  const workflow = window.graph.serialize()
  workflow.nodes.sort((a, b) => a.order - b.order)
  workflow.nodes.forEach(({ id, inputs, outputs }, i, nodes) => {
    const node = window.graph.getNodeById(id)
    const nodeDef = nodeDefStore.nodeDefsByName[node.type]
    const [type] = node.type.split('.')
    const [_, plugin_name, function_name] = nodeDef.python_module.split('.')
    const pmt_fields = {
      type,
      plugin_name: plugin_name || null,
      function_name: function_name || null,
      inputs: (inputs || []).map((i) => {
        return {}
      }),
      args: (node.widgets || []).reduce((args, { name, value }) => {
        args[name] = value
        return args
      }, {}),
      outputs: (outputs || []).map((o) => {
        return {
          oid: [],
          path: []
        }
      }),
      status: nodes[i].pmt_fields?.status || 'pending'
    }
    if (pmt_fields.type === 'input') {
      // pmt_fields.inputs = []
      // for temp test
      pmt_fields.outputs[0] = {
        oid: [pmt_fields.args.source || '123sacza-12312aas'],
        path: ['./data/cache/a.dcm']
      }
    } else if (pmt_fields.type === 'output') {
      // pmt_fields.outputs = []
      // for preview
      // pmt_fields.outputs = pmt_fields.inputs.map((i) => {
      //   return {
      //     oid: [],
      //     path: []
      //   }
      // })
    }
    nodes[i].pmt_fields = pmt_fields
  })
  return workflow
}
</script>
