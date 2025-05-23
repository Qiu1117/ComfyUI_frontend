import { pluginConfig2ComfyNodeDefs } from './pluginConfig2ComfyNodeDefs.ts'
import {
  validateOptionsFile,
  validatePythonFile,
  validateTypeFile
} from './pythonParser.ts'

class PythonValidator {
  constructor() {
    this.token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50X2lkIjoxLCJjb2RlIjoiMjQ2NzgiLCJhZG1pbiI6MSwiZXhwaXJlX3RpbWUiOjB9.G-YaphxirG6zJ9EGeHdb-70qpBQEY-199E-nvtua06k'
    this.toastCallback = null
    this.resetState()
  }

  resetState() {
    this.validateData = {
      typesFile: null,
      optionsFile: null,
      pythonFile: null,

      typesParsed: false,
      optionsParsed: false,
      jsonGenerated: false,
      parsingTypes: false,
      parsingOptions: false,
      validating: false,

      typesParseError: null,
      optionsParseError: null,
      pythonParseError: null,

      parsedTypes: {},
      parsedOptions: {},
      jsonConfig: null
    }
  }

  setToastCallback(callback) {
    this.toastCallback = callback
  }

  showToast(message) {
    if (this.toastCallback) {
      this.toastCallback(message)
    } else {
      console.log(`${message.severity}: ${message.summary} - ${message.detail}`)
    }
  }

  resetTypeFile() {
    this.validateData.typesFile = null
    this.validateData.typesParsed = false
    this.validateData.typesParseError = null

    this.resetOptionsFile()
  }

  resetOptionsFile() {
    this.validateData.optionsFile = null
    this.validateData.optionsParsed = false
    this.validateData.optionsParseError = null

    this.resetPythonFile()
  }

  resetPythonFile() {
    this.validateData.pythonFile = null
    this.validateData.jsonGenerated = false
    this.validateData.jsonConfig = null
    this.validateData.pythonParseError = null
  }

  async handleTypesFileUpload(file) {
    if (!file) return false

    try {
      this.validateData.typesFile = file
      await this.parseTypesFile(file)
      return true
    } catch (error) {
      this.showToast({
        severity: 'error',
        summary: 'Invalid File',
        detail:
          error.message ||
          'The selected file is not a valid type definition file'
      })
      return false
    }
  }

  async handleOptionsFileUpload(file) {
    if (!file) return false

    if (
      !this.validateData.typesParsed ||
      Object.keys(this.validateData.parsedTypes).length === 0
    ) {
      this.showToast({
        severity: 'error',
        summary: 'Missing Type Definitions',
        detail: 'Please upload and parse a valid type definition file first'
      })
      return false
    }

    try {
      this.validateData.optionsFile = file
      await this.parseOptionsFile(file)
      return true
    } catch (error) {
      this.showToast({
        severity: 'error',
        summary: 'Invalid File',
        detail:
          error.message ||
          'The selected file is not a valid options definition file'
      })
      return false
    }
  }

  async handlePythonFileUpload(file) {
    if (!file) return false

    if (
      !this.validateData.typesParsed ||
      Object.keys(this.validateData.parsedTypes).length === 0
    ) {
      this.showToast({
        severity: 'error',
        summary: 'Missing Type Definitions',
        detail: 'Please upload and parse a valid type definition file first'
      })
      return false
    }

    if (
      !this.validateData.optionsParsed ||
      Object.keys(this.validateData.parsedOptions).length === 0
    ) {
      this.showToast({
        severity: 'error',
        summary: 'Missing Options Definitions',
        detail: 'Please upload and parse a valid options definition file first'
      })
      return false
    }

    try {
      this.validateData.pythonFile = file
      this.validateData.validating = true
      this.validateData.pythonParseError = null

      try {
        const pluginConfig = await validatePythonFile(
          file,
          this.validateData.parsedTypes,
          this.validateData.parsedOptions
        )

        this.validateData.jsonConfig = pluginConfig
        this.validateData.jsonGenerated = true

        this.showToast({
          severity: 'success',
          summary: 'JSON Generated',
          detail: `Successfully generated JSON from ${file.name}`
        })

        return true
      } catch (error) {
        console.error('Error parsing Python file:', error)
        this.validateData.pythonParseError =
          error.message || 'Failed to generate JSON'
        this.showToast({
          severity: 'error',
          summary: 'Parsing Error',
          detail: `Failed to generate JSON: ${error.message}`
        })
        return false
      } finally {
        this.validateData.validating = false
      }
    } catch (error) {
      this.showToast({
        severity: 'error',
        summary: 'Invalid File',
        detail:
          error.message || 'The selected file is not a valid Python module'
      })
      return false
    }
  }

