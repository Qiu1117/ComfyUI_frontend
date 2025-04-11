// validateUtils.js

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
    console.log(`${message.severity}: ${message.summary} - ${message.detail}`)
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
      const pythonCode = await this.readFileAsText(file)

      const hasTypeDefinitions =
        /class\s+\w+(?:\(([^)]+)\))?:/g.test(pythonCode) &&
        pythonCode.includes('Type used in pipeline')

      if (!hasTypeDefinitions) {
        throw new Error(
          'This does not appear to be a valid type definition file. Please upload a file containing type definitions.'
        )
      }

      this.validateData.typesFile = file
      await this.parseTypesFile(pythonCode)
      return true
    } catch (error) {
      console.log(
        `error: Invalid File - ${error.message || 'The selected file is not a valid type definition file'}`
      )
      return false
    }
  }

  async handleOptionsFileUpload(file) {
    if (!file) return false

    if (
      !this.validateData.typesParsed ||
      Object.keys(this.validateData.parsedTypes).length === 0
    ) {
      console.log(
        'error: Missing Type Definitions - Please upload and parse a valid type definition file first'
      )
      return false
    }

    try {
      const pythonCode = await this.readFileAsText(file)

      const hasOptionsDefinitions = /class\s+\w+Options:/g.test(pythonCode)

      if (!hasOptionsDefinitions) {
        throw new Error(
          'This does not appear to be a valid options definition file. Please upload a file containing option class definitions.'
        )
      }

      this.validateData.optionsFile = file
      await this.parseOptionsFile(pythonCode)
      return true
    } catch (error) {
      console.log(
        `error: Invalid File - ${error.message || 'The selected file is not a valid options definition file'}`
      )
      return false
    }
  }

  async handlePythonFileUpload(file) {
    if (!file) return false

    if (
      !this.validateData.typesParsed ||
      Object.keys(this.validateData.parsedTypes).length === 0
    ) {
      console.log(
        'error: Missing Type Definitions - Please upload and parse a valid type definition file first'
      )
      return false
    }

    if (
      !this.validateData.optionsParsed ||
      Object.keys(this.validateData.parsedOptions).length === 0
    ) {
      console.log(
        'error: Missing Options Definitions - Please upload and parse a valid options definition file first'
      )
      return false
    }

    try {
      const pythonCode = await this.readFileAsText(file)

      const hasClassDefinition = /class\s+\w+\s*:/g.test(pythonCode)
      const hasFunctionDefinition = /def\s+\w+\s*\(/g.test(pythonCode)

      if (!hasClassDefinition || !hasFunctionDefinition) {
        throw new Error(
          'This does not appear to be a valid Python module. Please upload a file containing class and function definitions.'
        )
      }

      const hasDescription = /DESCRIPTION\s*=\s*["'].*?["']/s.test(pythonCode)
      const hasVersion = /VERSION\s*=\s*["'].*?["']/s.test(pythonCode)
      const hasAuthor = /AUTHOR\s*=\s*["'].*?["']/s.test(pythonCode)
      const hasExecutableFunction = /EXECUTABLE_FUNCTION\s*=\s*\[.*?\]/s.test(
        pythonCode
      )

      const missingAttributes = []
      if (!hasDescription) missingAttributes.push('DESCRIPTION')
      if (!hasVersion) missingAttributes.push('VERSION')
      if (!hasAuthor) missingAttributes.push('AUTHOR')
      if (!hasExecutableFunction) missingAttributes.push('EXECUTABLE_FUNCTION')

      if (missingAttributes.length > 0) {
        throw new Error(
          `The Python module is missing required class attributes: ${missingAttributes.join(', ')}`
        )
      }

      const executableFunctionMatch = pythonCode.match(
        /EXECUTABLE_FUNCTION\s*=\s*\[(.*?)\]/s
      )

      if (executableFunctionMatch) {
        const executableFunctions = executableFunctionMatch[1]
          .split(',')
          .map((f) => f.trim().replace(/['"]/g, ''))
          .filter((f) => f)

        const functionDocRegex =
          /def\s+(\w+)\s*\([^)]*\)(?:\s*->.*?)?:\s*(?:"""|''')([\s\S]*?)(?:"""|''')/g
        const foundFunctions = new Set()
        const missingDocumentation = []

        let functionMatch
        while ((functionMatch = functionDocRegex.exec(pythonCode)) !== null) {
          const funcName = functionMatch[1]
          const docString = functionMatch[2]

          if (executableFunctions.includes(funcName)) {
            foundFunctions.add(funcName)

            const hasSourceSection = /Source:\s*\n/i.test(docString)
            const hasArgsSection = /Args:\s*\n/i.test(docString)

            if (!hasSourceSection || !hasArgsSection) {
              missingDocumentation.push(
                `${funcName} (missing: ${!hasSourceSection ? 'Source' : ''}${!hasSourceSection && !hasArgsSection ? ', ' : ''}${!hasArgsSection ? 'Args' : ''})`
              )
            }
          }
        }

        const missingFunctions = executableFunctions.filter(
          (f) => !foundFunctions.has(f)
        )

        if (missingFunctions.length > 0) {
          throw new Error(
            `Some executable functions were declared but not found in the code: ${missingFunctions.join(', ')}`
          )
        }

        if (missingDocumentation.length > 0) {
          throw new Error(
            `Some functions are missing required documentation sections: ${missingDocumentation.join('; ')}`
          )
        }
      }

      this.validateData.pythonFile = file

      this.validateData.validating = true
      this.validateData.pythonParseError = null

      try {
        const pluginConfig = await this.parsePythonToJson(
          pythonCode,
          file.name,
          this.validateData.parsedTypes,
          this.validateData.parsedOptions
        )

        this.validateData.jsonConfig = pluginConfig
        this.validateData.jsonGenerated = true

        console.log(
          `success: JSON Generated - Successfully generated JSON from ${file.name}`
        )

        return true
      } catch (error) {
        console.error('Error parsing Python file:', error)
        this.validateData.pythonParseError =
          error.message || 'Failed to generate JSON'
        console.log(
          `error: Parsing Error - Failed to generate JSON: ${error.message}`
        )
        return false
      } finally {
        this.validateData.validating = false
      }
    } catch (error) {
      console.log(
        `error: Invalid File - ${error.message || 'The selected file is not a valid Python module'}`
      )
      return false
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  async parseTypesFile(pythonCode) {
    try {
      this.validateData.parsingTypes = true
      this.validateData.typesParseError = null

      this.validateData.parsedTypes =
        await this.extractTypeDefinitions(pythonCode)
      this.validateData.typesParsed = true

      console.log(
        'success: Types Parsed - Successfully parsed type definitions'
      )
    } catch (error) {
      console.error('Error parsing types file:', error)
      this.validateData.typesParseError =
        error.message || 'Failed to parse types file'
      console.log(
        `error: Parsing Error - Failed to parse types file: ${error.message}`
      )
    } finally {
      this.validateData.parsingTypes = false
    }
  }

  async parseOptionsFile(pythonCode) {
    try {
      this.validateData.parsingOptions = true
      this.validateData.optionsParseError = null

      this.validateData.parsedOptions =
        await this.extractOptionDefinitions(pythonCode)
      this.validateData.optionsParsed = true

      console.log(
        'success: Options Parsed - Successfully parsed options definitions'
      )
    } catch (error) {
      console.error('Error parsing options file:', error)
      this.validateData.optionsParseError =
        error.message || 'Failed to parse options file'
      console.log(
        `error: Parsing Error - Failed to parse options file: ${error.message}`
      )
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

    console.log(
      'success: Export Successful - Configuration JSON has been exported'
    )

    return true
  }

  pluginConfig2ComfyNodeDefs(config, print = true) {
    const defs = {}

    if (!config || !config.functions) {
      return defs
    }

    config.functions.forEach((func) => {
      const def = {
        name: `plugin.${config.plugin_name}.${func.function_name}`,
        category: `plugins/${config.plugin_name}`,
        display_name: func.display_name,
        description: func.description,
        python_module: `custom_nodes.${config.plugin_name}.${func.function_name}`,
        input: {},
        input_order: {},
        output: [],
        output_name: [],
        output_is_list: [],
        output_node: false
      }

      const input = def.input
      const input_order = def.input_order
      if (func.input?.source) {
        func.input?.source.forEach((src) => {
          if (!input.required) {
            input.required = {}
          }
          input.required[src.name] = [src.type]
          if (src.options) {
            input.required[src.name].push(src.options)
          }
          if (!input_order.required) {
            input_order.required = []
          }
          input_order.required.push(src.name)
        })
      }
      if (func.input?.args) {
        func.input?.args.forEach((arg) => {
          if (!input.optional) {
            input.optional = {}
          }
          input.optional[arg.name] = [arg.type]
          if (arg.options) {
            input.optional[arg.name].push(arg.options)
          }
          if (!input_order.optional) {
            input_order.optional = []
          }
          input_order.optional.push(arg.name)
        })
      }

      const output = def.output
      const output_name = def.output_name
      const output_is_list = def.output_is_list
      if (func.output) {
        func.output.forEach((out) => {
          output.push(out.type)
          output_name.push(out.name)
          output_is_list.push(false)
        })
      }

      defs[def.name] = def
    })

    const nodeDefs = JSON.stringify(defs, null, 2)
    if (print) {
      console.log(nodeDefs)
    }

    return JSON.parse(nodeDefs)
  }

  async registerNodesToComfyUI() {
    if (!this.validateData.jsonConfig) return false

    try {
      const nodeDefs = this.pluginConfig2ComfyNodeDefs(
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

        console.log(
          `info: Nodes Registered - ${Object.keys(nodeDefs).length} node(s) have been registered to ComfyUI`
        )

        return true
      }
    } catch (nodeDefsError) {
      console.error('Error generating node definitions:', nodeDefsError)
      console.log(
        'warn: Node Definition Warning - JSON was generated, but converting to node definitions failed'
      )
    }

    return false
  }

  async extractTypeDefinitions(pythonCode) {
    const classRegex = /class\s+(\w+)(?:\(([^)]+)\))?:/g
    const typeMapping = {}

    let match
    while ((match = classRegex.exec(pythonCode)) !== null) {
      const className = match[1]
      typeMapping[className] = className
    }

    const typeCommentMatch = pythonCode.match(
      /'''[\s\S]*Type used in pipeline[\s\S]*?'''[\s\S]*?$/m
    )
    if (typeCommentMatch) {
      const typeCommentLines = typeCommentMatch[0].split('\n')

      for (const line of typeCommentLines) {
        const mappingMatch = line.match(
          /\s*(\w+)\s*->\s*(\w+)(?:\s*->\s*(\w+))?/
        )
        if (mappingMatch) {
          const pythonType = mappingMatch[1]
          const finalType = mappingMatch[3] || mappingMatch[2]
          typeMapping[pythonType] = finalType
        }
      }
    }

    return typeMapping
  }

  async extractOptionDefinitions(pythonCode) {
    const classRegex = /class\s+(\w+)Options:/g
    const optionsMapping = {}

    let match
    while ((match = classRegex.exec(pythonCode)) !== null) {
      const baseType = match[1]

      const classBodyStart = pythonCode.indexOf(':', match.index) + 1
      const nextClassIndex = pythonCode.indexOf('class ', classBodyStart)
      const classBody = pythonCode.substring(
        classBodyStart,
        nextClassIndex > -1 ? nextClassIndex : pythonCode.length
      )

      const initMatch = classBody.match(
        /def\s+__init__\s*\(\s*self(?:,\s*([^)]+))?\)/
      )
      if (initMatch && initMatch[1]) {
        const params = initMatch[1].split(',').map((p) => {
          const [name, defaultValue] = p.split('=').map((s) => s.trim())
          return { name, defaultValue: defaultValue || null }
        })

        optionsMapping[baseType] = params
      } else {
        optionsMapping[baseType] = []
      }
    }

    return optionsMapping
  }

  async parsePythonToJson(pythonCode, fileName, typeMapping, optionsMapping) {
    const classRegex = /class\s+(\w+)\s*:/
    const classMatch = pythonCode.match(classRegex)
    const pluginName = classMatch
      ? classMatch[1]
      : fileName.replace(/\.py$/, '')

    const descriptionMatch = pythonCode.match(
      /DESCRIPTION\s*=\s*["']([^"']*)["']/
    )
    const versionMatch = pythonCode.match(/VERSION\s*=\s*["']([^"']*)["']/)
    const authorMatch = pythonCode.match(/AUTHOR\s*=\s*["']([^"']*)["']/)
    const executableMatch = pythonCode.match(
      /EXECUTABLE_FUNCTION\s*=\s*\[(.*?)\]/
    )

    const description = descriptionMatch ? descriptionMatch[1] : ''
    const version = versionMatch ? versionMatch[1] : '0.1.0'
    const author = authorMatch ? authorMatch[1] : ''

    let executableFunctions = []
    if (executableMatch && executableMatch[1]) {
      executableFunctions = executableMatch[1]
        .split(',')
        .map((f) => f.trim().replace(/['"]/g, ''))
        .filter((f) => f)
    }

    const result = {
      plugin_name: pluginName,
      description: description,
      version: version,
      author: author,
      functions: []
    }

    const annotatedFields = {}
    const annotatedRegex =
      /(\w+)_with_options\s*=\s*Annotated\[(\w+),\s*(\w+)Options\(([^)]*)\)\]/g
    let annotatedMatch

    while ((annotatedMatch = annotatedRegex.exec(pythonCode)) !== null) {
      const fieldName = annotatedMatch[1]
      const fieldType = annotatedMatch[2]
      const optionsClass = annotatedMatch[3]
      const optionsArgsStr = annotatedMatch[4]

      const optionsArgs = {}

      const paramRegex = /(\w+)\s*=\s*([^,]+)(?:,|$)/g
      let paramMatch

      while ((paramMatch = paramRegex.exec(optionsArgsStr)) !== null) {
        const paramName = paramMatch[1].trim()
        let paramValue = paramMatch[2].trim()

        if (
          paramValue.toLowerCase() === 'true' ||
          paramValue.toLowerCase() === 'false'
        ) {
          paramValue = paramValue.toLowerCase() === 'true'
        } else if (!isNaN(paramValue)) {
          if (paramValue.includes('.')) {
            paramValue = parseFloat(paramValue)
          } else {
            paramValue = parseInt(paramValue)
          }
        } else if (paramValue.startsWith('"') || paramValue.startsWith("'")) {
          paramValue = paramValue.substring(1, paramValue.length - 1)
        }

        optionsArgs[paramName] = paramValue
      }

      annotatedFields[fieldName] = {
        type: fieldType,
        optionsClass,
        optionsArgs
      }
    }

    const funcRegex = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g
    const docstringRegex = /"""([\s\S]*?)"""/

    let match
    while ((match = funcRegex.exec(pythonCode)) !== null) {
      const funcName = match[1]

      if (
        executableFunctions.length > 0 &&
        !executableFunctions.includes(funcName)
      ) {
        continue
      }

      const params = match[2].trim()
      const returnType = match[3] ? match[3].trim() : ''

      const funcPos = match.index + match[0].length
      const nextDefPos = pythonCode.indexOf('\ndef ', funcPos)
      const classEndPos = pythonCode.indexOf('\nclass ', funcPos)
      let endPos = pythonCode.length

      if (nextDefPos > -1 && (nextDefPos < classEndPos || classEndPos === -1)) {
        endPos = nextDefPos
      } else if (classEndPos > -1) {
        endPos = classEndPos
      }

      const funcBody = pythonCode.substring(funcPos, endPos)
      const docMatch = funcBody.match(docstringRegex)
      const docstring = docMatch ? docMatch[1].trim() : ''

      const descLines = docstring.split('\n')
      let functionDescription = descLines.length > 0 ? descLines[0].trim() : ''

      const sourceRegex = /Source:\s*\n([\s\S]*?)(?:\n\s*Args:|\n\s*Returns:|$)/
      const argsRegex = /Args:\s*\n([\s\S]*?)(?:\n\s*Returns:|$)/

      const sourceMatch = docstring.match(sourceRegex)
      const argsMatch = docstring.match(argsRegex)

      const sources = []
      const args = []

      const paramMap = {}
      params.split(',').forEach((p) => {
        const trimParam = p.trim()
        if (trimParam && !trimParam.startsWith('self')) {
          const parts = trimParam.split(':')
          const paramName = parts[0].trim()

          let paramType = null
          let defaultValue = null

          if (parts.length > 1) {
            const typeAndDefault = parts[1].split('=')
            paramType = typeAndDefault[0].trim()

            if (paramName in annotatedFields) {
              paramType = annotatedFields[paramName].type
            }

            if (typeAndDefault.length > 1) {
              defaultValue = typeAndDefault[1].trim()
            }
          } else if (trimParam.includes('=')) {
            const nameAndDefault = trimParam.split('=')
            defaultValue = nameAndDefault[1].trim()
          }

          let mappedType = 'STRING'
          for (const [pythonType, mappedValue] of Object.entries(typeMapping)) {
            if (paramType && paramType.includes(pythonType)) {
              mappedType = mappedValue
              break
            }
          }

          paramMap[paramName] = {
            type: mappedType,
            default: defaultValue,
            options: annotatedFields[paramName] || null
          }
        }
      })

      const sourceParams = new Set()

      if (sourceMatch) {
        const sourceLines = sourceMatch[1].trim().split('\n')
        for (const line of sourceLines) {
          const sourceLine = line.trim()
          if (sourceLine.startsWith('-')) {
            const [nameRaw, ...descParts] = sourceLine.substring(1).split(':')
            const name = nameRaw.trim()
            const desc = descParts.join(':').trim()

            const type = paramMap[name]
              ? paramMap[name].type
              : typeMapping['Array'] || '1D'

            sources.push({
              name,
              type,
              description: desc,
              options: paramMap[name]?.options?.optionsArgs || {}
            })

            sourceParams.add(name)
          }
        }
      }

      Object.entries(paramMap).forEach(([name, info]) => {
        if (
          !sourceParams.has(name) &&
          (name === 'data' ||
            name === 'input_data' ||
            name.endsWith('_data') ||
            name.startsWith('input_') ||
            name.match(/data\d+/))
        ) {
          sources.push({
            name,
            type: info.type,
            description: `Input ${name}`,
            options: info.options?.optionsArgs || {}
          })

          sourceParams.add(name)
        }
      })

      if (argsMatch) {
        const argsLines = argsMatch[1].trim().split('\n')
        let currentArg = null
        let inOptions = false

        for (const line of argsLines) {
          const argLine = line.trim()

          if (argLine.startsWith('- ')) {
            if (argLine.startsWith('- options:')) {
              inOptions = true
              if (currentArg && !currentArg.options) {
                currentArg.options = {}
              }
            } else if (inOptions && currentArg) {
              const optionMatch = argLine.substring(2).match(/^(\w+):\s*(.+)$/)
              if (optionMatch) {
                const key = optionMatch[1].trim()
                const value = optionMatch[2].trim()

                let parsedValue = value
                if (
                  value.toLowerCase() === 'true' ||
                  value.toLowerCase() === 'false'
                ) {
                  parsedValue = value.toLowerCase() === 'true'
                } else if (!isNaN(value)) {
                  if (value.includes('.')) {
                    parsedValue = parseFloat(value)
                  } else {
                    parsedValue = parseInt(value)
                  }
                } else if (value.startsWith('"') || value.startsWith("'")) {
                  parsedValue = value.substring(1, value.length - 1)
                }

                currentArg.options[key] = parsedValue
              }
            } else {
              if (currentArg) {
                args.push(currentArg)
              }

              inOptions = false
              const nameMatch = argLine
                .substring(2)
                .match(/^(\w+)(?::\s*(.+))?$/)

              if (nameMatch) {
                const name = nameMatch[1].trim()
                const desc = nameMatch[2] ? nameMatch[2].trim() : name

                if (sourceParams.has(name)) {
                  continue
                }

                const paramInfo = paramMap[name] || {
                  type: typeMapping['str'] || 'STRING',
                  default: null
                }

                currentArg = {
                  name,
                  type: paramInfo.type,
                  description: desc,
                  options: {}
                }

                if (paramInfo.options && paramInfo.options.optionsArgs) {
                  Object.assign(
                    currentArg.options,
                    paramInfo.options.optionsArgs
                  )
                }

                if (paramInfo.default) {
                  let parsedValue = paramInfo.default
                  if (
                    parsedValue.toLowerCase() === 'true' ||
                    parsedValue.toLowerCase() === 'false'
                  ) {
                    parsedValue = parsedValue.toLowerCase() === 'true'
                  } else if (!isNaN(parsedValue)) {
                    if (parsedValue.includes('.')) {
                      parsedValue = parseFloat(parsedValue)
                    } else {
                      parsedValue = parseInt(parsedValue)
                    }
                  } else if (
                    parsedValue.startsWith('"') ||
                    parsedValue.startsWith("'")
                  ) {
                    parsedValue = parsedValue.substring(
                      1,
                      parsedValue.length - 1
                    )
                  }

                  currentArg.options.default = parsedValue
                }
              }
            }
          }
        }

        if (currentArg) {
          args.push(currentArg)
        }
      }

      Object.entries(paramMap).forEach(([name, info]) => {
        if (!sourceParams.has(name) && !args.find((a) => a.name === name)) {
          const argObj = {
            name,
            type: info.type,
            description: name,
            options: {}
          }

          if (info.options && info.options.optionsArgs) {
            Object.assign(argObj.options, info.options.optionsArgs)
          }

          if (info.default) {
            let parsedValue = info.default
            if (
              parsedValue.toLowerCase() === 'true' ||
              parsedValue.toLowerCase() === 'false'
            ) {
              parsedValue = parsedValue.toLowerCase() === 'true'
            } else if (!isNaN(parsedValue)) {
              if (parsedValue.includes('.')) {
                parsedValue = parseFloat(parsedValue)
              } else {
                parsedValue = parseInt(parsedValue)
              }
            } else if (
              parsedValue.startsWith('"') ||
              parsedValue.startsWith("'")
            ) {
              parsedValue = parsedValue.substring(1, parsedValue.length - 1)
            }

            argObj.options.default = parsedValue
          }

          args.push(argObj)
        }
      })

      const outputs = []

      const returnMatch = funcBody.match(/return\s+([^,\n]+)(?:,\s*([^\n]+))?/)

      if (returnType) {
        const returnTypes = returnType.split(',').map((t) => t.trim())

        returnTypes.forEach((type, index) => {
          let mappedType = typeMapping['Array'] || '1D'
          for (const [pythonType, mappedValue] of Object.entries(typeMapping)) {
            if (type.includes(pythonType)) {
              mappedType = mappedValue
              break
            }
          }

          outputs.push({
            name: index === 0 ? 'data' : `output_${index + 1}`,
            type: mappedType,
            description:
              index === 0
                ? `Output data from ${funcName}`
                : `Output ${index + 1} from ${funcName}`
          })
        })
      } else if (returnMatch) {
        const defaultType = funcName.includes('2d')
          ? typeMapping['Matrix'] || '2D'
          : funcName.includes('3d')
            ? typeMapping['Volume'] || '3D'
            : typeMapping['Array'] || '1D'

        outputs.push({
          name: 'data',
          type: defaultType,
          description: `Output from ${funcName}`
        })

        if (returnMatch[2]) {
          const secondOutput = returnMatch[2].trim()
          const isString =
            secondOutput.startsWith('"') || secondOutput.startsWith("'")

          outputs.push({
            name: isString ? 'text_output' : 'output_2',
            type: isString
              ? typeMapping['str'] || 'STRING'
              : typeMapping['Array'] || '1D',
            description: isString
              ? 'Text output'
              : `Second output from ${funcName}`
          })
        }
      } else {
        const defaultType = funcName.includes('2d')
          ? typeMapping['Matrix'] || '2D'
          : funcName.includes('3d')
            ? typeMapping['Volume'] || '3D'
            : typeMapping['Array'] || '1D'

        outputs.push({
          name: 'data',
          type: defaultType,
          description: `Output from ${funcName}`
        })
      }

      const functionObj = {
        function_name: funcName,
        display_name: funcName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        description: functionDescription,
        input: {
          source: sources,
          args: args
        },
        output: outputs
      }

      result.functions.push(functionObj)
    }

    return result
  }

  getValidateData() {
    return { ...this.validateData }
  }
}

const pythonValidator = new PythonValidator()

export default pythonValidator
