<template>
  <teleport :to="'.comfyui-body-bottom'">
    <Panel id="pmt-action-panel">
      <ButtonGroup>
        <Button
          v-if="stoppable ? !running : true"
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
          @contextmenu.prevent="
            !!pipelineId && !saving && !running && runMenu.show($event)
          "
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
          v-if="!!pipelineId"
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
import { useRoute, useRouter } from 'vue-router'
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
import { nodeStatusColor } from '@/extensions/core/colorPalette'

const nodeDefStore = useNodeDefStore()

const route = useRoute()
const router = useRouter()

const { pipelineId, workflow_name } = route.query
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

const presets = {
  no: '{"last_node_id":0,"last_link_id":0,"nodes":[],"links":[],"groups":[],"config":{},"extra":{"ds":{"scale":1,"offset":[0,0]}},"version":0.4}',
  default: `{"last_node_id":4,"last_link_id":4,"nodes":[{"id":1,"type":"rag_llm.prompt","pos":[105.33335876464844,322.6666564941406],"size":[400,400],"flags":{},"order":0,"mode":0,"inputs":[{"name":"history","type":"LOOP","link":4,"shape":7},{"name":"text","type":"STRING","link":null,"widget":{"name":"text"}},{"name":"optional_text","type":"STRING","link":null,"widget":{"name":"optional_text"},"shape":7}],"outputs":[{"name":"prompt","type":"STRING","links":[1],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.prompt"},"widgets_values":["","hub","rlm/rag-prompt","You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\\nQuestion: {question} \\nContext: {context} \\nAnswer:","{messages}","",null],"pmt_fields":{"args":{"type":"hub","hub_link":"rlm/rag-prompt","system":"You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\\nQuestion: {question} \\nContext: {context} \\nAnswer:","human":"{messages}","prompt_template_vars":{"question":"","context":"","messages":""}},"status":""}},{"id":2,"type":"rag_llm.model","pos":[559.333251953125,333.3333435058594],"size":[315,106],"flags":{},"order":1,"mode":0,"inputs":[{"name":"text","type":"STRING","link":1,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[2],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.model"},"widgets_values":["","gpt-4o-mini",0.5],"pmt_fields":{"args":{"model_name":"gpt-4o-mini","temperature":0.5},"status":""}},{"id":3,"type":"rag_llm.response","pos":[922,137.3333282470703],"size":[315,126],"flags":{},"order":2,"mode":0,"inputs":[{"name":"text","type":"STRING","link":2,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[3],"slot_index":0},{"name":"history","type":"LOOP","links":[4],"slot_index":1}],"properties":{"Node name for S&R":"rag_llm.response"},"widgets_values":["",true,10000],"pmt_fields":{"args":{"enable_history":true,"max_tokens":10000},"status":""}},{"id":4,"type":"rag_llm.preview_text","pos":[1282.6666259765625,272.0000305175781],"size":[300,200],"flags":{},"order":3,"mode":0,"inputs":[{"name":"text","type":"STRING","link":3,"widget":{"name":"text"}}],"outputs":[],"properties":{"Node name for S&R":"rag_llm.preview_text"},"widgets_values":["",null],"pmt_fields":{"args":{},"status":""}}],"links":[[1,1,0,2,0,"STRING"],[2,2,0,3,0,"STRING"],[3,3,0,4,0,"STRING"],[4,3,1,1,0,"LOOP"]],"groups":[],"config":{},"extra":{"ds":{"scale":1,"offset":[0,0]}},"version":0.4}`,
  rag: `{"last_node_id":7,"last_link_id":7,"nodes":[{"id":5,"type":"rag_llm.knowledge","pos":[-1120.1199951171875,387.8730773925781],"size":[400,200],"flags":{},"order":0,"mode":0,"inputs":[],"outputs":[{"name":"kownledge","type":"STRING","links":[5],"slot_index":0},{"name":"log","type":"STRING","links":null}],"properties":{"Node name for S&R":"rag_llm.knowledge"},"widgets_values":["web",""],"pmt_fields":{"args":{"type":"web","sources":""},"status":""}},{"id":6,"type":"rag_llm.text_splitter","pos":[-661.6609497070312,327.746826171875],"size":[315,154],"flags":{},"order":1,"mode":0,"inputs":[{"name":"text","type":"STRING","link":5,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[6],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.text_splitter"},"widgets_values":["","token",350,0,""],"pmt_fields":{"args":{"type":"token","chunk_size":350,"chunk_overlap":0,"separators":""},"status":""}},{"id":7,"type":"rag_llm.vector_db","pos":[-292.3180236816406,386.7991638183594],"size":[315,130],"flags":{},"order":2,"mode":0,"inputs":[{"name":"text","type":"STRING","link":6,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[7],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.vector_db"},"widgets_values":["","chroma","openai",3],"pmt_fields":{"args":{"type":"chroma","embedding_type":"openai","retrieve_num":3},"status":""}},{"id":1,"type":"rag_llm.prompt","pos":[105.33335876464844,322.6666564941406],"size":[400,400],"flags":{},"order":3,"mode":0,"inputs":[{"name":"history","type":"LOOP","link":4,"shape":7},{"name":"text","type":"STRING","link":7,"widget":{"name":"text"}},{"name":"optional_text","type":"STRING","link":null,"widget":{"name":"optional_text"},"shape":7}],"outputs":[{"name":"prompt","type":"STRING","links":[1],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.prompt"},"widgets_values":["","hub","rlm/rag-prompt","You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\\nQuestion: {question} \\nContext: {context} \\nAnswer:","{messages}","",null],"pmt_fields":{"args":{"type":"hub","hub_link":"rlm/rag-prompt","system":"You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\\nQuestion: {question} \\nContext: {context} \\nAnswer:","human":"{messages}","prompt_template_vars":{"question":"","context":"","messages":""}},"status":""}},{"id":2,"type":"rag_llm.model","pos":[559.333251953125,333.3333435058594],"size":[315,106],"flags":{},"order":4,"mode":0,"inputs":[{"name":"text","type":"STRING","link":1,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[2],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.model"},"widgets_values":["","gpt-4o-mini",0.5],"pmt_fields":{"args":{"model_name":"gpt-4o-mini","temperature":0.5},"status":""}},{"id":3,"type":"rag_llm.response","pos":[922,137.3333282470703],"size":[315,126],"flags":{},"order":5,"mode":0,"inputs":[{"name":"text","type":"STRING","link":2,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[3],"slot_index":0},{"name":"history","type":"LOOP","links":[4],"slot_index":1}],"properties":{"Node name for S&R":"rag_llm.response"},"widgets_values":["",true,10000],"pmt_fields":{"args":{"enable_history":true,"max_tokens":10000},"status":""}},{"id":4,"type":"rag_llm.preview_text","pos":[1282.6666259765625,272.0000305175781],"size":[300,200],"flags":{},"order":6,"mode":0,"inputs":[{"name":"text","type":"STRING","link":3,"widget":{"name":"text"}}],"outputs":[],"properties":{"Node name for S&R":"rag_llm.preview_text"},"widgets_values":["",null],"pmt_fields":{"args":{},"status":""}}],"links":[[1,1,0,2,0,"STRING"],[2,2,0,3,0,"STRING"],[3,3,0,4,0,"STRING"],[4,3,1,1,0,"LOOP"],[5,5,0,6,0,"STRING"],[6,6,0,7,0,"STRING"],[7,7,0,1,1,"STRING"]],"groups":[],"config":{},"extra":{"ds":{"scale":1,"offset":[0,0]}},"version":0.4}`,
  crag: `{"last_node_id":12,"last_link_id":14,"nodes":[{"id":5,"type":"rag_llm.knowledge","pos":[-1795.305419921875,219.73934936523438],"size":[400,200],"flags":{},"order":0,"mode":0,"inputs":[],"outputs":[{"name":"kownledge","type":"STRING","links":[5],"slot_index":0},{"name":"log","type":"STRING","links":null}],"properties":{"Node name for S&R":"rag_llm.knowledge"},"widgets_values":["web",""],"pmt_fields":{"args":{"type":"web","sources":""},"status":""}},{"id":6,"type":"rag_llm.text_splitter","pos":[-1314.37060546875,248.50851440429688],"size":[315,154],"flags":{},"order":1,"mode":0,"inputs":[{"name":"text","type":"STRING","link":5,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[6],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.text_splitter"},"widgets_values":["","token",350,0,""],"pmt_fields":{"args":{"type":"token","chunk_size":350,"chunk_overlap":0,"separators":""},"status":""}},{"id":7,"type":"rag_llm.vector_db","pos":[-879.9946899414062,331.4211730957031],"size":[315,130],"flags":{},"order":2,"mode":0,"inputs":[{"name":"text","type":"STRING","link":6,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[8],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.vector_db"},"widgets_values":["","chroma","openai",3],"pmt_fields":{"args":{"type":"chroma","embedding_type":"openai","retrieve_num":3},"status":""}},{"id":8,"type":"rag_llm.prompt.grade_docs","pos":[-1945.737548828125,588.7113647460938],"size":[400,400],"flags":{},"order":3,"mode":0,"inputs":[{"name":"history","type":"LOOP","link":null,"shape":7},{"name":"text","type":"STRING","link":8,"widget":{"name":"text"}},{"name":"optional_text","type":"STRING","link":null,"widget":{"name":"optional_text"},"shape":7}],"outputs":[{"name":"prompt","type":"STRING","links":[9],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.prompt.grade_docs"},"widgets_values":["","customize","","You are a document retrieval evaluator that's responsible for checking the relevancy of a retrieved document to the user's question.\\n\\nIf the document contains keyword(s) or semantic meaning related to the question, grade it as relevant.\\n\\nOutput a binary score 'yes' or 'no' to indicate whether the document is relevant to the question.","Retrieved document:\\n\\n{document}\\n\\nUser question: {question}","",null],"pmt_fields":{"args":{"type":"customize","hub_link":"","system":"You are a document retrieval evaluator that's responsible for checking the relevancy of a retrieved document to the user's question.\\n\\nIf the document contains keyword(s) or semantic meaning related to the question, grade it as relevant.\\n\\nOutput a binary score 'yes' or 'no' to indicate whether the document is relevant to the question.","human":"Retrieved document:\\n\\n{document}\\n\\nUser question: {question}","prompt_template_vars":{"document":"","question":""}},"status":""}},{"id":9,"type":"rag_llm.model.grade_docs","pos":[-1483.99658203125,621.377685546875],"size":[315,106],"flags":{},"order":4,"mode":0,"inputs":[{"name":"text","type":"STRING","link":9,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[10,11],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.model.grade_docs"},"widgets_values":["","gpt-4o-mini",0.5],"pmt_fields":{"args":{"model_name":"gpt-4o-mini","temperature":0.5},"status":""}},{"id":10,"type":"rag_llm.prompt.transform_query","pos":[-1117.678466796875,694.4251098632812],"size":[400,400],"flags":{},"order":5,"mode":0,"inputs":[{"name":"history","type":"LOOP","link":null,"shape":7},{"name":"text","type":"STRING","link":11,"widget":{"name":"text"}},{"name":"optional_text","type":"STRING","link":null,"widget":{"name":"optional_text"},"shape":7}],"outputs":[{"name":"prompt","type":"STRING","links":[12],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.prompt.transform_query"},"widgets_values":["","customize","","You are a question re-writer that converts an input question to a better version that is optimized for web search.\\n\\nLook at the input and try to reason about the underlying semantic intent / meaning.","Here is the initial question:\\n\\n{question}\\n\\nFormulate an improved question.","",null],"pmt_fields":{"args":{"type":"customize","hub_link":"","system":"You are a question re-writer that converts an input question to a better version that is optimized for web search.\\n\\nLook at the input and try to reason about the underlying semantic intent / meaning.","human":"Here is the initial question:\\n\\n{question}\\n\\nFormulate an improved question.","prompt_template_vars":{"question":""}},"status":""}},{"id":11,"type":"rag_llm.model.transform_query","pos":[-655.8319091796875,621.2080688476562],"size":[315,106],"flags":{},"order":6,"mode":0,"inputs":[{"name":"text","type":"STRING","link":12,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[13],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.model.transform_query"},"widgets_values":["","gpt-4o-mini",0.5],"pmt_fields":{"args":{"model_name":"gpt-4o-mini","temperature":0.5},"status":""}},{"id":12,"type":"rag_llm.web_search","pos":[-282.0015563964844,544.7903442382812],"size":[315,82],"flags":{},"order":7,"mode":0,"inputs":[{"name":"text","type":"STRING","link":13,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[14],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.web_search"},"widgets_values":["",57],"pmt_fields":{"args":{"k":57},"status":""}},{"id":1,"type":"rag_llm.prompt","pos":[105.33335876464844,322.6666564941406],"size":[400,400],"flags":{},"order":8,"mode":0,"inputs":[{"name":"history","type":"LOOP","link":4,"shape":7},{"name":"text","type":"STRING","link":10,"widget":{"name":"text"}},{"name":"optional_text","type":"STRING","link":14,"widget":{"name":"optional_text"},"shape":7}],"outputs":[{"name":"prompt","type":"STRING","links":[1],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.prompt"},"widgets_values":["","hub","rlm/rag-prompt","You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\\nQuestion: {question} \\nContext: {context} \\nAnswer:","{messages}","",null],"pmt_fields":{"args":{"type":"hub","hub_link":"rlm/rag-prompt","system":"You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\\nQuestion: {question} \\nContext: {context} \\nAnswer:","human":"{messages}","prompt_template_vars":{"question":"","context":"","messages":""}},"status":""}},{"id":2,"type":"rag_llm.model","pos":[559.333251953125,333.3333435058594],"size":[315,106],"flags":{},"order":9,"mode":0,"inputs":[{"name":"text","type":"STRING","link":1,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[2],"slot_index":0}],"properties":{"Node name for S&R":"rag_llm.model"},"widgets_values":["","gpt-4o-mini",0.5],"pmt_fields":{"args":{"model_name":"gpt-4o-mini","temperature":0.5},"status":""}},{"id":3,"type":"rag_llm.response","pos":[922,137.3333282470703],"size":[315,126],"flags":{},"order":10,"mode":0,"inputs":[{"name":"text","type":"STRING","link":2,"widget":{"name":"text"}}],"outputs":[{"name":"text","type":"STRING","links":[3],"slot_index":0},{"name":"history","type":"LOOP","links":[4],"slot_index":1}],"properties":{"Node name for S&R":"rag_llm.response"},"widgets_values":["",true,10000],"pmt_fields":{"args":{"enable_history":true,"max_tokens":10000},"status":""}},{"id":4,"type":"rag_llm.preview_text","pos":[1282.6666259765625,272.0000305175781],"size":[300,200],"flags":{},"order":11,"mode":0,"inputs":[{"name":"text","type":"STRING","link":3,"widget":{"name":"text"}}],"outputs":[],"properties":{"Node name for S&R":"rag_llm.preview_text"},"widgets_values":["",null],"pmt_fields":{"args":{},"status":""}}],"links":[[1,1,0,2,0,"STRING"],[2,2,0,3,0,"STRING"],[3,3,0,4,0,"STRING"],[4,3,1,1,0,"LOOP"],[5,5,0,6,0,"STRING"],[6,6,0,7,0,"STRING"],[8,7,0,8,1,"STRING"],[9,8,0,9,0,"STRING"],[10,9,0,1,1,"STRING"],[11,9,0,10,1,"STRING"],[12,10,0,11,0,"STRING"],[13,11,0,12,0,"STRING"],[14,12,0,1,2,"STRING"]],"groups":[],"config":{},"extra":{"ds":{"scale":1,"offset":[0,0]}},"version":0.4}`
}
onMounted(() => {
  initNameAndColor()

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

      if (node?.comfyClass === 'input.2d') {
        const _onMouseEnter = node.onMouseEnter
        node.onMouseEnter = function (e) {
          node.pmt_styles = {
            ringColor: nodeStatusColor['current'],
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
    },

    getCustomWidgets(app) {
      return {
        DICOMUPLOAD(node, inputName, inputData, app) {
          const customWidget = node.widgets.find(
            (w) => w.name === (inputData[1]?.widget ?? 'dicom')
          )
          let uploadWidget

          function showImage(name) {
            const img = new Image()
            img.onload = () => {
              node.imgs = [img]
              app.graph.setDirtyCanvas(true)
            }
            // img.src = `/some/path/${name}`
            // node.setSizeForImage?.()
          }

          var default_value = customWidget.value
          Object.defineProperty(customWidget, 'value', {
            set: function (value) {
              this._real_value = value
            },

            get: function () {
              if (!this._real_value) {
                return default_value
              }

              let value = this._real_value
              if (value.filename) {
                let real_value = value
                value = ''
                if (real_value.subfolder) {
                  value = real_value.subfolder + '/'
                }

                value += real_value.filename

                if (real_value.type && real_value.type !== 'input')
                  value += ` [${real_value.type}]`
              }
              return value
            }
          })

          const cb = node.callback
          customWidget.callback = function () {
            showImage(customWidget.value)
            if (cb) {
              return cb.apply(this, arguments)
            }
          }
          requestAnimationFrame(() => {
            if (customWidget.value) {
              showImage(customWidget.value)
            }
          })

          async function uploadFile(file, updateNode, pasted = false) {
            try {
              const formData = new FormData()
              formData.append('dicom', file)
              // [POST] /upload/dicom api...
              console.log(file)
              if (formData.get('dicom')) {
                let path = file.name
                customWidget.options.values = [file.name]
                if (updateNode) {
                  showImage(path)
                  customWidget.value = path
                }
              }
            } catch (err) {
              console.error(err)
            }
          }

          const fileInput = document.createElement('input')
          Object.assign(fileInput, {
            type: 'file',
            accept: 'application/dicom',
            style: 'display: none',
            onchange: async () => {
              if (fileInput.files.length) {
                const ext = fileInput.files[0].name.split('.').slice(1).pop()
                if (!ext || ext === 'dcm') {
                  await uploadFile(fileInput.files[0], true)
                }
              }
            }
          })
          document.body.append(fileInput)

          // Create the button widget for selecting the files
          uploadWidget = node.addWidget('button', inputName, 'dicom', () => {
            fileInput.click()
          })
          uploadWidget.label = 'CHOOSE FILE'
          uploadWidget.serialize = false

          node.onDragOver = function (e) {
            if (e.dataTransfer && e.dataTransfer.items) {
              const image = [...e.dataTransfer.items].find(
                (f) => f.kind === 'file'
              )
              return !!image
            }
            return false
          }
          node.onDragDrop = function (e) {
            console.log('onDragDrop called')
            let handled = false
            for (const file of e.dataTransfer.files) {
              const ext = file.name.split('.').slice(1).pop()
              if (file.type === 'application/dicom' || !ext || ext === 'dcm') {
                uploadFile(file, !handled)
                handled = true
              }
            }
            return handled
          }

          return { widget: uploadWidget }
        }
      }
    }
  })

  comfyApp.canvasEl.addEventListener('drop', onDrop)

  if (workflow_name && workflow_name in presets) {
    comfyApp.graph.configure(JSON.parse(presets[workflow_name]))
  } else {
    comfyApp.graph.configure(
      JSON.parse(sessionStorage.getItem('workflow') || presets.default)
    )
  }

  window['driverObjs'] = []
  window['driverHighlight'] = (...args) => {
    window.driverObjs.push(highlight(...args))
    return window.driverObjs
  }
  window.__session_id__ = `${Date.now()}`
})

