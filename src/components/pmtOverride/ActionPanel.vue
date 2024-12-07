<template>
  <teleport :to="'.comfyui-body-bottom'">
    <Panel id="pmt-action-panel">
      <ButtonGroup>
        <Button
          v-if="!running"
          class="btn-run"
          size="small"
          :aria-label="'Run'"
          :aria-haspopup="true"
          :aria-controls="'btn-run-menu'"
          icon="pi pi-play-circle"
          severity="secondary"
          :loading="running"
          :disabled="saving"
          @click="run"
          @contextmenu.prevent="!saving && !running && runMenu.show($event)"
        />
        <Button
          v-else
          class="btn-run-stop"
          size="small"
          :aria-label="'Stop'"
          icon="pi pi-stop-circle"
          severity="danger"
          :loading="false"
          :disabled="pausing"
          @click="stop"
        />
        <Menu ref="runMenu" id="btn-run-menu" :model="runMenuItems" popup />
        <Button
          class="btn-pip"
          size="small"
          :label="pipeline.name"
          icon="pi pi-circle-fill"
          severity="secondary"
          :style="{ color: pipeline.color }"
          :loading="running"
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
                @click="confirmDelete"
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
                :label="'Change'"
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
          @click="confirmSave"
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
      <ConfirmDialog
        group="confirm_deletion"
        dismissable-mask
        :draggable="false"
      />
      <ConfirmPopup group="confirm_saving" />
      <Toast />
    </Panel>
  </teleport>
</template>

<script setup>
import { shallowRef, ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBrowserLocation, useElementHover } from '@vueuse/core'
import Panel from 'primevue/panel'
import Menu from 'primevue/menu'
import ButtonGroup from 'primevue/buttongroup'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import ConfirmDialog from 'primevue/confirmdialog'
import ConfirmPopup from 'primevue/confirmpopup'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { LiteGraph, LGraphCanvas } from '@comfyorg/litegraph'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore, SYSTEM_NODE_DEFS } from '@/stores/nodeDefStore'

const nodeDefStore = useNodeDefStore()

const router = useRouter()

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

const statusColor = {
  pending: '#ff0', // yellow
  current: '#3b82f6', // blue
  done: '#0f0', // green
  error: '#f00' // red
}

const location = useBrowserLocation()
const volViewUrl = computed(() => {
  const search = `?uiMode=lite&layoutName=${'Axial Only'}`
  let { port, origin, pathname } = location.value
  if (origin === 'file://') {
    pathname = pathname.replace('comfyui/', 'volview/')
  } else {
    if (port) {
      origin = origin.replace(port, `${+port - 1}`)
      // origin = origin.replace(port, `${+port - 3}`)
    }
    // pathname = pathname.replace('comfyui/', '') + 'volview/'
  }
  return origin + pathname + search
})

