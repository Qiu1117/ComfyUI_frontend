<template>
  <teleport :to="'.comfyui-body-bottom'">
    <Panel id="pmt-action-panel">
      <ButtonGroup>
        <Button
          v-if="stoppable ? !loading && !running : true"
          class="btn-run"
          size="small"
          :aria-label="'Run'"
          :aria-haspopup="true"
          :aria-controls="'btn-run-menu'"
          icon="pi pi-play-circle"
          severity="secondary"
          :loading="running"
          :disabled="loading || saving || deleting"
          @click="run"
          @contextmenu.prevent="
            !!pipelineId &&
              !loading &&
              !saving &&
              !running &&
              !deleting &&
              runMenu.show($event)
          "
        />
        <Button
          v-else-if="!loading"
          class="btn-run-stop"
          size="small"
          :aria-label="'Stop'"
          icon="pi pi-stop-circle"
          severity="danger"
          :loading="false"
          :disabled="pausing"
          @click="stop"
          @contextmenu.prevent.stop
        />
        <Menu ref="runMenu" id="btn-run-menu" :model="runMenuItems" popup />
        <Button
          v-if="!!pipelineId"
          class="btn-pip"
          size="small"
          :title="pipeline.description"
          :label="loading ? '' : (isNewPipeline ? '*' : '') + pipeline.name"
          icon="pi pi-circle-fill"
          severity="secondary"
          :style="{ color: pipeline.color }"
          :loading="loading || running"
          :disabled="loading || running || saving || deleting"
          @click="togglePipOver"
          @contextmenu.prevent.stop
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
                :loading="deleting"
                :disabled="loading || isNewPipeline || running || saving"
                @click="confirmDelete"
              />
            </div>
            <div class="flex items-start mt-2">
              <Textarea
                v-model="pipelineDescription"
                placeholder="Description..."
                class="w-full resize-none"
                :auto-resize="false"
                :rows="2"
                :readonly="false"
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
                :disabled="false"
                @click="togglePipOver"
              />
              <Button
                class="ml-2"
                :label="'Change'"
                severity="contrast"
                size="small"
                :loading="false"
                :disabled="!pipelineName || saving || deleting"
                @click="commitPipEdit"
              />
            </div>
          </div>
        </Popover>
        <Button
          v-if="!loading"
          class="btn-term"
          size="small"
          :aria-label="'Terminal'"
          icon="pi pi-code"
          :severity="showTerminal ? 'primary' : 'secondary'"
          :loading="false"
          :disabled="loading || deleting"
          @click="toggleTerminal()"
          @contextmenu.prevent.stop
        />
        <Button
          v-if="!loading"
          class="btn-sav"
          size="small"
          :aria-label="'Save'"
          icon="pi pi-save"
          severity="secondary"
          :loading="saving"
          :disabled="loading || running || deleting"
          @click="confirmSave"
          @contextmenu.prevent.stop
        />
        <Button
          v-if="!loading"
          class="btn-exp"
          size="small"
          :aria-label="'Export'"
          icon="pi pi-download"
          severity="secondary"
          :loading="false"
          :disabled="loading || deleting"
          @click="exportJson"
          @contextmenu.prevent="exportJson(false)"
        />
      </ButtonGroup>

      <ButtonGroup class="ml-2">
        <Button
          class="btn-input"
          size="small"
          :aria-label="'Input Node'"
          label="#9"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleInputNode"
        />
        <Button
          class="btn-quality"
          size="small"
          :aria-label="'Quality Control'"
          label="#6"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleQualityControl"
        />
        <Button
          class="btn-dynamic"
          size="small"
          :aria-label="'Dynamic Scan'"
          label="#1"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleValidator"
        />
        <Button
          class="btn-phase"
          size="small"
          :aria-label="'Phase Map'"
          label="#2"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handlePhaseMap"
        />
        <Button
          class="btn-rmpfsl"
          size="small"
          :aria-label="'RMPFSL'"
          label="#3"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleRMPFSL"
        />
        <Button
          class="btn-mpf"
          size="small"
          :aria-label="'MPF Calculator'"
          label="#13"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleMPF"
        />
        <Button
          class="btn-roi-mask"
          size="small"
          :aria-label="'ROI Mask'"
          label="#10"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleROIMask"
        />
        <Button
          class="btn-roi-analyzer"
          size="small"
          :aria-label="'ROI Analyzer'"
          label="#5"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleROIAnalyzer"
        />
        <Button
          class="btn-mpf-report"
          size="small"
          :aria-label="'MPF Report'"
          label="#7"
          severity="secondary"
          :loading="false"
          :disabled="loading || running"
          @click="handleMPFReport"
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
    <div
      class="terminal-container pointer-events-none"
      :class="showTerminal ? 'z-[9999]' : '-z-[1]'"
    >
      <div
        id="terminal"
        :class="showTerminal ? 'pointer-events-auto' : 'invisible'"
      ></div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  useBrowserLocation,
  useLocalStorage,
  useElementHover,
  useThrottleFn
} from '@vueuse/core'
import Panel from 'primevue/panel'
import Menu from 'primevue/menu'
import ButtonGroup from 'primevue/buttongroup'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ConfirmDialog from 'primevue/confirmdialog'
import ConfirmPopup from 'primevue/confirmpopup'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { LiteGraph, LGraphCanvas } from '@comfyorg/litegraph'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore, SYSTEM_NODE_DEFS } from '@/stores/nodeDefStore'
import { useCommandStore } from '@/stores/commandStore'
import { workflowService } from '@/services/workflowService'
import { merge } from 'lodash'

let decodeMultiStream = (stream) => {
  console.warn('MessagePack not found')
  return stream
}

const nodeDefStore = useNodeDefStore()

const route = useRoute()
const router = useRouter()

const { pipelineId, workflow_name } = route.query
const pipelineName = ref('New Workflow')
const pipelineDescription = ref('')
const pipelineColor = ref('#FFFFFF')

const pipelines = useLocalStorage('pipelines', pipelineId ? [] : null)
const pipeline = ref({
  id: pipelineId,
  // id: 1,
  name: pipelineName.value,
  description: pipelineDescription.value,
  color: pipelineColor.value
})
const pipelineWorkflow = computed(() =>
  pipeline.value.workflow ? JSON.parse(pipeline.value.workflow) : null
)
const isNewPipeline = computed(() => !pipeline.value.workflow)

const commitPipEdit = (e) => {
  pipeline.value.name = pipelineName.value
  pipeline.value.description = pipelineDescription.value
  pipeline.value.color = pipelineColor.value
  togglePipOver(e)
}

const loading = ref(!!pipeline.value?.id)

function addPipelineEventListeners() {
  if (window.$electron) {
    window.$electron.ipcRendererOn('got-pipeline', handleGetPipeline)
    window.$electron.ipcRendererOn('created-pipeline', handleCreatePipeline)
    window.$electron.ipcRendererOn('updated-pipeline', handleUpdatePipeline)
    window.$electron.ipcRendererOn('deleted-pipeline', handleDeletePipeline)
  }
}

function removePipelineEventListeners() {
  if (window.$electron) {
    window.$electron.ipcRendererOff('got-pipeline')
    window.$electron.ipcRendererOff('created-pipeline')
    window.$electron.ipcRendererOff('updated-pipeline')
    window.$electron.ipcRendererOff('deleted-pipeline')
  }
}

const nodesSelected = shallowRef([])
const nodesSelectedCount = computed(() => nodesSelected.value.length)
const updateNodesSelected = useThrottleFn(() => {
  nodesSelected.value = comfyApp.graph.nodes.filter((node) => node.selected)
}, 100)

