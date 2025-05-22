import { pluginConfig2ComfyNodeDefs } from './pluginConfig2ComfyNodeDefs'

// Types definitions
interface DocSections {
  source: string
  args: string
  returns: string
  outputs: string
}

interface DefaultNames {
  textOutput: string
  primaryData: string
  secondaryOutput: (index: number) => string
}

interface DimensionTypeMap {
  [key: string]: {
    pythonType: string
    defaultType: string
  }
}

interface RequiredAttribute {
  name: string
  regex: RegExp
}

interface ConfigType {
  docSections: DocSections
  defaultNames: DefaultNames
  sourceParameterPatterns: ((name: string) => boolean)[]
  dimensionTypeMap: DimensionTypeMap
  requiredAttributes: RequiredAttribute[]
}

interface TypeDefinition {
  typeMapping: { [key: string]: string }
  sourceTypes: Set<string>
}

interface ParamConfig {
  type: string
  default: string | null
  options: any
}

interface OptionParam {
  name: string
  defaultValue: string | null
}

interface OptionsMapping {
  [key: string]: OptionParam[]
}

interface ReturnValueInfo {
  item: string
  varName: string
  isString: boolean
}

interface DocItem {
  name: string
  description: string
}

interface AnnotatedField {
  type: string
  values?: string[]
  optionsClass?: string
  optionsArgs: Record<string, any>
}

interface Source {
  name: string
  type: string
  description: string
  options: Record<string, any>
  behavior: string
  optional: boolean
}

interface Arg {
  name: string
  type: string
  description: string
  options: Record<string, any>
  behavior: string
  optional: boolean
}

interface Output {
  name: string
  type: string
  description: string
  behavior: string
}

interface FunctionObj {
  function_name: string
  display_name: string
  description: string
  input: {
    source: Source[]
    args: Arg[]
  }
  output: Output[]
}

interface ParsedResult {
  plugin_name: string
  description: string
  version: string
  author: string
  functions: FunctionObj[]
}

interface ValidateResult {
  jsonConfig: ParsedResult
  nodeDefs: any
  typeMapping: { [key: string]: string }
  optionsMapping: OptionsMapping
}

