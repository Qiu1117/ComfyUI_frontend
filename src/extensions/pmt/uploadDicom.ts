// @ts-strict-ignore
import { app } from '../../scripts/app'
import { ComfyNodeDef } from '@/types/apiTypes'

app.registerExtension({
  name: 'Comfy.UploadDicom',
  beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDef) {
    Object.keys(nodeData?.input || {}).forEach((t) => {
      Object.keys(nodeData.input[t]).forEach((inputName) => {
        const input = nodeData.input[t][inputName]
        if (input?.[1]?.dicom_upload === false) {
          nodeData.input[t][inputName] = ['STRING'] // oid text input
        } else if (input?.[1]?.dicom_upload === true) {
          nodeData.input[t]['upload'] = ['DICOMUPLOAD', { widget: inputName }]
        }
      })
    })
  },
  getCustomWidgets(app) {
    return {
      DICOMUPLOAD(node, inputName, inputData, app) {
        const customWidget = node.widgets.find(
          (w) => w.name === (inputData[1]?.widget ?? 'dicom')
        )
        if (customWidget) {
          const default_value = customWidget.value
          Object.defineProperty(customWidget, 'value', {
            get: function () {
              if (!this._real_value) {
                return default_value
              }
              let value = this._real_value
              if (value.filename) {
                const real_value = value
                value = ''
                value += real_value.filename
                if (real_value.type && real_value.type !== 'input')
                  value += ` [${real_value.type}]`
              }
              return value
            },
            set: function (value) {
              this._real_value = value
            }
          })

          // @ts-expect-error Property 'callback' does not exist on type 'LGraphNode'
          const cb = node.callback
          customWidget.callback = function (...args) {
            if (customWidget.value) {
              showImage(customWidget.value)
            }
            if (cb) {
              return cb.apply(this, args)
            }
          }
          requestAnimationFrame(() => {
            if (customWidget.value) {
              showImage(customWidget.value)
            }
          })
        }

        function showImage(filename) {
          // const img = new Image()
          // img.onload = () => {
          //   node.imgs = [img]
          //   app.graph.setDirtyCanvas(true)
          // }
          // img.src = `/some/path/${filename}`
          // node.setSizeForImage?.()
        }

        async function uploadFile(file, updateNode, pasted = false) {
          try {
            const formData = new FormData()
            formData.append('dicom', file)
            if (formData.get('dicom')) {
              console.log(file)
              // [POST] /upload api...
              if (customWidget) {
                customWidget.options.values = [file.name]
              }
              if (updateNode) {
                if (customWidget) {
                  customWidget.value = file.name
                }
                showImage(customWidget.value)
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
          hidden: true,
          onchange: async () => {
            if (fileInput.files.length) {
              const file = fileInput.files[0]
              const ext = file.name.split('.').slice(1).pop()
              if (!ext || ext === 'dcm') {
                await uploadFile(file, true)
              }
            }
          }
        })

        const uploadWidget = node.addWidget(
          'button',
          inputName,
          customWidget?.name ?? 'dicom',
          () => fileInput.click()
        )
        requestAnimationFrame(() => {
          uploadWidget.label = 'CHOOSE FILE'
          app.graph.setDirtyCanvas(true)
        })

        // @ts-expect-error Property 'onDragOver' does not exist on type 'LGraphNode'
        node.onDragOver = function (e) {
          if (e.dataTransfer && e.dataTransfer.items) {
            const dicom = [...e.dataTransfer.items].find(
              (f) => f.kind === 'file'
            )
            return !!dicom
          }
          return false
        }
        // @ts-expect-error Property 'onDragDrop' does not exist on type 'LGraphNode'
        node.onDragDrop = function (e) {
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