const location = useBrowserLocation()
const volViewUrl = computed(() => {
  const search = `?uiMode=lite&layoutName=${'Axial Only'}`
  // + `&names=[data.png]&urls=[connect-file://localhost/C:\\sample test data\\data.png]`
  // + `&names=[test.zip]&urls=[connect-file://localhost/C:\\sample test data\\test2\\MRI-PROSTATEx-0004.zip]&uid=test2&slice=0`
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

const driverObjs = []
function highlight(element, popover = {}, config, step) {
  const driver = window.driver?.js?.driver
  if (!driver) return

  const driverObj = driver(config)

  if (typeof element === 'string') {
    element = document.querySelector(element)
  }
  if (!element || !element.offsetParent) {
    element = undefined
  }
  if (step !== undefined) {
    driverObj.drive(step)
  } else {
    driverObj.highlight({
      element,
      popover: {
        title: popover.title,
        description: popover.description,
        side: popover.side
      }
    })
  }

  return driverObj
}

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50X2lkIjoxLCJjb2RlIjoiMjQ2NzgiLCJhZG1pbiI6MSwiZXhwaXJlX3RpbWUiOjB9.G-YaphxirG6zJ9EGeHdb-70qpBQEY-199E-nvtua06k'

const presets = {
  no: '{"last_node_id":0,"last_link_id":0,"nodes":[],"links":[],"groups":[],"config":{},"extra":{"ds":{"scale":1,"offset":[0,0]}},"version":0.4}',
  default: `{"last_node_id":13,"last_link_id":31,"nodes":[{"id":9,"type":"Input_Node","pos":[-51.22222900390625,244.55557250976562],"size":[211.60000610351562,118],"flags":{},"order":0,"mode":0,"inputs":[{"name":"Dynamic Scan","type":"IMAGE","link":null,"localized_name":"Dynamic Scan"},{"name":"B1 Map","type":"IMAGE","link":null,"localized_name":"B1 Map"},{"name":"Dictionary","type":"DICT","link":null,"localized_name":"Dictionary"}],"outputs":[{"name":"Dynamic Scan","type":"IMAGE","links":[14],"slot_index":0,"shape":3,"localized_name":"Dynamic Scan"},{"name":"B1 Map","type":"IMAGE","links":[24],"slot_index":1,"shape":3,"localized_name":"B1 Map"},{"name":"Dictionary","type":"DICT","links":[25],"slot_index":2,"shape":3,"localized_name":"Dictionary"},{"name":"TSL","type":"FLOAT","links":[31],"localized_name":"TSL","slot_index":3}],"properties":{"Node name for S&R":"Input_Node"},"widgets_values":[],"pmt_fields":{"type":"Input_Node","plugin_name":"input","function_name":null,"inputs":[{},{},{}],"args":{},"outputs":[{"oid":[],"path":[]},{"oid":[],"path":[]},{"oid":[],"path":[]},{"oid":[],"path":[]}],"status":"pending"}},{"id":6,"type":"Image_Quality_Control","pos":[192.44451904296875,83.99998474121094],"size":[220,46],"flags":{},"order":1,"mode":0,"inputs":[{"name":"Dynamic Scan","type":"IMAGE","link":14,"localized_name":"Dynamic Scan"}],"outputs":[{"name":"Dynamic Scan","type":"IMAGE","links":[3],"slot_index":0,"shape":3,"localized_name":"Dynamic Scan"},{"name":"Image Quality","type":"DICT","links":[13],"slot_index":1,"shape":3,"localized_name":"Image Quality"}],"properties":{"Node name for S&R":"Image_Quality_Control"},"widgets_values":[],"pmt_fields":{"type":"Image_Quality_Control","plugin_name":"quality","function_name":null,"inputs":[{}],"args":{},"outputs":[{"oid":[],"path":[]},{"oid":[],"path":[]}],"status":"pending"}},{"id":1,"type":"Dynamic_Scan_Validator","pos":[478.22222900390625,77.33338928222656],"size":[211.60000610351562,26],"flags":{},"order":2,"mode":0,"inputs":[{"name":"Dynamic Scan","type":"IMAGE","link":3,"localized_name":"Dynamic Scan"}],"outputs":[{"name":"Complex Data","type":"IMAGE","links":[4],"slot_index":0,"shape":3,"localized_name":"Complex Data"}],"properties":{"Node name for S&R":"Dynamic_Scan_Validator"},"widgets_values":[],"pmt_fields":{"type":"Dynamic_Scan_Validator","plugin_name":"validator","function_name":null,"inputs":[{}],"args":{},"outputs":[{"oid":[],"path":[]}],"status":"pending"}},{"id":2,"type":"Phase_Map_Calculator","pos":[741.2222900390625,82.11111450195312],"size":[270.3999938964844,66],"flags":{},"order":3,"mode":0,"inputs":[{"name":"Complex Data","type":"IMAGE","link":4,"localized_name":"Complex Data"}],"outputs":[{"name":"Phase Map","type":"IMAGE","links":null,"slot_index":0,"shape":3,"localized_name":"Phase Map"},{"name":"Phase Mask","type":"IMAGE","links":[30],"shape":3,"localized_name":"Phase Mask","slot_index":1},{"name":"Complex Data","type":"IMAGE","links":[5,27],"slot_index":2,"shape":3,"localized_name":"Complex Data"}],"properties":{"Node name for S&R":"Phase_Map_Calculator"},"widgets_values":[],"pmt_fields":{"type":"Phase_Map_Calculator","plugin_name":"calculator","function_name":null,"inputs":[{}],"args":{},"outputs":[{"oid":[],"path":[]},{"oid":[],"path":[]},{"oid":[],"path":[]}],"status":"pending"}},{"id":3,"type":"RMPFSL_Calculator","pos":[1127.3333740234375,75],"size":[220,26],"flags":{},"order":4,"mode":0,"inputs":[{"name":"Complex Data","type":"IMAGE","link":5,"localized_name":"Complex Data"}],"outputs":[{"name":"Rmpfsl Result","type":"IMAGE","links":[7,17],"slot_index":0,"shape":3,"localized_name":"Rmpfsl Result"}],"properties":{"Node name for S&R":"RMPFSL_Calculator"},"widgets_values":[],"pmt_fields":{"type":"RMPFSL_Calculator","plugin_name":"calculator","function_name":null,"inputs":[{}],"args":{},"outputs":[{"oid":[],"path":[]}],"status":"pending"}},{"id":13,"type":"MPF_Calculator","pos":[1003,426],"size":[210,98],"flags":{},"order":5,"mode":0,"inputs":[{"name":"Complex Data","type":"IMAGE","link":27,"localized_name":"Complex Data"},{"name":"B1 Map","type":"IMAGE","link":24,"localized_name":"B1 Map"},{"name":"Dictionary","type":"DICT","link":25,"localized_name":"Dictionary"},{"name":"TSL","type":"FLOAT","link":31,"widget":{"name":"TSL"}}],"outputs":[{"name":"MPF Result","type":"IMAGE","links":[28,29],"slot_index":0,"shape":3,"localized_name":"MPF Result"}],"properties":{"Node name for S&R":"MPF_Calculator"},"widgets_values":[0.1],"pmt_fields":{"type":"MPF_Calculator","plugin_name":"calculator","function_name":null,"inputs":[{},{},{},{}],"args":{},"outputs":[{"oid":[],"path":[]}],"status":"pending"}},{"id":10,"type":"Generate_ROI_Mask","pos":[1360.333251953125,405.3333435058594],"size":[186.39999389648438,46],"flags":{},"order":6,"mode":0,"inputs":[{"name":"Rmpfsl Result","type":"IMAGE","link":17,"localized_name":"Rmpfsl Result"},{"name":"MPF Result","type":"IMAGE","link":28,"localized_name":"MPF Result"}],"outputs":[{"name":"ROI Mask","type":"MASK","links":[19],"slot_index":0,"shape":3,"localized_name":"ROI Mask"}],"properties":{"Node name for S&R":"Generate_ROI_Mask"},"widgets_values":[],"pmt_fields":{"type":"Generate_ROI_Mask","plugin_name":"roi","function_name":null,"inputs":[{},{}],"args":{},"outputs":[{"oid":[],"path":[]}],"status":"pending"}},{"id":5,"type":"ROI_Analyzer","pos":[1577,131],"size":[253.60000610351562,86],"flags":{},"order":7,"mode":0,"inputs":[{"name":"Rmpfsl Result","type":"IMAGE","link":7,"localized_name":"Rmpfsl Result"},{"name":"MPF Result","type":"IMAGE","link":29,"localized_name":"MPF Result"},{"name":"ROI Mask","type":"MASK","link":19,"localized_name":"ROI Mask"},{"name":"Phase Mask","type":"IMAGE","link":30,"localized_name":"Phase Mask"}],"outputs":[{"name":"Rmpfsl Histogram","type":"IMAGE","links":[9],"slot_index":0,"shape":3,"localized_name":"Rmpfsl Histogram"},{"name":"MPF Histogram","type":"IMAGE","links":[10],"slot_index":1,"shape":3,"localized_name":"MPF Histogram"},{"name":"Rmpfsl Statistic","type":"DICT","links":[11],"slot_index":2,"shape":3,"localized_name":"Rmpfsl Statistic"},{"name":"MPF Statistic","type":"DICT","links":[12],"slot_index":3,"shape":3,"localized_name":"MPF Statistic"}],"properties":{"Node name for S&R":"ROI_Analyzer"},"widgets_values":[],"pmt_fields":{"type":"ROI_Analyzer","plugin_name":"analyzer","function_name":null,"inputs":[{},{},{},{}],"args":{},"outputs":[{"oid":[],"path":[]},{"oid":[],"path":[]},{"oid":[],"path":[]},{"oid":[],"path":[]}],"status":"pending"}},{"id":7,"type":"MPF_Report","pos":[1975.888916015625,293.3333435058594],"size":[270.3999938964844,106],"flags":{},"order":8,"mode":0,"inputs":[{"name":"Rmpfsl Histogram","type":"IMAGE","link":9,"localized_name":"Rmpfsl Histogram"},{"name":"MPF Histogram","type":"IMAGE","link":10,"localized_name":"MPF Histogram"},{"name":"Rmpfsl Statistic","type":"DICT","link":11,"localized_name":"Rmpfsl Statistic"},{"name":"MPF Statistic","type":"DICT","link":12,"localized_name":"MPF Statistic"},{"name":"Image Quality","type":"DICT","link":13,"localized_name":"Image Quality"}],"outputs":[{"name":"Analysis Report","type":"DICT","links":null,"shape":3,"localized_name":"Analysis Report"}],"properties":{"Node name for S&R":"MPF_Report"},"widgets_values":[],"pmt_fields":{"type":"MPF_Report","plugin_name":"report","function_name":null,"inputs":[{},{},{},{},{}],"args":{},"outputs":[{"oid":[],"path":[]}],"status":"pending"}}],"links":[[3,6,0,1,0,"IMAGE"],[4,1,0,2,0,"IMAGE"],[5,2,2,3,0,"IMAGE"],[7,3,0,5,0,"IMAGE"],[9,5,0,7,0,"IMAGE"],[10,5,1,7,1,"IMAGE"],[11,5,2,7,2,"DICT"],[12,5,3,7,3,"DICT"],[13,6,1,7,4,"DICT"],[14,9,0,6,0,"IMAGE"],[17,3,0,10,0,"IMAGE"],[19,10,0,5,2,"MASK"],[24,9,1,13,1,"IMAGE"],[25,9,2,13,2,"DICT"],[27,2,2,13,0,"IMAGE"],[28,13,0,10,1,"IMAGE"],[29,13,0,5,1,"IMAGE"],[30,2,1,5,3,"IMAGE"],[31,9,3,13,3,"FLOAT"]],"groups":[],"config":{},"extra":{"ds":{"scale":1,"offset":[-158.22216796875,124.4443359375]}},"version":0.4}`,
  smooth: `{
  "last_node_id": 7,
  "last_link_id": 6,
  "nodes": [
    {
      "id": 1,
      "type": "input.load_dicom",
      "pos": [
        60.95134735107422,
        207.33335876464844
      ],
      "size": [
        315,
        58
      ],
      "flags": {},
      "order": 0,
      "mode": 0,
      "inputs": [],
      "outputs": [
        {
          "name": "DICOM_FILE",
          "type": "DICOM_FILE",
          "links": [
            1
          ],
          "slot_index": 0,
          "localized_name": "DICOM_FILE"
        }
      ],
      "properties": {
        "Node name for S&R": "input.load_dicom"
      },
      "widgets_values": [
        "5635780f-64565673-9b29cf17-d39808a3-29710ad3"
      ],
      "pmt_fields": {
        "type": "input",
        "plugin_name": null,
        "function_name": null,
        "inputs": [],
        "args": {
          "oid": "5635780f-64565673-9b29cf17-d39808a3-29710ad3"
        },
        "outputs": [
          {
            "oid": "5635780f-64565673-9b29cf17-d39808a3-29710ad3",
            "path": "E:\\Code\\PWH_Volunteer_Analysis\\Sample\\MPF\\MPF.dcm",
            "value": "E:\\Code\\PWH_Volunteer_Analysis\\Sample\\MPF\\MPF.dcm"
          }
        ],
        "status": ""
      }
    },
    {
      "id": 2,
      "type": "converter.file_to_data.dicom_to_2d",
      "pos": [
        422.8067626953125,
        249.34979248046875
      ],
      "size": [
        210,
        26
      ],
      "flags": {},
      "order": 1,
      "mode": 0,
      "inputs": [
        {
          "link": 1,
          "name": "DICOM_FILE",
          "type": "DICOM_FILE",
          "localized_name": "DICOM_FILE"
        }
      ],
      "outputs": [
        {
          "name": "data",
          "type": "2D",
          "links": [
            2
          ],
          "slot_index": 0,
          "localized_name": "data"
        }
      ],
      "properties": {
        "Node name for S&R": "converter.file_to_data.dicom_to_2d"
      },
      "widgets_values": [],
      "pmt_fields": {
        "type": "converter",
        "plugin_name": "file_to_data",
        "function_name": "dicom_to_2d",
        "inputs": [
          {
            "optional": false
          }
        ],
        "args": {},
        "outputs": [
          {
            "oid": null,
            "path": null,
            "value": null
          }
        ],
        "status": "pending"
      }
    },
    {
      "id": 3,
      "type": "plugin.smooth.smooth_2d",
      "pos": [
        681.537109375,
        227.4853515625
      ],
      "size": [
        315,
        78
      ],
      "flags": {},
      "order": 2,
      "mode": 0,
      "inputs": [
        {
          "link": 2,
          "name": "data",
          "type": "2D",
          "localized_name": "data"
        }
      ],
      "outputs": [
        {
          "name": "data",
          "type": "2D",
          "links": [
            3,
            4
          ],
          "slot_index": 0,
          "localized_name": "data"
        },
        {
          "name": "test_txt",
          "type": "STRING",
          "links": null,
          "localized_name": "test_txt"
        }
      ],
      "properties": {
        "Node name for S&R": "plugin.smooth.smooth_2d"
      },
      "widgets_values": [
        4
      ],
      "pmt_fields": {
        "type": "plugin",
        "plugin_name": "smooth",
        "function_name": "smooth_2d",
        "inputs": [
          {
            "optional": false
          }
        ],
        "args": {
          "sigma": 4
        },
        "outputs": [
          {
            "oid": null,
            "path": null,
            "value": null
          },
          {
            "oid": null,
            "path": null,
            "value": null
          }
        ],
        "status": "pending"
      }
    },
    {
      "id": 5,
      "type": "converter.data_to_file.2d_to_dicom",
      "pos": [
        1055.71875,
        305.19781494140625
      ],
      "size": [
        210,
        26
      ],
      "flags": {},
      "order": 3,
      "mode": 0,
      "inputs": [
        {
          "link": 3,
          "name": "data",
          "type": "2D",
          "localized_name": "data"
        }
      ],
      "outputs": [
        {
          "name": "DICOM_FILE",
          "type": "DICOM_FILE",
          "links": [
            6
          ],
          "slot_index": 0,
          "localized_name": "DICOM_FILE"
        }
      ],
      "properties": {
        "Node name for S&R": "converter.data_to_file.2d_to_dicom"
      },
      "widgets_values": [],
      "pmt_fields": {
        "type": "converter",
        "plugin_name": "data_to_file",
        "function_name": "2d_to_dicom",
        "inputs": [
          {
            "optional": false
          }
        ],
        "args": {},
        "outputs": [
          {
            "oid": null,
            "path": null,
            "value": null
          }
        ],
        "status": "pending"
      }
    },
    {
      "id": 4,
      "type": "converter.data_to_file.2d_to_image",
      "pos": [
        1128.01904296875,
        140.12298583984375
      ],
      "size": [
        315,
        82
      ],
      "flags": {},
      "order": 4,
      "mode": 0,
      "inputs": [
        {
          "link": 4,
          "name": "data",
          "type": "2D",
          "localized_name": "data"
        }
      ],
      "outputs": [
        {
          "name": "IMAGE_FILE",
          "type": "IMAGE_FILE",
          "links": [
            5
          ],
          "slot_index": 0,
          "localized_name": "IMAGE_FILE"
        }
      ],
      "properties": {
        "Node name for S&R": "converter.data_to_file.2d_to_image"
      },
      "widgets_values": [
        "png",
        true
      ],
      "pmt_fields": {
        "type": "converter",
        "plugin_name": "data_to_file",
        "function_name": "2d_to_image",
        "inputs": [
          {
            "optional": false
          }
        ],
        "args": {
          "format": "png",
          "normalize": true
        },
        "outputs": [
          {
            "oid": null,
            "path": null,
            "value": null
          }
        ],
        "status": "pending"
      }
    },
    {
      "id": 7,
      "type": "output.export",
      "pos": [
        1317.01708984375,
        363.1414794921875
      ],
      "size": [
        152.8000030517578,
        86
      ],
      "flags": {},
      "order": 5,
      "mode": 0,
      "inputs": [
        {
          "link": null,
          "name": "IMAGE_FILE",
          "type": "IMAGE_FILE",
          "shape": 7,
          "localized_name": "IMAGE_FILE"
        },
        {
          "link": 6,
          "name": "DICOM_FILE",
          "type": "DICOM_FILE",
          "shape": 7,
          "localized_name": "DICOM_FILE"
        },
        {
          "link": null,
          "name": "DICOM_VOLUME_FILE",
          "type": "DICOM_VOLUME_FILE",
          "shape": 7,
          "localized_name": "DICOM_VOLUME_FILE"
        },
        {
          "link": null,
          "name": "NIFTI_FILE",
          "type": "NIFTI_FILE",
          "shape": 7,
          "localized_name": "NIFTI_FILE"
        }
      ],
      "outputs": [],
      "properties": {
        "Node name for S&R": "output.export"
      },
      "widgets_values": [],
      "pmt_fields": {
        "type": "output",
        "plugin_name": "output",
        "function_name": "export",
        "inputs": [
          {
            "optional": true
          },
          {
            "optional": true
          },
          {
            "optional": true
          },
          {
            "optional": true
          }
        ],
        "args": {},
        "outputs": [],
        "status": "pending"
      }
    },
    {
      "id": 6,
      "type": "preview.volview",
      "pos": [
        1526.077880859375,
        199.8821563720703
      ],
      "size": [
        152.8000030517578,
        86
      ],
      "flags": {},
      "order": 6,
      "mode": 0,
      "inputs": [
        {
          "link": 5,
          "name": "IMAGE_FILE",
          "type": "IMAGE_FILE",
          "shape": 7,
          "localized_name": "IMAGE_FILE"
        },
        {
          "link": null,
          "name": "DICOM_FILE",
          "type": "DICOM_FILE",
          "shape": 7,
          "localized_name": "DICOM_FILE"
        },
        {
          "link": null,
          "name": "DICOM_VOLUME_FILE",
          "type": "DICOM_VOLUME_FILE",
          "shape": 7,
          "localized_name": "DICOM_VOLUME_FILE"
        },
        {
          "link": null,
          "name": "NIFTI_FILE",
          "type": "NIFTI_FILE",
          "shape": 7,
          "localized_name": "NIFTI_FILE"
        }
      ],
      "outputs": [],
      "properties": {
        "Node name for S&R": "preview.volview"
      },
      "widgets_values": [],
      "pmt_fields": {
        "type": "preview",
        "plugin_name": "preview",
        "function_name": "volview",
        "inputs": [
          {
            "optional": true
          },
          {
            "optional": true
          },
          {
            "optional": true
          },
          {
            "optional": true
          }
        ],
        "args": {},
        "outputs": [],
        "status": "pending"
      }
    }
  ],
  "links": [
    [
      1,
      1,
      0,
      2,
      0,
      "DICOM_FILE"
    ],
    [
      2,
      2,
      0,
      3,
      0,
      "2D"
    ],
    [
      3,
      3,
      0,
      5,
      0,
      "2D"
    ],
    [
      4,
      3,
      0,
      4,
      0,
      "2D"
    ],
    [
      5,
      4,
      0,
      6,
      0,
      "IMAGE_FILE"
    ],
    [
      6,
      5,
      0,
      7,
      1,
      "DICOM_FILE"
    ]
  ],
  "groups": [],
  "config": {},
  "extra": {
    "ds": {
      "scale": 1,
      "offset": [
        0,
        0
      ]
    }
  },
  "version": 0.4
}`
}

const terminal = Object.create(null)
const showTerminal = ref(false)
const toggleTerminal = (val) => {
  if (typeof val === 'boolean') {
    showTerminal.value = val
  } else {
    showTerminal.value = !showTerminal.value
  }
}

onMounted(() => {
  addPipelineEventListeners()
  if (loading.value) {
    getPipeline({ ...pipeline.value })
  }

  Object.keys(SYSTEM_NODE_DEFS).forEach((type) => {
    LiteGraph.unregisterNodeType(type)
  })
  // LiteGraph.unregisterNodeType('input.load_image')

  const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions
  LGraphCanvas.prototype.getCanvasMenuOptions = function () {
    const options = getCanvasMenuOptions.apply(this, arguments)
    if (options) {
      const [add_node, ...rest] = options
      const new_options = [add_node]
      new_options.push(
        null, // inserts a divider
        {
          content: 'Reset All Nodes',
          callback: async () => {
            comfyApp.graph.nodes.forEach(resetNodeStatus)
          }
        },
        {
          content: 'Refresh Node Definitions',
          callback: async () => {
            await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
            workflowService.reloadCurrentWorkflow()
          }
        },
        {
          content: 'Clear Workflow',
          callback: async () => {
            await useCommandStore().execute('Comfy.ClearWorkflow')
          }
        }
      )
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
          const nodeIds = []
          try {
            const { json } = exportJson(false)
            const formData = {
              id: pipeline.value.id,
              workflow: JSON.stringify(json),
              nodeId: node.id
            }
            // console.log(formData)
            const res = await fetch(
              'connect://localhost/api/pipelines/reset-pipeline-nodes-from-node-id',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
              }
            )
            if (res?.nodeIds) {
              nodeIds.push(...res.nodeIds)
            }
          } catch (err) {
            console.error(err)
          }
          nodeIds.forEach((nodeId) => {
            const node = comfyApp.graph.getNodeById(nodeId)
            if (node) {
              resetNodeStatus(node)
            }
          })
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
      const _onMouseEnter = node.onMouseEnter
      node.onMouseEnter = function (e) {
        // ...
        return _onMouseEnter?.apply(this, arguments)
      }
      const _onMouseLeave = node.onMouseLeave
      node.onMouseLeave = function (e) {
        // ...
        return _onMouseLeave?.apply(this, arguments)
      }
      const _onMouseDown = node.onMouseDown
      node.onMouseDown = function (e, pos, canvas) {
        // ...
        return _onMouseDown?.apply(this, arguments)
      }
      const _onDblClick = node.onDblClick
      node.onDblClick = function (e, pos, canvas) {
        // ...
        return _onDblClick?.apply(this, arguments)
      }
      const _onDrawBackground = node.onDrawBackground
      node.onDrawBackground = function (
        ctx,
        canvas,
        canvasElement,
        mousePosition
      ) {
        // ...
        updateNodesSelected()
        return _onDrawBackground?.apply(this, arguments)
      }

      if (
        node?.widgets?.findIndex((w) => {
          return w.type === 'customtext' && w.inputEl?.type === 'textarea'
        }) !== -1
      ) {
        requestAnimationFrame(() => {
          node.setSize([...node.size])
          node.setDirtyCanvas(true)
        })
      }
      /*
      if (node?.comfyClass === 'preview.volview') {
        const div = document.createElement('div')
        div.classList.add('relative', 'overflow-hidden')
        div.innerHTML = `
          <div class="absolute inset-0 overflow-hidden">
            <iframe src="${volViewUrl.value}" frameborder="0" width="100%" height="100%"></iframe>
          </div>
        `
        const widget = node.addDOMWidget('preview_volview', 'preview-volview', div, {})
        console.log(volViewUrl.value, widget)
        console.log(node.widgets)
      }
      */
      if (node?.comfyClass.startsWith('rag_llm.prompt')) {
        const prompt_template_vars = {}
        const findVars = (text) => {
          const regex = /\{([^}]+)\}/g
          const matches = []
          let match
          while ((match = regex.exec(text)) !== null) {
            if (!matches.includes(match[1])) {
              matches.push(match[1])
            }
          }
          return matches
        }
        const ul = document.createElement('ul')
        ul.classList.add(
          'relative',
          'overflow-auto',
          'flex',
          'flex-col',
          'p-0',
          'm-0',
          'text-xs'
        )
        const updateVarList = () => {
          ul.innerHTML = ''
          const longestVarNameLength = Math.max(
            ...Object.values(prompt_template_vars)
              .flat()
              .map((v) => v.length)
          )
          Object.values(prompt_template_vars).forEach((vars) => {
            vars.forEach((v) => {
              const li = document.createElement('li')
              li.classList.add('mb-2')
              li.innerHTML = `
                <label class="flex items-center">
                  <span style="min-width: ${longestVarNameLength + 2}ch">${v}:</span>
                  <input name="${v}" class="ml-1 flex-auto outline-0 border-b border-transparent focus:border-b-white bg-neutral-800" />
                </label>
              `
              ul.appendChild(li)
            })
          })
        }
        await new Promise((r) => setTimeout(r, 60))
        node.widgets.forEach((w) => {
          if (w.type === 'customtext' && w.inputEl?.type === 'textarea') {
            w.inputEl.oninput = (e) => {
              prompt_template_vars[w.name] = findVars(e.target.value)
              updateVarList()
            }
            prompt_template_vars[w.name] = findVars(w.inputEl.value)
            updateVarList()
          }
          if (w.name === 'type') {
            const cb = w.callback
            w.callback = function (value, canvas, node, pos, e) {
              if (value !== 'hub') {
                const hubLinkWidget = node.widgets.find((w) => {
                  return w.name === 'hub_link'
                })
                if (hubLinkWidget) {
                  hubLinkWidget.value = ''
                }
              }
              if (cb) {
                return cb.apply(this, arguments)
              }
            }
          }
          if (w.name === 'hub_link') {
            const cb = w.callback
            w.callback = function (value, canvas, node, pos, e) {
              const typeWidget = node.widgets.find((w) => {
                return w.name === 'type'
              })
              const systemPromptWidget = node.widgets.find((w) => {
                return w.name === 'system'
              })
              const hub_link = value
              if (
                hub_link &&
                typeWidget.value === 'hub' &&
                systemPromptWidget?.inputEl
              ) {
                console.log('getting hub prompt...', { hub_link })
                fetch('https://www.chather.top/api/get_hub_prompt', {
                  method: 'POST',
                  headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ hub_link })
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data?.status === 'ok') {
                      systemPromptWidget.value = data.data || ''
                      prompt_template_vars[systemPromptWidget.name] = findVars(
                        systemPromptWidget.value
                      )
                      updateVarList()
                      console.log(data.data)
                    } else if (data?.status === 'error' && data.message) {
                      alert(data.message)
                    } else {
                      console.error(data)
                    }
                  })
                  .catch((err) => {
                    console.error(err)
                  })
              }
              if (cb) {
                return cb.apply(this, arguments)
              }
            }
          }
        })
        const widget = node.addDOMWidget(
          'prompt_template_vars',
          'prompt-template-vars',
          ul,
          {}
        )

        if (Object.keys(prompt_template_vars).length > 1) {
          requestAnimationFrame(() => {
            node.setSize([node.size[0], node.size[1] + 100])
            node.setDirtyCanvas(true)
          })
        }
      }
      if (node?.comfyClass === 'rag_llm.preview_text') {
        if (node.size[1] < 200) {
          requestAnimationFrame(() => {
            node.setSize([node.size[0], node.size[1] + 100])
            node.setDirtyCanvas(true)
          })
        }
        const div = document.createElement('div')
        div.classList.add('relative', 'overflow-hidden')
        div.innerHTML = `
          <div class="absolute inset-0 overflow-hidden flex flex-col" x-data="{ open: true }">
            <button class="uppercase mb-2" @click="open = !open" x-text="open ? ${"'Hide'"} : ${"'Show'"}"></button>
            <textarea x-show="open" class="w-full h-full resize-none border-none bg-neutral-800 text-xs" placeholder="" readonly></textarea>
          </div>
        `
        const widget = node.addDOMWidget(
          'llm_preview_text',
          'llm-preview-text',
          div,
          {}
        )
      }
    }
  })

  comfyApp.canvasEl.addEventListener('drop', onDrop)

  if (pipelineId) {
    // console.log('saved pipelines:', pipelines.value)
  } else if (workflow_name && workflow_name in presets) {
    comfyApp.graph.configure(JSON.parse(presets[workflow_name]))
  } else {
    comfyApp.graph.configure(
      JSON.parse(sessionStorage.getItem('workflow') || presets.default)
    )
  }

  if (window.MessagePack) {
    decodeMultiStream = window.MessagePack.decodeMultiStream
  }

  window['driverObjs'] = []
  window['driverHighlight'] = (...args) => {
    window.driverObjs.push(highlight(...args))
    return window.driverObjs
  }
  window.__session_id__ = `${Date.now()}`

  if (window.Terminal) {
    const Terminal = window.Terminal
    const FitAddon = window.FitAddon.FitAddon

    const term = new Terminal()
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(document.getElementById('terminal'))
    fitAddon.fit()

    // term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m')
    // term.write('\r\n')
    // term.write('$ ping\r\n')
    // term.write('PONG\r\n')
    // term.write('$ ')

    terminal.term = term
    terminal.fitAddon = fitAddon
    window.$terminal = terminal
  }
})

