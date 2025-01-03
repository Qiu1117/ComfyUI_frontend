// @ts-strict-ignore
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'PMT.PreviewVolView',
  nodeCreated(node) {
    if (node?.comfyClass !== 'preview.volview') {
      return
    }

    const getVolViewUrl = () => {
      // eslint-disable-next-line prefer-const
      let { origin, port, pathname } = document.location
      if (origin === 'file://') {
        pathname = pathname.replace('comfyui/', 'volview/')
      } else {
        if (port) {
          origin = origin.replace(port, `${+port - 1}`)
          // origin = origin.replace(port, `${+port - 3}`)
        }
        // pathname = pathname.replace('comfyui/', '') + 'volview/'
      }
      // eslint-disable-next-line prefer-const
      let search = `?uiMode=lite&layoutName=${'Axial Only'}`
      // serach += `&names=[data.png]&urls=[connect-file://localhost/C:\\sample test data\\data.png]`
      // search += `&names=[file.dcm]&urls=[connect-file://localhost/C:\\sample test data\\test2\\IM_0036.dcm]&uid=test2`
      // search += `&names=[test.zip]&urls=[connect-file://localhost/C:\\sample test data\\test2\\MRI-PROSTATEx-0004.zip]&uid=test&slice=0`
      return new URL(origin + pathname + search).href
    }
    const VOLVIEW_URL = getVolViewUrl()

    const getiFrameWidget = () => {
      let widget = node.widgets?.find((w) => w.name === 'preview-volview')
      if (!widget) {
        const div = document.createElement('div')
        div.classList.add('relative', 'overflow-hidden')
        div.innerHTML = `
          <div class="absolute inset-0 overflow-hidden">
            <iframe src="${VOLVIEW_URL}" frameborder="0" width="100%" height="100%"></iframe>
          </div>
        `
        widget = node.addDOMWidget(
          'preview-volview',
          'preview-volview',
          div,
          {}
        )
      }
      return widget
    }

    const _onDrawBackground = node.onDrawBackground
    node.onDrawBackground = function (...args) {
      // @ts-expect-error custom pmt_fields
      const isDone = node.pmt_fields?.status === 'done'

      const imageInputNode = isDone ? node.getInputNode(0) : null
      const dicomInputNode = isDone ? node.getInputNode(1) : null

      // @ts-expect-error custom pmt_fields
      const imageInputs = imageInputNode?.pmt_fields?.outputs || []
      const imagePath = Array.isArray(imageInputs[0]?.path)
        ? imageInputs[0]?.path?.[0]
        : imageInputs[0]?.path

      // @ts-expect-error custom pmt_fields
      const dicomInputs = dicomInputNode?.pmt_fields?.outputs || []
      const dicomPath = Array.isArray(dicomInputs[0]?.path)
        ? dicomInputs[0]?.path?.[0]
        : dicomInputs[0]?.path
      const dicomOid = Array.isArray(dicomInputs[0]?.oid)
        ? dicomInputs[0]?.oid?.[0]
        : dicomInputs[0]?.oid

      // ...

      if (dicomPath || dicomOid) {
        const widget = getiFrameWidget()
        const iframe = widget?.element?.querySelector('iframe')
        if (iframe) {
          const decode = false
          let imageUrl = dicomOid
            ? decode
              ? `${VOLVIEW_URL}&names=[preview.png]&urls=[connect://localhost/orthanc/instances/${dicomOid}/preview]`
              : `${VOLVIEW_URL}&names=[file.dcm]&urls=[connect://localhost/orthanc/instances/${dicomOid}/file]`
            : `${VOLVIEW_URL}&names=[file.dcm]&urls=[connect-file://localhost/${dicomPath}]`
          imageUrl = new URL(imageUrl).href
          if (iframe.src !== imageUrl) {
            node.setSize([400, 400])
            node.setDirtyCanvas(true)
            widget.element.style.removeProperty('visibility')
            iframe.src = imageUrl
          }
        }
      } else if (imagePath) {
        const widget = getiFrameWidget()
        const iframe = widget?.element?.querySelector('iframe')
        if (iframe) {
          let ext = 'png'
          if (imagePath.endsWith('.jpg')) {
            ext = 'jpg'
          } else if (imagePath.endsWith('.jpeg')) {
            ext = 'jpeg'
          }
          let imageUrl = `${VOLVIEW_URL}&names=[file.${ext}]&urls=[connect-file://localhost/${imagePath}]`
          imageUrl = new URL(imageUrl).href
          if (iframe.src !== imageUrl) {
            node.setSize([400, 400])
            node.setDirtyCanvas(true)
            widget.element.style.removeProperty('visibility')
            iframe.src = imageUrl
          }
        }
      } else {
        const widget = node.widgets?.[0]
        const iframe =
          widget && widget.name === 'preview-volview'
            ? widget.element?.querySelector('iframe')
            : null
        if (iframe) {
          const imageUrl = new URL(VOLVIEW_URL).href
          if (iframe.src !== imageUrl) {
            widget.element.style.setProperty('visibility', 'hidden')
            node.setSize([300, 100])
            node.setDirtyCanvas(true)
            iframe.src = imageUrl
          }
        }
      }
      return _onDrawBackground?.apply(this, args)
    }
  }
})