  async parseTypesFile(file) {
    try {
      this.validateData.parsingTypes = true
      this.validateData.typesParseError = null

      this.validateData.parsedTypes = await validateTypeFile(file)
      this.validateData.typesParsed = true

      this.showToast({
        severity: 'success',
        summary: 'Types Parsed',
        detail: 'Successfully parsed type definitions'
      })
    } catch (error) {
      console.error('Error parsing types file:', error)
      this.validateData.typesParseError =
        error.message || 'Failed to parse types file'
      this.showToast({
        severity: 'error',
        summary: 'Parsing Error',
        detail: `Failed to parse types file: ${error.message}`
      })
      throw error
    } finally {
      this.validateData.parsingTypes = false
    }
  }

  async parseOptionsFile(file) {
    try {
      this.validateData.parsingOptions = true
      this.validateData.optionsParseError = null

      this.validateData.parsedOptions = await validateOptionsFile(
        file,
        this.validateData.parsedTypes
      )
      this.validateData.optionsParsed = true

      this.showToast({
        severity: 'success',
        summary: 'Options Parsed',
        detail: 'Successfully parsed options definitions'
      })
    } catch (error) {
      console.error('Error parsing options file:', error)
      this.validateData.optionsParseError =
        error.message || 'Failed to parse options file'
      this.showToast({
        severity: 'error',
        summary: 'Parsing Error',
        detail: `Failed to parse options file: ${error.message}`
      })
      throw error
    } finally {
      this.validateData.parsingOptions = false
    }
  }

  exportJsonConfig(fileName) {
    if (!this.validateData.jsonConfig) return false

    const blob = new Blob(
      [JSON.stringify(this.validateData.jsonConfig, null, 2)],
      {
        type: 'application/json'
      }
    )

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${this.validateData.pythonFile?.name.replace('.py', '') || fileName || 'config'}.json`
    a.click()

    URL.revokeObjectURL(url)

    this.showToast({
      severity: 'success',
      summary: 'Export Successful',
      detail: 'Configuration JSON has been exported'
    })

    return true
  }

  async registerNodesToComfyUI() {
    if (!this.validateData.jsonConfig) return false

    try {
      const nodeDefs = pluginConfig2ComfyNodeDefs(
        this.validateData.jsonConfig,
        false
      )

      window.$generatedNodeDefs = nodeDefs

      if (
        window.comfyApp &&
        typeof window.comfyApp.registerNodes === 'function'
      ) {
        await window.comfyApp.registerNodes(nodeDefs)

        if (
          window.useCommandStore &&
          typeof window.useCommandStore().execute === 'function'
        ) {
          await window.useCommandStore().execute('Comfy.RefreshNodeDefinitions')
        }

        this.showToast({
          severity: 'info',
          summary: 'Nodes Registered',
          detail: `${Object.keys(nodeDefs).length} node(s) have been registered to ComfyUI`
        })

        return true
      }
    } catch (nodeDefsError) {
      console.error('Error generating node definitions:', nodeDefsError)
      this.showToast({
        severity: 'warn',
        summary: 'Node Definition Warning',
        detail: 'JSON was generated, but converting to node definitions failed'
      })
    }

    return false
  }

  getValidateData() {
    return { ...this.validateData }
  }
}

const pythonValidator = new PythonValidator()

export default pythonValidator