onUnmounted(() => {
  removePipelineEventListeners()

  comfyApp.canvasEl.removeEventListener('drop', onDrop)

  if (window.driverObjs?.length) {
    window.driverObjs.forEach((driverObj, i, arr) => {
      driverObj.destroy()
      arr.splice(i, 1)
    })
  }
})

function onDrop(e) {
  console.log('Drop:', JSON.parse(e.dataTransfer.getData('text') || 'null'))
  // ...

  e.preventDefault()
}

const toast = useToast()
const confirm = useConfirm()

const runMenu = ref()
const runMenuItems = computed(() => [
  {
    label: 'Run',
    icon: 'pi pi-play',
    class: 'text-sm',
    disabled: false,
    command: () => {
      run(null, 'complete')
    }
  },
  {
    label: 'Run (one step)',
    icon: 'pi pi-step-forward',
    class: 'text-sm',
    disabled: false,
    command: () => {
      run(null, 'one-step')
    }
  },
  {
    label: 'Run (to node)',
    icon: 'pi pi-fast-forward',
    class: 'text-sm',
    disabled: nodesSelectedCount.value !== 1,
    command: () => {
      run(null, 'to-node')
    }
  }
])

const pipOver = ref()
function togglePipOver(e) {
  pipelineName.value = pipeline.value.name
  pipelineDescription.value = pipeline.value.description
  pipelineColor.value = pipeline.value.color
  pipOver.value.toggle(e)
}