onMounted(() => {
  Object.keys(SYSTEM_NODE_DEFS).forEach((type) => {
    LiteGraph.unregisterNodeType(type)
  })

  const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions
  LGraphCanvas.prototype.getCanvasMenuOptions = function () {
    const options = getCanvasMenuOptions.apply(this, arguments)
    if (options) {
      const [add_node, ...rest] = options
      const new_options = [add_node]
      // new_options.push(null); // inserts a divider
      new_options.push({
        content: 'Reset All Nodes',
        callback: async () => {
          // reset all nodes status...
        }
      })
      new_options.push({
        content: 'Reload Plugins',
        callback: async () => {
          router.go(0)
        }
      })

      return new_options
    }
    return options
  }

  const getNodeMenuOptions = LGraphCanvas.prototype.getNodeMenuOptions
  LGraphCanvas.prototype.getNodeMenuOptions = function (node) {
    const options = getNodeMenuOptions.apply(this, arguments)
    if (options) {
      let resetOptionIndex = options.findIndex((o) => o?.content === 'Remove')
      if (resetOptionIndex === -1) resetOptionIndex = options.length
      options.splice(resetOptionIndex, 0, {
        content: 'Reset',
        callback: async () => {
          // reset node status...
          console.log('reset node status...')
        }
      })
      return options
        .filter((o) => {
          if (
            [
              'Convert to Group Node',
              'Bypass'
              // ...
            ].includes(o?.content)
          ) {
            return false
          }
          return true
        })
        .map((o) => {
          if (
            [
              'Copy (Clipspace)'
              // ...
            ].includes(o?.content)
          ) {
            return {
              ...o,
              disabled: true
            }
          }
          return o
        })
    }
    return options
  }

  comfyApp.registerExtension({
    name: 'PMT.CustomExtension',
    async nodeCreated(node) {
      if (node?.comfyClass === 'input.2d') {
        const _onMouseEnter = node.onMouseEnter
        node.onMouseEnter = function (e) {
          node.pmt_styles = {
            ringColor: statusColor['current'],
            ringWidth: 2
          }
          return _onMouseEnter?.apply(this, arguments)
        }

        const _onMouseLeave = node.onMouseLeave
        node.onMouseLeave = function (e) {
          delete node.pmt_styles
          return _onMouseLeave?.apply(this, arguments)
        }

        const _onMouseDown = node.onMouseDown
        node.onMouseDown = function (e, pos, canvas) {
          console.log(node.comfyClass, node, pos)
          return _onMouseDown?.apply(this, arguments)
        }
      }

      if (node?.comfyClass === 'output.data_to_image.main') {
        const _onDblClick = node.onDblClick
        node.onDblClick = function (e, pos, canvas) {
          console.log(node.comfyClass, node, pos)
          return _onDblClick?.apply(this, arguments)
        }

        // const _onDrawBackground = node.onDrawBackground
        // node.onDrawBackground = function (ctx, canvas, canvasElement, mousePosition) {
        //   console.log(node.comfyClass, node, mousePosition)
        //   return _onDrawBackground?.apply(this, arguments)
        // }

        console.log(volViewUrl.value)
        // const div = document.createElement('div')
        // div.classList.add('relative', 'overflow-hidden')
        // div.innerHTML = `
        //   <div class="absolute inset-0 overflow-hidden" style="background: white; color: black;">
        //     <iframe src="${volViewUrl.value}" frameborder="0" width="100%" height="100%"></iframe>
        //   </div>
        // `
        // const widget = node.addDOMWidget('pmt_volview_embed', 'volview-embed', div, {})
        // console.log(widget)
      }
    }
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

const runMenu = ref()
const runMenuItems = ref([
  {
    label: 'Run',
    icon: 'pi pi-play',
    class: 'text-sm',
    disabled: false,
    command: () => {
      run()
    }
  },
  {
    label: 'Run (step-by-step)',
    icon: 'pi pi-step-forward',
    class: 'text-sm',
    disabled: false,
    command: () => {
      run()
    }
  },
  {
    label: 'Run (to selected)',
    icon: 'pi pi-fast-forward',
    class: 'text-sm',
    disabled: true,
    command: () => {
      //
    }
  }
])

const pipOver = ref()
function togglePipOver(e) {
  initNameAndColor()
  pipOver.value.toggle(e)
}

const delBtn = ref()
const delBtnHovered = useElementHover(delBtn)

const toast = useToast()
const confirm = useConfirm()
const confirmDelete = (e) => {
  confirm.require({
    group: 'confirm_deletion',
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
    accept: async () => {
      console.log('deleting...')
      // ...
    },
    reject: () => {}
  })
  togglePipOver(e)
}
const confirmSave = (e) => {
  if (running.value) {
    return
  }
  if (saving.value) {
    return
  }
  confirm.require({
    target: e.currentTarget,
    group: 'confirm_saving',
    message: 'Save changes?',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Save'
    },
    accept: save,
    reject: () => {}
  })
}

let runningTimer = null
const running = ref(false)
async function run(e) {
  if (runMenu.value) {
    runMenu.value.hide(e)
  }
  if (running.value) {
    return
  }
  running.value = true
  // ...
  await new Promise((r) => {
    runningTimer = setTimeout(r, 5000)
  })
  running.value = false
}

const pausing = ref(false)
async function stop() {
  if (pausing.value || !running.value) {
    return
  }
  pausing.value = true
  // ...
  await new Promise((r) => setTimeout(r))
  pausing.value = false
  clearTimeout(runningTimer)
  runningTimer = null
  running.value = false
}

const saving = ref(false)
async function save() {
  if (saving.value) {
    return
  }
  saving.value = true
  console.log('saving...')
  // ...
  await new Promise((r) => setTimeout(r, 1000))
  saving.value = false
  toast.add({
    severity: 'success',
    summary: 'Saved',
    detail: 'Changes have been saved!',
    life: 3000
  })
}

function exportJson() {
  console.log(getWorkflowJson())
  // ...
}

function getWorkflowJson() {
  const workflow = comfyApp.graph.serialize()
  workflow.nodes.sort((a, b) => a.order - b.order)
  workflow.nodes.forEach(({ id, inputs, outputs }, i, nodes) => {
    const node = comfyApp.graph.getNodeById(id)
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
      status: nodes[i].pmt_fields?.status || (type === 'input' ? '' : 'pending')
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

<style>
#pmt-action-panel {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 10px;
  z-index: 1000;
  overflow: hidden;
}
#pmt-action-panel .p-panel-header {
  display: none;
}
#pmt-action-panel .p-panel-content {
  padding: 0;
}
#pmt-action-panel .p-panel-content .p-buttongroup {
  display: flex;
}
#pmt-action-panel .p-panel-content .p-buttongroup > .p-button {
  --p-icon-size: 0.875rem;
  border-radius: 0 !important;
}

#btn-run-menu {
  margin-top: -5px !important;
}
</style>