// Configuration object for storing configurable parameters and rules
const config: ConfigType = {
  // Document section titles
  docSections: {
    source: 'Source:',
    args: 'Args:',
    returns: 'Returns:',
    outputs: 'Outputs:'
  },

  // Default variable names
  defaultNames: {
    textOutput: 'text_output',
    primaryData: 'data',
    secondaryOutput: (index: number): string => `output_${index + 1}`
  },

  // Parameter naming patterns for identifying source parameters
  sourceParameterPatterns: [
    (name: string): boolean => name === 'data',
    (name: string): boolean => name === 'input_data',
    (name: string): boolean => name.endsWith('_data'),
    (name: string): boolean => name.startsWith('input_'),
    (name: string): boolean => Boolean(name.match(/data\d+/)),
    (name: string): boolean => name.endsWith('_file'),
    (name: string): boolean => name.endsWith('_files'),
    (name: string): boolean => name.includes('series'),
    (name: string): boolean => name.includes('image'),
    (name: string): boolean => name.includes('volume')
  ],

  // Dimension type mapping
  dimensionTypeMap: {
    '2d': { pythonType: 'Matrix', defaultType: '2D' },
    '3d': { pythonType: 'Volume', defaultType: '3D' },
    default: { pythonType: 'Array', defaultType: '1D' }
  },

  // Required Python module attributes
  requiredAttributes: [
    { name: 'DESCRIPTION', regex: /DESCRIPTION\s*=\s*["'].*?["']/s },
    { name: 'VERSION', regex: /VERSION\s*=\s*["'].*?["']/s },
    { name: 'AUTHOR', regex: /AUTHOR\s*=\s*["'].*?["']/s },
    { name: 'EXECUTABLE_FUNCTION', regex: /EXECUTABLE_FUNCTION\s*=\s*\[.*?\]/s }
  ]
}

// Helper function: build regex for document sections
function buildSectionRegex(sectionName: keyof DocSections): RegExp {
  const otherSections = Object.values(config.docSections)
    .filter((s) => s !== config.docSections[sectionName])
    .map((s) => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')) // Escape special characters

  return new RegExp(
    `${config.docSections[sectionName].replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')}\\s*\\n([\\s\\S]*?)(?:\\n\\s*(?:${otherSections.join('|')})|$)`
  )
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export async function extractTypeDefinitions(
  pythonCode: string
): Promise<TypeDefinition> {
  const typeMapping: { [key: string]: string } = {}
  const sourceTypes = new Set<string>()

  // Extract class definitions
  const classRegex = /class\s+(\w+)(?:\(([^)]+)\))?:/g
  let match: RegExpExecArray | null
  while ((match = classRegex.exec(pythonCode)) !== null) {
    const className = match[1]
    typeMapping[className] = className

    // If class name contains FILE or common source types, add to sourceTypes
    if (
      className.includes('FILE') ||
      className === 'Matrix' ||
      className === 'Volume' ||
      className === 'Array' ||
      className === 'Image' ||
      className === 'SERIES' ||
      className === 'DICOM_LIST'
    ) {
      sourceTypes.add(className)
    }
  }

  // Parse special type mapping comment block
  const typeMappingSection = pythonCode.match(
    /'''[\s\S]*?Type used in pipeline[\s\S]*?'''[\s\S]*?$/m
  )

  if (typeMappingSection) {
    const lines = typeMappingSection[0].split('\n')

    for (const line of lines) {
      // Match type mapping format
      const mappingMatch = line.match(
        /\s*(\w+)\s*(?:->|:)\s*(\w+)(?:\s*(?:->|:)\s*(\w+))?/
      )
      if (mappingMatch) {
        const pythonType = mappingMatch[1]
        const finalType = mappingMatch[3] || mappingMatch[2]
        typeMapping[pythonType] = finalType

        // Determine source types
        if (
          finalType.includes('FILE') ||
          finalType.includes('LIST') ||
          pythonType === 'Matrix' ||
          pythonType === 'Volume' ||
          pythonType === 'Array' ||
          pythonType === 'Image' ||
          pythonType === 'Sequence' ||
          pythonType === 'SERIES' ||
          pythonType === 'DICOM_LIST'
        ) {
          sourceTypes.add(pythonType)
        }
      }
    }
  }

  return { typeMapping, sourceTypes }
}

export async function extractOptionDefinitions(
  pythonCode: string
): Promise<OptionsMapping> {
  const optionsMapping: OptionsMapping = {}

  // Find classes with 'Options' suffix
  const optionsClassRegex = /class\s+(\w+)Options\s*:/g
  let match: RegExpExecArray | null

  while ((match = optionsClassRegex.exec(pythonCode)) !== null) {
    const baseType = match[1]

    // Find class body
    const classBodyStart = pythonCode.indexOf(':', match.index) + 1
    const nextClassIndex = pythonCode.indexOf('class ', classBodyStart)
    const classBody = pythonCode.substring(
      classBodyStart,
      nextClassIndex > -1 ? nextClassIndex : pythonCode.length
    )

    // Extract parameters from __init__ method
    const initMatch = classBody.match(
      /def\s+__init__\s*\(\s*self(?:,\s*([^)]+))?\)/
    )

    if (initMatch && initMatch[1]) {
      const params: OptionParam[] = initMatch[1].split(',').map((p: string) => {
        const [name, defaultValue] = p.split('=').map((s: string) => s.trim())
        return { name, defaultValue: defaultValue || null }
      })

      optionsMapping[baseType] = params
    } else {
      optionsMapping[baseType] = []
    }
  }

  return optionsMapping
}

export function parseReturnStatement(
  returnStatement: string
): ReturnValueInfo[] {
  const returnValues: string[] = []
  let currentItem = ''
  let bracketLevel = 0

  for (let i = 0; i < returnStatement.length; i++) {
    const char = returnStatement[i]

    if (char === '(' || char === '[' || char === '{') {
      bracketLevel++
      currentItem += char
    } else if (char === ')' || char === ']' || char === '}') {
      bracketLevel--
      currentItem += char
    } else if (char === ',' && bracketLevel === 0) {
      if (currentItem.trim()) {
        returnValues.push(currentItem.trim())
      }
      currentItem = ''
    } else {
      currentItem += char
    }
  }

  if (currentItem.trim()) {
    returnValues.push(currentItem.trim())
  }

  return returnValues.map((item, index) => {
    const result: ReturnValueInfo = {
      item: item,
      varName: config.defaultNames.secondaryOutput(index),
      isString: item.startsWith('"') || item.startsWith("'")
    }

    const varMatch = item.match(/^\s*(\w+)\s*$/)
    if (varMatch) {
      result.varName = varMatch[1]
    } else if (result.isString) {
      result.varName = config.defaultNames.textOutput
    } else if (item.includes('(') && item.includes(')')) {
      const funcCallMatch = item.match(/^\s*(\w+)\(/)
      if (funcCallMatch) {
        result.varName = `${funcCallMatch[1]}_result`
      }
    } else if (index === 0) {
      result.varName = config.defaultNames.primaryData
    }

    return result
  })
}

export async function validateTypeFile(
  typeFile: File
): Promise<TypeDefinition> {
  if (!typeFile) throw new Error('Type definition file is required')

  const pythonCode = await readFileAsText(typeFile)

  // Check if it contains class definitions and type mapping indicators
  const hasTypeDefinitions =
    /class\s+\w+(?:\(([^)]+)\))?:/g.test(pythonCode) &&
    pythonCode.includes('Type used in pipeline')

  if (!hasTypeDefinitions) {
    throw new Error(
      'This does not appear to be a valid type definition file. Please upload a file containing type definitions.'
    )
  }

  return await extractTypeDefinitions(pythonCode)
}

export async function validateOptionsFile(
  optionsFile: File,
  { typeMapping }: { typeMapping: { [key: string]: string } }
): Promise<OptionsMapping> {
  if (!optionsFile) throw new Error('Options definition file is required')

  if (!typeMapping || Object.keys(typeMapping).length === 0) {
    throw new Error(
      'Valid type definitions are required before validating options file'
    )
  }

  const pythonCode = await readFileAsText(optionsFile)

  const hasOptionsDefinitions = /class\s+\w+Options:/g.test(pythonCode)

  if (!hasOptionsDefinitions) {
    throw new Error(
      'This does not appear to be a valid options definition file. Please upload a file containing option class definitions.'
    )
  }

  return await extractOptionDefinitions(pythonCode)
}

export async function parsePythonToJson(
  pythonCode: string,
  fileName: string,
  { typeMapping, sourceTypes }: TypeDefinition,
  optionsMapping: OptionsMapping
): Promise<ParsedResult> {
  function parseDocSection(section: string | null | undefined): DocItem[] {
    if (!section) return []

    const lines = section.trim().split('\n')
    const items: DocItem[] = []
    let currentItem: DocItem | null = null

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      if (trimmedLine.startsWith('-')) {
        if (currentItem) {
          items.push(currentItem)
        }

        const content = trimmedLine.substring(1).trim()
        const parts = content.split(':')
        const name = parts[0].trim()
        const desc = parts.length > 1 ? parts.slice(1).join(':').trim() : name

        currentItem = { name, description: desc }
      } else if (trimmedLine.includes(':')) {
        if (currentItem) {
          items.push(currentItem)
        }

        const parts = trimmedLine.split(':')
        const name = parts[0].trim()
        const desc = parts.length > 1 ? parts.slice(1).join(':').trim() : name

        currentItem = { name, description: desc }
      } else if (currentItem) {
        currentItem.description += ' ' + trimmedLine
      }
    }

    if (currentItem) {
      items.push(currentItem)
    }

    return items
  }

  const classMatch = pythonCode.match(/class\s+(\w+)\s*:/)
  const pluginName = classMatch ? classMatch[1] : fileName.replace(/\.py$/, '')

  const descriptionMatch = pythonCode.match(
    /DESCRIPTION\s*=\s*["']([^"']*)["']/
  )
  const versionMatch = pythonCode.match(/VERSION\s*=\s*["']([^"']*)["']/)
  const authorMatch = pythonCode.match(/AUTHOR\s*=\s*["']([^"']*)["']/)
  const executableMatch = pythonCode.match(
    /EXECUTABLE_FUNCTION\s*=\s*\[(.*?)\]/
  )

  const description = descriptionMatch ? descriptionMatch[1] : ''
  const version = versionMatch ? versionMatch[1] : ''
  const author = authorMatch ? authorMatch[1] : ''

  let executableFunctions: string[] = []
  if (executableMatch && executableMatch[1]) {
    executableFunctions = executableMatch[1]
      .split(',')
      .map((f) => f.trim().replace(/['"]/g, ''))
      .filter((f) => f)
  }

  const result: ParsedResult = {
    plugin_name: pluginName,
    description: description,
    version: version,
    author: author,
    functions: []
  }

  // Extract annotated fields with special handling for COMBO
  const annotatedFields: Record<string, AnnotatedField> = {}

  const annotatedRegex = /(\w+)(?:_types)?\s*=\s*Annotated\[(\w+),\s*([^)]+)\)/g
  let annotatedMatch: RegExpExecArray | null

  while ((annotatedMatch = annotatedRegex.exec(pythonCode)) !== null) {
    const fieldName = annotatedMatch[1]
    const fieldType = annotatedMatch[2]
    const optionsStr = annotatedMatch[3]

    if (optionsStr.includes('COMBO') && optionsStr.includes('enum_types')) {
      const startIndex = optionsStr.indexOf('[')
      const endIndex = optionsStr.lastIndexOf(']')

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const enumValuesStr = optionsStr.substring(startIndex + 1, endIndex)

        const enumValues = enumValuesStr
          .split(',')
          .map((val) => {
            return val
              .trim()
              .replace(/[\r\n\s]+/g, ' ')
              .replace(/^['"]|['"]$/g, '')
          })
          .filter((val) => val)

        annotatedFields[fieldName] = {
          type: 'COMBO',
          values: enumValues,
          optionsArgs: {}
        }
      }
    } else {
      const optionsClassMatch = optionsStr.match(/(\w+)Options?\(([^)]*)\)/)
      if (optionsClassMatch) {
        const optionsClass = optionsClassMatch[1]
        const optionsArgsStr = optionsClassMatch[2]
        const optionsArgs: Record<string, any> = {}

        const paramRegex = /(\w+)\s*=\s*([^,]+)(?:,|$)/g
        let paramMatch: RegExpExecArray | null

        while ((paramMatch = paramRegex.exec(optionsArgsStr)) !== null) {
          const paramName = paramMatch[1].trim()
          let paramValue: string | number | boolean = paramMatch[2].trim()

          if (
            paramValue.toLowerCase() === 'true' ||
            paramValue.toLowerCase() === 'false'
          ) {
            paramValue = paramValue.toLowerCase() === 'true'
          } else if (!isNaN(Number(paramValue))) {
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
    }
  }

  // Find parameters with _types suffix that might be referenced
  const classBodyMatch = pythonCode.match(
    /class\s+\w+\s*:([\s\S]*?)(?:class|Z)/i
  )
  if (classBodyMatch) {
    const classBody = classBodyMatch[1]
    const paramTypesRegex = /(\w+)_types\s*=\s*[^=]*$/gm
    let paramTypesMatch: RegExpExecArray | null

    while ((paramTypesMatch = paramTypesRegex.exec(classBody)) !== null) {
      const baseParamName = paramTypesMatch[1]
      // Map param_types to param
      if (
        annotatedFields[baseParamName + '_types'] &&
        !annotatedFields[baseParamName]
      ) {
        annotatedFields[baseParamName] =
          annotatedFields[baseParamName + '_types']
      }
    }
  }

  // Process functions
  const funcRegex = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g
  const docstringRegex = /"""([\s\S]*?)"""/

  let match: RegExpExecArray | null
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

    // Using section names from config to build regex
    let outputsSection = docstring.match(
      new RegExp(
        `${config.docSections.outputs.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')}\\s*\\n([\\s\\S]*?)(?:\\n\\s*\\n|$)`
      )
    )
    if (!outputsSection) {
      outputsSection = docstring.match(
        new RegExp(
          `${config.docSections.returns.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')}\\s*\\n([\\s\\S]*?)(?:\\n\\s*\\n|$)`
        )
      )
    }

    const outputVarNames: Record<number, string> = {}
    if (outputsSection) {
      const outputsItems = parseDocSection(outputsSection[1])
      outputsItems.forEach((item, index) => {
        outputVarNames[index] = item.name
      })
    }

    const descLines = docstring.split('\n')
    const functionDescription = descLines.length > 0 ? descLines[0].trim() : ''

    // Using section names from config
    const sourceRegex = buildSectionRegex('source')
    const argsRegex = buildSectionRegex('args')

    const sourceMatch = docstring.match(sourceRegex)
    const argsMatch = docstring.match(argsRegex)

    const sources: Source[] = []
    const args: Arg[] = []

    const paramMap: Record<string, ParamConfig> = {}

    const typeToComboMap: Record<string, AnnotatedField> = {}

    Object.keys(annotatedFields).forEach((key) => {
      if (key.endsWith('_types') && annotatedFields[key].type === 'COMBO') {
        typeToComboMap[key] = annotatedFields[key]
      }
    })

    params.split(',').forEach((p) => {
      const trimParam = p.trim()
      if (trimParam && !trimParam.startsWith('self')) {
        const parts = trimParam.split(':')
        const paramName = parts[0].trim()

        let paramType: string | null = null
        let defaultValue: string | null = null

        if (parts.length > 1) {
          const typeAndDefault = parts[1].split('=')
          paramType = typeAndDefault[0].trim()

          if (typeAndDefault.length > 1) {
            defaultValue = typeAndDefault[1].trim()
          }
        } else if (trimParam.includes('=')) {
          const nameAndDefault = trimParam.split('=')
          defaultValue = nameAndDefault[1].trim()
        }

        if (
          annotatedFields[paramName] &&
          annotatedFields[paramName].type === 'COMBO'
        ) {
          paramMap[paramName] = {
            type: 'COMBO',
            default: defaultValue,
            options: annotatedFields[paramName]
          }
        } else if (paramType && typeToComboMap[paramType]) {
          paramMap[paramName] = {
            type: 'COMBO',
            default: defaultValue,
            options: typeToComboMap[paramType]
          }
        } else {
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
      }
    })

    const sourceParams = new Set<string>()

    // Process source parameters from documentation
    if (sourceMatch) {
      const sourceSection = sourceMatch[1].trim()
      const sourceItems = parseDocSection(sourceSection)

      for (const item of sourceItems) {
        const { name, description } = item

        if (name && paramMap[name]) {
          const type = paramMap[name].type

          sources.push({
            name,
            type,
            description,
            options: paramMap[name]?.options?.optionsArgs || {},
            behavior: 'STATIC',
            optional: false
          })

          sourceParams.add(name)
        }
      }
    }

    // Infer other source parameters by type
    Object.entries(paramMap).forEach(([name, info]) => {
      if (!sourceParams.has(name)) {
        // Use sourceTypes set from config
        if (sourceTypes.has(info.type)) {
          sources.push({
            name,
            type: info.type,
            description: `Input ${name}`,
            options: info.options?.optionsArgs || {},
            behavior: 'STATIC',
            optional: false
          })
          sourceParams.add(name)
        }
        // Use naming patterns from config
        else if (
          config.sourceParameterPatterns.some((pattern) => pattern(name))
        ) {
          sources.push({
            name,
            type: info.type,
            description: `Input ${name}`,
            options: info.options?.optionsArgs || {},
            behavior: 'STATIC',
            optional: false
          })
          sourceParams.add(name)
        }
      }
    })

    // Process args parameters from documentation
    if (argsMatch) {
      const argsSection = argsMatch[1].trim()
      const argsItems = parseDocSection(argsSection)

      for (const item of argsItems) {
        const { name, description } = item

        if (sourceParams.has(name)) continue

        if (name && paramMap[name]) {
          const paramInfo = paramMap[name]

          const argObj: Arg = {
            name,
            type: paramInfo.type,
            description,
            options: {},
            behavior: 'STATIC',
            optional: true
          }

          // Special handling for COMBO type
          if (
            paramInfo.type === 'COMBO' &&
            paramInfo.options &&
            paramInfo.options.values
          ) {
            argObj.options = {
              default: paramInfo.default
                ? paramInfo.default.replace(/['"]/g, '')
                : paramInfo.options.values[0],
              values: paramInfo.options.values
            }
          } else if (paramInfo.options && paramInfo.options.optionsArgs) {
            Object.assign(argObj.options, paramInfo.options.optionsArgs)
          }

          if (paramInfo.default && !argObj.options.default) {
            let parsedValue: string | number | boolean = paramInfo.default
            if (
              parsedValue.toLowerCase() === 'true' ||
              parsedValue.toLowerCase() === 'false'
            ) {
              parsedValue = parsedValue.toLowerCase() === 'true'
            } else if (!isNaN(Number(parsedValue))) {
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
      }
    }

    // Add remaining parameters as args
    Object.entries(paramMap).forEach(([name, info]) => {
      if (!sourceParams.has(name) && !args.find((a) => a.name === name)) {
        const argObj: Arg = {
          name,
          type: info.type,
          description: name,
          options: {},
          behavior: 'STATIC',
          optional: true
        }

        // Special handling for COMBO type
        if (info.type === 'COMBO' && info.options && info.options.values) {
          argObj.options = {
            default: info.default
              ? info.default.replace(/['"]/g, '')
              : info.options.values[0],
            values: info.options.values
          }
        } else if (info.options && info.options.optionsArgs) {
          Object.assign(argObj.options, info.options.optionsArgs)
        }

        if (info.default && !argObj.options.default) {
          let parsedValue: string | number | boolean = info.default
          if (
            parsedValue.toLowerCase() === 'true' ||
            parsedValue.toLowerCase() === 'false'
          ) {
            parsedValue = parsedValue.toLowerCase() === 'true'
          } else if (!isNaN(Number(parsedValue))) {
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

    const outputs: Output[] = []

    // Extract return statements
    const returnLines: string[] = []
    const returnRegex = /return\s+(.+?)(?:\n|$)/g
    let returnLineMatch: RegExpExecArray | null

    while ((returnLineMatch = returnRegex.exec(funcBody)) !== null) {
      returnLines.push(returnLineMatch[1].trim())
    }

    // Get the last return statement
    const returnLine =
      returnLines.length > 0 ? returnLines[returnLines.length - 1] : null

    if (returnType) {
      // Use type annotation to determine return type
      const returnTypes = returnType.split(',').map((t) => t.trim())

      returnTypes.forEach((type, index) => {
        let mappedType = typeMapping['Array'] || '1D'
        for (const [pythonType, mappedValue] of Object.entries(typeMapping)) {
          if (type.includes(pythonType)) {
            mappedType = mappedValue
            break
          }
        }

        let outputName = outputVarNames[index] || null

        if (!outputName && returnLine) {
          const returnValues = parseReturnStatement(returnLine)
          if (returnValues.length > index) {
            outputName = returnValues[index].varName
          }
        }

        if (!outputName) {
          outputName =
            index === 0
              ? config.defaultNames.primaryData
              : config.defaultNames.secondaryOutput(index)
        }

        outputs.push({
          name: outputName,
          type: mappedType,
          description:
            index === 0
              ? `Output data from ${funcName}`
              : `Output ${index + 1} from ${funcName}`,
          behavior: 'STATIC'
        })
      })
    } else if (returnLine) {
      // No type annotation, but we have a return statement
      const returnValues = parseReturnStatement(returnLine)

      returnValues.forEach((returnValue, index) => {
        const outputName = outputVarNames[index] || returnValue.varName

        // Determine output type
        let outputType
        if (returnValue.isString) {
          outputType = typeMapping['str'] || 'STRING'
        } else if (index === 0) {
          // Use dimension hints in function name to infer type
          const dimKey = funcName.includes('2d')
            ? '2d'
            : funcName.includes('3d')
              ? '3d'
              : 'default'

          const defaultMapConfig = config.dimensionTypeMap[dimKey]
          outputType =
            typeMapping[defaultMapConfig.pythonType] ||
            defaultMapConfig.defaultType
        } else {
          if (
            returnValue.item.toLowerCase().includes('text') ||
            returnValue.item.startsWith('f"') ||
            returnValue.item.startsWith("f'")
          ) {
            outputType = typeMapping['str'] || 'STRING'
          } else {
            outputType = typeMapping['Array'] || '1D'
          }
        }

        outputs.push({
          name: outputName,
          type: outputType,
          description:
            index === 0
              ? `Output data from ${funcName}`
              : returnValue.isString
                ? 'Text output'
                : `Output ${index + 1} from ${funcName}`,
          behavior: 'STATIC'
        })
      })
    } else {
      // If no return type or statement found, use default output
      const dimKey = funcName.includes('2d')
        ? '2d'
        : funcName.includes('3d')
          ? '3d'
          : 'default'

      const defaultMapConfig = config.dimensionTypeMap[dimKey]
      const defaultType =
        typeMapping[defaultMapConfig.pythonType] || defaultMapConfig.defaultType

      outputs.push({
        name: config.defaultNames.primaryData,
        type: defaultType,
        description: `Output from ${funcName}`,
        behavior: 'STATIC'
      })
    }

    const functionObj: FunctionObj = {
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

export async function validatePythonFile(
  pythonFile: File,
  { typeMapping, sourceTypes }: TypeDefinition,
  optionsMapping: OptionsMapping
): Promise<ParsedResult> {
  if (!pythonFile) throw new Error('Python file is required')

  if (!typeMapping || Object.keys(typeMapping).length === 0) {
    throw new Error(
      'Valid type definitions are required before validating Python file'
    )
  }

  if (!optionsMapping || Object.keys(optionsMapping).length === 0) {
    throw new Error(
      'Valid options definitions are required before validating Python file'
    )
  }

  const pythonCode = await readFileAsText(pythonFile)

  const hasClassDefinition = /class\s+\w+\s*:/g.test(pythonCode)
  const hasFunctionDefinition = /def\s+\w+\s*\(/g.test(pythonCode)

  if (!hasClassDefinition || !hasFunctionDefinition) {
    throw new Error(
      'This does not appear to be a valid Python module. Please upload a file containing class and function definitions.'
    )
  }

  // Check required attributes
  const missingAttributes: string[] = []
  for (const attr of config.requiredAttributes) {
    if (!attr.regex.test(pythonCode)) {
      missingAttributes.push(attr.name)
    }
  }

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
    const foundFunctions = new Set<string>()
    const missingDocumentation: string[] = []

    let functionMatch: RegExpExecArray | null
    while ((functionMatch = functionDocRegex.exec(pythonCode)) !== null) {
      const funcName = functionMatch[1]
      const docString = functionMatch[2]

      if (executableFunctions.includes(funcName)) {
        foundFunctions.add(funcName)

        const hasSourceSection = new RegExp(
          config.docSections.source.replace(
            /([.*+?^=!:${}()|[\]/\\])/g,
            '\\$1'
          ) + '\\s*\\n',
          'i'
        ).test(docString)
        const hasArgsSection = new RegExp(
          config.docSections.args.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1') +
            '\\s*\\n',
          'i'
        ).test(docString)

        if (!hasSourceSection || !hasArgsSection) {
          missingDocumentation.push(
            `${funcName} (missing: ${!hasSourceSection ? config.docSections.source.replace(':', '') : ''}${!hasSourceSection && !hasArgsSection ? ', ' : ''}${!hasArgsSection ? config.docSections.args.replace(':', '') : ''})`
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

  return await parsePythonToJson(
    pythonCode,
    pythonFile.name,
    { typeMapping, sourceTypes },
    optionsMapping
  )
}

export async function validatePythonPlugin(
  typeFile: File,
  optionsFile: File,
  pythonFile: File
): Promise<ValidateResult> {
  const { typeMapping, sourceTypes } = await validateTypeFile(typeFile)
  const optionsMapping = await validateOptionsFile(optionsFile, { typeMapping })
  const jsonConfig = await validatePythonFile(
    pythonFile,
    { typeMapping, sourceTypes },
    optionsMapping
  )
  const nodeDefs = pluginConfig2ComfyNodeDefs(jsonConfig, false)

  return {
    jsonConfig,
    nodeDefs,
    typeMapping,
    optionsMapping
  }
}