function resetNodeStatus(node) {
  if (node?.pmt_fields) {
    delete node.pmt_fields
    if (node.pmt_fields?.status) {
      node.pmt_fields.status = 'pending'
    }
    node.setDirtyCanvas(true)
  }
}

const running = ref(false)
const runningMode = ref('complete')
async function run(e, mode = 'complete') {
  if (runMenu.value) {
    runMenu.value.hide(e)
  }
  if (running.value) {
    return
  }
  running.value = true
  runningMode.value = mode

  // if (!pipelineId) {
  //   const { langchain_json } = exportJson(false)
  //   const answers = await langchainChat(langchain_json)
  //   console.log(answers)
  // } else {
  const { json } = exportJson(false)
  const formData = {
    id: 1,
    workflow: JSON.stringify(json),
    mode: runningMode.value
  }
  console.log(formData)
  return fetch('http://localhost:5000/pipelines/run-once', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })
    .then(async (res) => {
      // console.log("Res:", res);
      // for await (const chunk of decodeMultiStream(res.body)) {
      //   console.log(res.body)
      //   // console.log(chunk)
      //     if (chunk?.id === pipelineId) {
      //       const { pythonMsg, graphJson } = chunk
      //       const msg = pythonMsg?.msg || ''
      //       const results = []
      //       if (graphJson) {
      //         graphJson.forEach(({ id, pmtFields: pmt_fields }) => {
      //           if (pmt_fields) {
      //             const result = { id, pmt_fields: JSON.parse(pmt_fields) }
      //             const node = comfyApp.graph.getNodeById(id)
      //             if (node && node.pmt_fields) {
      //               if (result.pmt_fields.outputs) {
      //                 console.log(result.pmt_fields)
      //                 result.pmt_fields.outputs.forEach((output, o) => {
      //                   const { name, type, oid, path, value } = output
      //                   if (oid) {
      //                     node.pmt_fields.outputs[o].oid = Array.isArray(
      //                       node.pmt_fields.outputs[o].oid
      //                     )
      //                       ? [oid]
      //                       : oid
      //                   }
      //                   if (path) {
      //                     node.pmt_fields.outputs[o].path = Array.isArray(
      //                       node.pmt_fields.outputs[o].path
      //                     )
      //                       ? [path]
      //                       : path
      //                   }
      //                   if (value) {
      //                     node.pmt_fields.outputs[o].value = Array.isArray(
      //                       node.pmt_fields.outputs[o].value
      //                     )
      //                       ? [value]
      //                       : value
      //                   }
      //                 })
      //               }
      //               if (result.pmt_fields.status) {
      //                 node.pmt_fields.status = result.pmt_fields.status
      //               }
      //               node.setDirtyCanvas(true)
      //               return
      //             }
      //             results.push(result)
      //           }
      //         })
      //       }
      //       if (msg) {
      //         terminal.term.write(msg + (msg.endsWith('\r') ? '\n' : ''))
      //         console.log(msg, results.length > 0 ? results : '')
      //       }
      //     }
      //   }
      //   console.log('[DONE]')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          console.log('[Stream completed]')
          break
        }

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const chunk = JSON.parse(line)

            if (chunk?.id === 1) {
              const { pythonMsg, graphJson } = chunk

              if (pythonMsg?.msg) {
                terminal.term.write(pythonMsg.msg.trim() + '\n')
                // terminal.term.write(pythonMsg.msg + '\n');
                console.log('Message:', pythonMsg.msg)
              }

              if (graphJson) {
                graphJson.forEach(({ id, pmtFields }) => {
                  const node = comfyApp.graph.getNodeById(id)
                  if (node && node.pmt_fields) {
                    if (pmtFields.outputs) {
                      pmtFields.outputs.forEach((output, index) => {
                        if (output.oid) {
                          node.pmt_fields.outputs[index].oid = Array.isArray(
                            node.pmt_fields.outputs[index].oid
                          )
                            ? [output.oid]
                            : output.oid
                        }
                        if (output.path) {
                          node.pmt_fields.outputs[index].path = Array.isArray(
                            node.pmt_fields.outputs[index].path
                          )
                            ? [output.path]
                            : output.path
                        }
                        if (output.value) {
                          node.pmt_fields.outputs[index].value = Array.isArray(
                            node.pmt_fields.outputs[index].value
                          )
                            ? [output.value]
                            : output.value
                        }
                      })
                    }

                    // 更新状态
                    if (pmtFields.status) {
                      node.pmt_fields.status = pmtFields.status
                    }

                    node.setDirtyCanvas(true)
                  }
                })
              }
            }
          } catch (error) {
            console.error('Error parsing chunk:', error, line)
          }
        }
      }
    })
    .catch((err) => {
      console.error(err)
    })
    .finally(() => {
      running.value = false
    })
  // }
  // const nodeData = getWorkflowJson()
  // console.log(nodeData)

  // const nodes = [...nodeData.nodes]
  // nodes.sort((a, b) => a.order - b.order)
  // console.log('开始执行工作流, 共有节点数:', nodes.length)

  // for (const node of nodes) {
  //   console.log('执行节点:', {
  //     name: node.type,
  //     inputs: node.inputs?.map(input => ({
  //       name: input.name,
  //       type: input.type,
  //       link: input.link
  //     })) || [],
  //     outputs: node.outputs?.map(output => ({
  //       name: output.name,
  //       type: output.type,
  //       links: output.links
  //     })) || []
  //   })

  //   switch(node.type) {
  //     case 'Input_Node':
  //       await handleInputNode(node)
  //       break
  //     case 'Image_Quality_Control':
  //       await handleQualityControl(node)
  //       break
  //     case 'Dynamic_Scan_Validator':
  //       await handleValidator(node)
  //       break
  //     case 'Phase_Map_Calculator':
  //       await handlePhaseMap(node)
  //       break
  //     case 'RMPFSL_Calculator':
  //       await handleRMPFSL(node)
  //       break
  //     case 'MPF_Calculator':
  //       await handleMPF(node)
  //       break
  //     case 'Generate_ROI_Mask':
  //       await handleROIMask(node)
  //       break
  //     case 'ROI_Analyzer':
  //       await handleROIAnalyzer(node)
  //       break
  //     case 'MPF_Report':
  //       await handleMPFReport(node)
  //       break
  //     default:
  //       console.log('未知节点类型:', node.type)
  //   }
  // }

  // running.value = false
  // runningMode.value = 'complete'
}