onUnmounted(() => {
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
    disabled: true,
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
  if (!pipelineId) {
    const { json, langchain_json } = exportJson(false)
    const answers = await langchainChat(langchain_json)
    console.log(answers)
  }
  // ...
  // await new Promise((r) => {
  //   runningTimer = setTimeout(r, 5000)
  // })
  running.value = false
}

const stoppable = ref(!!pipelineId)
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
  if (!pipelineId) {
    const { json, langchain_json } = exportJson(false)
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
  // ...
  // await new Promise((r) => setTimeout(r, 1000))
  saving.value = false
  toast.add({
    severity: 'success',
    summary: 'Saved',
    detail: 'Changes have been saved!',
    life: 3000
  })
}

function exportJson(download = true) {
  const json = getWorkflowJson()
  console.log(json)

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
  }

  return {
    json,
    langchain_json
  }
  // ...
}

function getWorkflowJson() {
  const workflow = comfyApp.graph.serialize()
  workflow.nodes.sort((a, b) => a.order - b.order)
  workflow.nodes.forEach(({ id, inputs, outputs }, i, nodes) => {
    const node = comfyApp.graph.getNodeById(id)
    const nodeDef = nodeDefStore.nodeDefsByName[node.type]
    const [type] = node.type.split('.')
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
    const pmt_fields = {
      type,
      plugin_name: plugin_name || null,
      function_name: function_name || null,
      inputs: (inputs || []).map((i) => {
        return {}
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
    return nodes[i]
  })
  return JSON.parse(JSON.stringify(workflow))
}

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

  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50X2lkIjoxLCJjb2RlIjoiMjQ2NzgiLCJhZG1pbiI6MSwiZXhwaXJlX3RpbWUiOjB9.G-YaphxirG6zJ9EGeHdb-70qpBQEY-199E-nvtua06k'
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
</style>