async function handleInputNode(node) {
  const uidData = {
    studyInstanceUID: '1.2.840.113619.2.182.1080861414283.1698302236.6278539',
    seriesInstanceUID: '1.3.46.670589.11.62044.5.0.11948.2023111014191779884'
  }

  window.parent.postMessage(
    {
      type: 'viewData',
      message: `处理输入节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: uidData,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  // TODO: 处理输入节点的具体逻辑
  console.log('[ComfyUI] 正在处理输入节点')
}

async function handleQualityControl(node) {
  const uidData = {
    studyInstanceUID: '1.2.840.113619.2.182.1080861414283.1698302236.6278539',
    seriesInstanceUID: '1.3.46.670589.11.62044.5.0.11948.2023111014191779884'
  }
  window.parent.postMessage(
    {
      type: 'ImageQuality_Assessment',
      message: `[ComfyUI] 处理图像质量核验节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: uidData,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  // TODO: 处理图像质量控制的具体逻辑
  console.log('[ComfyUI] 正在进行图像质量核验')
}

async function handleValidator(node) {
  window.parent.postMessage(
    {
      type: 'workflow_log',
      message: `处理验证节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在验证数据')
}

async function handlePhaseMap(node) {
  window.parent.postMessage(
    {
      type: 'workflow_log',
      message: `处理相位图计算节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在计算相位图')
}

async function handleRMPFSL(node) {
  const uidData = {
    studyInstanceUID: '1.2.840.113619.2.182.1080861414283.1698302236.6278539',
    seriesInstanceUID: '1.3.46.670589.11.62044.5.0.11948.2023111014191779884'
  }

  window.parent.postMessage(
    {
      type: 'view_RenderingData',
      message: `处理RMPFSL计算节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: uidData,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在进行RMPFSL计算')
}

async function handleMPF(node) {
  window.parent.postMessage(
    {
      type: 'workflow_log',
      message: `处理MPF计算节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在计算MPF')
}

async function handleROIMask(node) {
  const uidData = {
    studyInstanceUID: '1.2.840.113619.2.182.1080861414283.1698302236.6278539',
    seriesInstanceUID: '1.3.46.670589.11.62044.5.0.11948.2023111014191779884'
  }

  window.parent.postMessage(
    {
      type: 'ROI_Annotation',
      message: `处理RMPFSL计算节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: uidData,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在生成ROI MASK')
}

async function handleROIAnalyzer(node) {
  window.parent.postMessage(
    {
      type: 'workflow_log',
      message: ` 处理ROI分析节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在进行ROI分析')
}

async function handleMPFReport(node) {
  window.parent.postMessage(
    {
      type: 'workflow_log',
      message: `处理MPF报告节点:${node.type}`,
      data: {
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
        status: node.pmt_fields?.status
      }
    },
    '*'
  )

  console.log('[ComfyUI] 正在生成MPF报告')
}

const stoppable = ref(!!pipelineId)
const pausing = ref(false)
async function stop() {
  if (pausing.value || !running.value) {
    return
  }
  pausing.value = true
  console.log('stop!')
  // ...
  pausing.value = false
  running.value = false
}

const saving = ref(false)
async function save() {
  if (saving.value) {
    return
  }
  saving.value = true
  if (pipelineId) {
    let isValid = true
    try {
      const { json } = exportJson(false, false)
      const formData = {
        id: pipeline.value.id,
        workflow: JSON.stringify(json)
      }
      // console.log(formData)
      const res = await fetch(
        'connect://localhost/api/pipelines/validate-pipeline-graph-json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      )
      if (res?.result) {
        console.log('validate result:', JSON.parse(res.result))
        // ...
      }
    } catch (err) {
      console.error(err)
    }
    if (!isValid) {
      saving.value = false
      return
    }
    if (isNewPipeline.value) {
      createPipeline({
        ...pipeline.value,
        name: pipelineName.value,
        description: pipelineDescription.value,
        color: pipelineColor.value,
        workflow: getWorkflowJson(true, false)
      })
    } else {
      updatePipeline({
        ...pipeline.value,
        workflow: getWorkflowJson(true, false)
      })
    }
    return
  } else {
    const { json, langchain_json } = exportJson(false, false)
    let langchain = localStorage.getItem('langchain')
    if (langchain) {
      langchain = JSON.parse(langchain)
    } else {
      langchain = {}
    }
    langchain[langchain_json.workflow_name] = langchain_json
    localStorage.setItem('langchain', JSON.stringify(langchain))
    sessionStorage.setItem('workflow', JSON.stringify(json))
  }
  saving.value = false
  toast.add({
    severity: 'success',
    summary: 'Saved',
    detail: 'Changes have been saved!',
    life: 3000
  })
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

const deleting = ref(false)
const delBtn = ref()
const delBtnHovered = useElementHover(delBtn)
const confirmDelete = (e) => {
  confirm.require({
    group: 'confirm_deletion',
    header: 'Delete Confirmation',
    message: 'Do you want to delete this pipeline workflow?',
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
    accept: () => {
      if (!pipelineId) {
        return
      }
      deleting.value = true
      return deletePipeline({ id: pipeline.value.id })
    },
    reject: () => {}
  })
  togglePipOver(e)
}

function exportJson(download = true, keepStatus = true) {
  const json = getWorkflowJson(false, keepStatus)
  console.log(json)

  if (download) {
    const blob = new Blob([JSON.stringify(json, 2, null)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.download = 'workflow.json'
    a.click()
    return URL.revokeObjectURL(url)
  }

  if (pipelineId) {
    return { json }
  }

  const langchain_json_nodes = json.nodes.map(
    ({ id, type, pmt_fields: { args } }) => ({
      id,
      type,
      pmt_fields: {
        args
      }
    })
  )
  const prompt_node = langchain_json_nodes.find(
    ({ type }) => type === 'rag_llm.prompt'
  )
  const langchain_json = {
    workflow_name: workflow_name || 'default',
    langchain_json: langchain_json_nodes,
    inputs: prompt_node?.pmt_fields?.args?.prompt_template_vars || {},
    session_id: window.__session_id__
  }
  console.log(langchain_json)

  return { json, langchain_json }
}

function getWorkflowJson(stringify = false, keepStatus = true) {
  const workflow = comfyApp.graph.serialize()
  workflow.nodes.sort((a, b) => a.order - b.order)
  workflow.nodes.forEach(({ id, inputs, outputs }, i, nodes) => {
    const node = comfyApp.graph.getNodeById(id)
    const nodeDef = nodeDefStore.nodeDefsByName[node.type]
    const [type, subtype] = node.type.split('.')
    if (type === 'rag_llm') {
      const pmt_fields = {
        args: (node.widgets || []).reduce(
          (args, { type, name, value, element }) => {
            if (type !== 'converted-widget') {
              args[name] = value
            }
            if (type === 'prompt-template-vars') {
              args[name] = {}
              element?.querySelectorAll('li input').forEach((input) => {
                args[name][input.name] = input.value
              })
            }
            return args
          },
          {}
        ),
        status: ''
      }
      nodes[i].pmt_fields = pmt_fields
      return nodes[i]
    }
    const [_, plugin_name, function_name] = nodeDef.python_module.split('.')
    const pmt_fields = merge(node?.pmt_fields || {}, {
      type,
      plugin_name: plugin_name || null,
      function_name: function_name || null,
      inputs: (inputs || []).map((i) => {
        let optional = false
        const optionalInput = nodeDef.inputs.optional?.[i.name]
        if (optionalInput && optionalInput.type === i.type) {
          optional = true
        }
        return {
          optional
        }
      }),
      args: (node.widgets || []).reduce((args, { type, name, value }) => {
        if (type !== 'converted-widget') {
          args[name] = value
        }
        return args
      }, {}),
      outputs: (outputs || []).map((o) => {
        return {
          oid: [],
          path: [],
          value: []
        }
      }),
      status: ''
    })
    if (pmt_fields.type === 'input') {
      const oid = pmt_fields.args.oid || pmt_fields.args.source
      if (oid) {
        if (pmt_fields.outputs[0]?.oid) {
          pmt_fields.outputs[0].oid = [oid]
        }
        if (pmt_fields.outputs[0]?.path) {
          pmt_fields.outputs[0].path = [...(pmt_fields.outputs[0].path || [])]
          pmt_fields.outputs[0].value = [...(pmt_fields.outputs[0].value || [])]
        }
      }
      if (subtype === 'boolean') {
        pmt_fields.outputs[0] = {
          ...(pmt_fields.outputs[0] || {}),
          value: pmt_fields.args.bool
        }
      }
      if (subtype === 'int') {
        pmt_fields.outputs[0] = {
          ...(pmt_fields.outputs[0] || {}),
          value: pmt_fields.args.int
        }
      }
      if (subtype === 'float') {
        pmt_fields.outputs[0] = {
          ...(pmt_fields.outputs[0] || {}),
          value: pmt_fields.args.float
        }
      }
      if (subtype === 'text') {
        pmt_fields.outputs[0] = {
          ...(pmt_fields.outputs[0] || {}),
          value: pmt_fields.args.text
        }
      }
      if (subtype === 'textarea') {
        pmt_fields.outputs[0] = {
          ...(pmt_fields.outputs[0] || {}),
          value: pmt_fields.args.textarea
        }
      }
    } else {
      if (node.pmt_fields?.status) {
        pmt_fields.status = node.pmt_fields.status
      } else {
        pmt_fields.status = 'pending'
      }
    }
    if (pmt_fields.type === 'manual') {
      //
    }
    if (pmt_fields.type === 'plugin') {
      //
    }
    if (pmt_fields.type === 'converter') {
      //
    }
    if (pmt_fields.type === 'preview') {
      //
    }
    if (pmt_fields.type === 'output') {
      //
    }
    if (keepStatus) {
      if (runningMode.value === 'to-node') {
        if (nodesSelectedCount.value === 1) {
          if (node === nodesSelected.value[0]) {
            pmt_fields.status = 'current'
            node.setDirtyCanvas(true)
          }
        }
      }
    } else {
      pmt_fields.status = ''
    }
    nodes[i].pmt_fields = pmt_fields
    node.pmt_fields = nodes[i].pmt_fields
    node.setDirtyCanvas(true)
    return nodes[i]
  })
  if (stringify) {
    return JSON.stringify(workflow)
  }
  return JSON.parse(JSON.stringify(workflow))
}

// ---

function getPipeline(payload) {
  if (window.$electron) {
    window.$electron.ipcRendererSend('get-pipeline', payload)
  }
}
function handleGetPipeline(e, payload) {
  if (!loading.value) {
    return
  }
  if (payload.id === pipeline.value.id) {
    // console.log('current pipeline:', payload)
  } else {
    return
  }
  pipeline.value.name = payload.name
  pipeline.value.description = payload.description
  pipeline.value.color = payload.color
  if (payload.workflow) {
    pipeline.value.workflow = payload.workflow
  } else {
    delete pipeline.value.workflow
  }
  if (pipelineWorkflow.value?.nodes?.length) {
    comfyApp.graph.configure(pipelineWorkflow.value)
  }
  loading.value = false
}

function createPipeline(payload) {
  if (window.$electron) {
    window.$electron.ipcRendererSend('create-pipeline', payload)
  }
}
function handleCreatePipeline(e, payload) {
  if (payload.id === pipeline.value.id) {
    // console.log('created pipeline:', payload)
  } else {
    return
  }
  pipeline.value.name = payload.name
  pipeline.value.description = payload.description
  pipeline.value.color = payload.color
  if (payload.workflow) {
    pipeline.value.workflow = payload.workflow
  } else {
    delete pipeline.value.workflow
  }
  saving.value = false
}

function updatePipeline(payload) {
  if (window.$electron) {
    window.$electron.ipcRendererSend('update-pipeline', payload)
  }
}
function handleUpdatePipeline(e, payload) {
  if (payload.id === pipeline.value.id) {
    // console.log('updated pipeline:', payload)
  } else {
    return
  }
  pipeline.value.name = payload.name
  pipeline.value.description = payload.description
  pipeline.value.color = payload.color
  if (payload.workflow) {
    pipeline.value.workflow = payload.workflow
  } else {
    delete pipeline.value.workflow
  }
  saving.value = false
}

function deletePipeline(payload) {
  if (window.$electron) {
    window.$electron.ipcRendererSend('delete-pipeline', payload)
  }
}
function handleDeletePipeline(e, payload) {
  if (payload.id === pipeline.value.id) {
    // console.log('deleted pipeline:', payload)
  } else {
    return
  }
  deleting.value = false
}

// ---

async function langchainChat(langchain_json) {
  if (!langchain_json) {
    return
  }
  const previewTextNode = comfyApp.graph.findNodesByType(
    'rag_llm.preview_text'
  )[0]
  if (!previewTextNode) {
    return
  }
  const previewTextWidget = previewTextNode.widgets.find(
    (w) => w.type === 'llm-preview-text'
  )
  if (!previewTextWidget) {
    return
  }
  const previewTextEl = previewTextWidget.element.querySelector('textarea')
  if (!previewTextEl) {
    return
  } else {
    previewTextEl.value = ''
    previewTextEl.scrollTop = 0
  }

  let answers = ''
  try {
    const res = await fetch('https://www.chather.top/api/langchain_chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(langchain_json)
      // signal: controller.signal
    })
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        value
          .replace('\n\n\n', '\n\n')
          .split('\n\n')
          .forEach((chunk) => {
            if (chunk && chunk.startsWith('data: ')) {
              let data = chunk.slice('data: '.length).trim()
              if (data === '[DONE]') {
                return
              } else if (data.startsWith('{')) {
                data = JSON.parse(data)
              }
              if (data?.text) {
                answers += data.text
                previewTextEl.value += data.text
                previewTextEl.scrollTop = previewTextEl.scrollHeight
              }
            }
          })
      }
    }
    console.log('[DONE]')
  } catch (err) {
    console.error(err)
  }
  return answers
}
</script>

<style scoped>
.btn-pip {
  @apply truncate;
}
.btn-term {
  @apply max-md:hidden;
}
.terminal-container {
  @apply fixed top-0 right-0 max-md:hidden;
}
#terminal {
  @apply overflow-hidden border-black border-solid border-r border-b-4 border-l-4;
  transform: scale(0.75);
  transform-origin: top right;
}
</style>

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

#terminal .xterm-rows {
  font-size: 14px;
}
</style>
