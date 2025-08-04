import { pluginConfig2ComfyNodeDefs } from './pluginConfig2ComfyNodeDefs'

interface Config {
  docSections: {
    source: string
    args: string
    returns: string
    outputs: string
  }
  defaultNames: {
    textOutput: string
    primaryData: string
    secondaryOutput: (index: number) => string
  }
  sourceParameterPatterns: ((name: string) => boolean)[]
  dimensionTypeMap: {
    [key: string]: {
      pythonType: string
      defaultType: string
    }
  }
  requiredAttributes: {
    name: string
    regex: RegExp
  }[]
}

interface AnnotatedField {
  type: string
  baseType?: string
  values?: string[]
  optionsClass?: string
  optionsArgs?: Record<string, any>
}

interface ParamInfo {
  type: string
  default: string | null
  options: any
}

interface ReturnValue {
  item: string
  varName: string
  isString: boolean
}

interface DocItem {
  name: string
  description: string
}

interface TypeDefinitions {
  typeMapping: Record<string, string>
  sourceTypes: Set<string>
}

const config: Config = {
  docSections: {
    source: 'Source:',
    args: 'Args:',
    returns: 'Returns:',
    outputs: 'Outputs:'
  },

  defaultNames: {
    textOutput: 'text_output',
    primaryData: 'data',
    secondaryOutput: (index: number) => `output_${index + 1}`
  },

  sourceParameterPatterns: [
    (name: string) => name === 'data',
    (name: string) => name === 'input_data',
    (name: string) => name.endsWith('_data'),
    (name: string) => name.startsWith('input_'),
    (name: string) => Boolean(name.match(/data\d+/)),
    (name: string) => name.endsWith('_file'),
    (name: string) => name.endsWith('_files'),
    (name: string) => name.includes('series'),
    (name: string) => name.includes('image'),
    (name: string) => name.includes('volume')
  ],

  dimensionTypeMap: {
    '2d': { pythonType: 'Matrix', defaultType: '2D' },
    '3d': { pythonType: 'Volume', defaultType: '3D' },
    default: { pythonType: 'Array', defaultType: '1D' }
  },

  requiredAttributes: [
    { name: 'DESCRIPTION', regex: /DESCRIPTION\s*=\s*["'].*?["']/s },
    { name: 'VERSION', regex: /VERSION\s*=\s*["'].*?["']/s },
    { name: 'AUTHOR', regex: /AUTHOR\s*=\s*["'].*?["']/s },
    { name: 'EXECUTABLE_FUNCTION', regex: /EXECUTABLE_FUNCTION\s*=\s*\[.*?\]/s }
  ]
}

function buildSectionRegex(sectionName: string): RegExp {
  const otherSections = Object.values(config.docSections)
    .filter(
      (s) =>
        s !== config.docSections[sectionName as keyof typeof config.docSections]
    )
    .map((s) => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1'))

  return new RegExp(
    `${config.docSections[sectionName as keyof typeof config.docSections].replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')}\\s*\\n([\\s\\S]*?)(?:\\n\\s*(?:${otherSections.join('|')})|$)`
  )
}

function parseTupleTypes(tupleContent: string): string[] {
  const types: string[] = []
  let current = ''
  let bracketLevel = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < tupleContent.length; i++) {
    const char = tupleContent[i]
    const prevChar = i > 0 ? tupleContent[i - 1] : ''

    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
    }

    if (!inString) {
      if (char === '[' || char === '(' || char === '{') {
        bracketLevel++
      } else if (char === ']' || char === ')' || char === '}') {
        bracketLevel--
      } else if (char === ',' && bracketLevel === 0) {
        if (current.trim()) {
          types.push(current.trim())
        }
        current = ''
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    types.push(current.trim())
  }

  return types
}

function generateOutputNamesFromReturnType(
  returnType: string,
  typeMapping: Record<string, string>
): string[] {
  const outputs: string[] = []

  const getOutputName = (cleanType: string, index: number): string => {
    const mappedType = typeMapping[cleanType]

    if (!mappedType) {
      throw new Error(
        `Unknown type: ${cleanType}. Please ensure this type is defined in your type mapping file.`
      )
    }

    // Use the mapped type directly as base name, or provide reasonable defaults
    let baseName = mappedType.toLowerCase()

    // For special cases, adjust the name
    if (mappedType === '2D') {
      baseName = config.defaultNames.primaryData
    } else if (mappedType.includes('FILE')) {
      baseName = 'file'
    } else if (mappedType.includes('LIST')) {
      baseName = 'list'
    }

    return index === 0
      ? baseName
      : baseName === config.defaultNames.primaryData
        ? config.defaultNames.secondaryOutput(index)
        : `${baseName}_${index + 1}`
  }

  if (returnType.includes('Tuple')) {
    const tupleMatch = returnType.match(/Tuple\[(.*)\]/)
    if (tupleMatch) {
      const types = parseTupleTypes(tupleMatch[1])
      types.forEach((type, index) => {
        outputs.push(getOutputName(type.trim(), index))
      })
    }
  } else {
    outputs.push(getOutputName(returnType.trim(), 0))
  }

  return outputs
}

function generateDefaultDocumentation(
  funcName: string,
  parameters: string[],
  returnType: string,
  { typeMapping, sourceTypes }: TypeDefinitions
): string {
  const lines = [`${funcName.replace(/_/g, ' ')}`]

  const sourceParams = parameters.filter((p) => {
    const paramName = p.split(':')[0].trim()
    if (paramName === 'self') return false

    const typeMatch = p.match(/:(\w+)/)
    if (typeMatch && sourceTypes.has(typeMatch[1])) return true

    return config.sourceParameterPatterns.some((pattern) => pattern(paramName))
  })

  if (sourceParams.length > 0) {
    lines.push('', 'Source:')
    sourceParams.forEach((p) => {
      const paramName = p.split(':')[0].trim()
      lines.push(`    ${paramName}: default`)
    })
  }

  const argParams = parameters.filter((p) => {
    const paramName = p.split(':')[0].trim()
    if (paramName === 'self') return false
    return !sourceParams.some((sp) => sp.split(':')[0].trim() === paramName)
  })

  if (argParams.length > 0) {
    lines.push('', 'Args:')
    argParams.forEach((p) => {
      const paramName = p.split(':')[0].trim()
      lines.push(`    ${paramName}: default`)
    })
  }

  lines.push('', 'Outputs:')

  if (returnType) {
    const outputNames = generateOutputNamesFromReturnType(
      returnType,
      typeMapping
    )
    outputNames.forEach((name) => {
      lines.push(`    ${name}: default`)
    })
  } else {
    lines.push(`    ${config.defaultNames.primaryData}: default`)
  }

  return lines.join('\n        ')
}

function parseDocSection(section: string | null): DocItem[] {
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
      const desc =
        parts.length > 1 ? parts.slice(1).join(':').trim() : 'default'

      currentItem = { name, description: desc }
    } else if (trimmedLine.includes(':')) {
      if (currentItem) {
        items.push(currentItem)
      }

      const parts = trimmedLine.split(':')
      const name = parts[0].trim()
      const desc =
        parts.length > 1 ? parts.slice(1).join(':').trim() : 'default'

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

function fixDocumentation(
  pythonCode: string,
  { typeMapping, sourceTypes }: TypeDefinitions
): string {
  const funcRegex =
    /def\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^:]+))?:\s*("""[\s\S]*?"""|'''[\s\S]*?'''|)/g

  return pythonCode.replace(
    funcRegex,
    (match, funcName, paramString, returnType, docstring) => {
      if (funcName === '__init__' || funcName.startsWith('_')) {
        return match
      }

      const parameters: string[] = []
      let currentParam = ''
      let bracketLevel = 0
      let inString = false
      let stringChar = ''

      for (let i = 0; i < paramString.length; i++) {
        const char = paramString[i]
        const prevChar = i > 0 ? paramString[i - 1] : ''

        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true
            stringChar = char
          } else if (char === stringChar) {
            inString = false
          }
        }

        if (!inString) {
          if (char === '[' || char === '(') {
            bracketLevel++
          } else if (char === ']' || char === ')') {
            bracketLevel--
          } else if (char === ',' && bracketLevel === 0) {
            if (currentParam.trim()) {
              parameters.push(currentParam.trim())
            }
            currentParam = ''
            continue
          }
        }

        currentParam += char
      }

      if (currentParam.trim()) {
        parameters.push(currentParam.trim())
      }

      const finalReturnType = returnType ? returnType.trim() : ''

      let needsFixing = false
      let existingDoc = ''

      if (
        !docstring ||
        docstring.trim() === '""""""' ||
        docstring.trim() === "''''''"
      ) {
        needsFixing = true
      } else {
        existingDoc = docstring.replace(/^("""|''')|("""|''')$/g, '').trim()

        const sourceRegex = buildSectionRegex('source')
        const argsRegex = buildSectionRegex('args')
        const outputsRegex = buildSectionRegex('outputs')

        const sourceMatch = existingDoc.match(sourceRegex)
        const argsMatch = existingDoc.match(argsRegex)
        const outputsMatch = existingDoc.match(outputsRegex)

        const sourceParams = parameters.filter((p) => {
          const paramName = p.split(':')[0].trim()
          if (paramName === 'self') return false

          const typeMatch = p.match(/:(\w+)/)
          if (typeMatch && sourceTypes.has(typeMatch[1])) return true

          return config.sourceParameterPatterns.some((pattern) =>
            pattern(paramName)
          )
        })

        const argParams = parameters.filter((p) => {
          const paramName = p.split(':')[0].trim()
          if (paramName === 'self') return false
          return !sourceParams.some(
            (sp) => sp.split(':')[0].trim() === paramName
          )
        })

        if (sourceParams.length > 0) {
          if (!sourceMatch) {
            needsFixing = true
          } else {
            const documentedSources = parseDocSection(sourceMatch[1])
            const documentedSourceNames = new Set(
              documentedSources.map((d) => d.name)
            )
            const actualSourceNames = new Set(
              sourceParams.map((p) => p.split(':')[0].trim())
            )

            if (
              documentedSourceNames.size !== actualSourceNames.size ||
              ![...actualSourceNames].every((name) =>
                documentedSourceNames.has(name)
              )
            ) {
              needsFixing = true
            }
          }
        }

        if (argParams.length > 0) {
          if (!argsMatch) {
            needsFixing = true
          } else {
            const documentedArgs = parseDocSection(argsMatch[1])
            const documentedArgNames = new Set(
              documentedArgs.map((d) => d.name)
            )
            const actualArgNames = new Set(
              argParams.map((p) => p.split(':')[0].trim())
            )

            if (
              documentedArgNames.size !== actualArgNames.size ||
              ![...actualArgNames].every((name) => documentedArgNames.has(name))
            ) {
              needsFixing = true
            }
          }
        }

        if (finalReturnType && !outputsMatch) {
          needsFixing = true
        }
      }

      if (needsFixing) {
        const newDoc = generateDefaultDocumentation(
          funcName,
          parameters,
          finalReturnType,
          { typeMapping, sourceTypes }
        )
        const functionDef = `def ${funcName}(${paramString})${returnType ? ` -> ${returnType}` : ''}:`
        return `${functionDef}\n        """\n        ${newDoc}\n        """`
      }

      return match
    }
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
): Promise<TypeDefinitions> {
  const typeMapping: Record<string, string> = {}
  const sourceTypes = new Set<string>()

  const classRegex = /class\s+(\w+)(?:\(([^)]+)\))?:/g
  let match: RegExpExecArray | null
  while ((match = classRegex.exec(pythonCode)) !== null) {
    const className = match[1]
    typeMapping[className] = className

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

  const typeMappingSection = pythonCode.match(
    /'''[\s\S]*?Type used in pipeline[\s\S]*?'''/
  )

  if (typeMappingSection) {
    const lines = typeMappingSection[0].split('\n')

    for (const line of lines) {
      const mappingMatch = line.match(
        /\s*(\w+)\s*->\s*(?:[\w.]+\s*->)?\s*(\w+)/
      )
      if (mappingMatch) {
        const pythonType = mappingMatch[1]
        const finalType = mappingMatch[2]
        typeMapping[pythonType] = finalType

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
): Promise<
  Record<string, Array<{ name: string; defaultValue: string | null }>>
> {
  const optionsMapping: Record<
    string,
    Array<{ name: string; defaultValue: string | null }>
  > = {}

  const optionsClassRegex = /class\s+(\w+)Options\s*:/g
  let match: RegExpExecArray | null

  while ((match = optionsClassRegex.exec(pythonCode)) !== null) {
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

export function parseReturnStatement(returnStatement: string): ReturnValue[] {
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
    const trimmedItem = item.trim()
    const result: ReturnValue = {
      item: trimmedItem,
      varName:
        index === 0
          ? config.defaultNames.primaryData
          : config.defaultNames.secondaryOutput(index - 1),
      isString:
        trimmedItem.startsWith('"') ||
        trimmedItem.startsWith("'") ||
        trimmedItem.startsWith('f"') ||
        trimmedItem.startsWith("f'") ||
        Boolean(trimmedItem.match(/^[\w_]+_txt$/)) ||
        Boolean(trimmedItem.match(/^[\w_]*text[\w_]*$/))
    }

    // Simple variable name (like "data" or "test_txt")
    const varMatch = trimmedItem.match(/^(\w+)$/)
    if (varMatch) {
      result.varName = varMatch[1]
    } else if (result.isString) {
      result.varName = config.defaultNames.textOutput
    }

    return result
  })
}

export async function validateTypeFile(
  typeFile: File
): Promise<TypeDefinitions> {
  if (!typeFile) throw new Error('Type definition file is required')

  const pythonCode = await readFileAsText(typeFile)

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
  { typeMapping }: { typeMapping: Record<string, string> }
): Promise<
  Record<string, Array<{ name: string; defaultValue: string | null }>>
> {
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
  { typeMapping, sourceTypes }: TypeDefinitions,
  optionsMapping: Record<
    string,
    Array<{ name: string; defaultValue: string | null }>
  >
): Promise<any> {
  function parseDocSection(section: string | null): DocItem[] {
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

  interface FunctionDefinition {
    function_name: string
    display_name: string
    description: string
    input: {
      source: any[]
      args: any[]
    }
    output: any[]
  }

  const result = {
    plugin_name: pluginName,
    description: description,
    version: version,
    author: author,
    functions: [] as FunctionDefinition[]
  }

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
          baseType: fieldType,
          values: enumValues,
          optionsArgs: {}
        }
      }
    } else {
      const optionsClassMatch = optionsStr.match(/(\w+)Options?\(([^)]*)/)
      if (optionsClassMatch) {
        const optionsType = optionsClassMatch[1]
        const optionsArgsStr = optionsClassMatch[2]
        const optionsArgs: Record<string, any> = {}

        const paramRegex = /(\w+)\s*=\s*([^,]+)(?:,|$)/g
        let paramMatch: RegExpExecArray | null

        while ((paramMatch = paramRegex.exec(optionsArgsStr)) !== null) {
          const paramName = paramMatch[1].trim()
          let paramValue: any = paramMatch[2].trim()

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

        let mappedType = optionsType
        for (const [pythonType, mappedValue] of Object.entries(typeMapping)) {
          if (fieldType === pythonType) {
            mappedType = mappedValue
            break
          }
        }

        annotatedFields[fieldName] = {
          type: mappedType,
          baseType: optionsType,
          optionsArgs
        }
      }
    }
  }

  const classBodyMatch = pythonCode.match(
    /class\s+\w+\s*:([\s\S]*?)(?:class|Z)/i
  )
  if (classBodyMatch) {
    const classBody = classBodyMatch[1]
    const paramTypesRegex = /(\w+)_types\s*=\s*[^=]*$/gm
    let paramTypesMatch: RegExpExecArray | null

    while ((paramTypesMatch = paramTypesRegex.exec(classBody)) !== null) {
      const baseParamName = paramTypesMatch[1]
      if (
        annotatedFields[baseParamName + '_types'] &&
        !annotatedFields[baseParamName]
      ) {
        annotatedFields[baseParamName] =
          annotatedFields[baseParamName + '_types']
      }
    }
  }

  const funcRegex = /def\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^:]+))?:/g
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

    const paramString = match[2].trim()
    const parameters: string[] = []
    let currentParam = ''
    let bracketLevel = 0
    let inString = false
    let stringChar = ''

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i]
      const prevChar = i > 0 ? paramString[i - 1] : ''

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
      }

      if (!inString) {
        if (char === '[' || char === '(') {
          bracketLevel++
        } else if (char === ']' || char === ')') {
          bracketLevel--
        } else if (char === ',' && bracketLevel === 0) {
          if (currentParam.trim()) {
            parameters.push(currentParam.trim())
          }
          currentParam = ''
          continue
        }
      }

      currentParam += char
    }

    if (currentParam.trim()) {
      parameters.push(currentParam.trim())
    }

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

    const sourceRegex = buildSectionRegex('source')
    const argsRegex = buildSectionRegex('args')

    const sourceMatch = docstring.match(sourceRegex)
    const argsMatch = docstring.match(argsRegex)

    const sources: any[] = []
    const args: any[] = []

    const paramMap: Record<string, ParamInfo> = {}

    const typeToComboMap: Record<string, any> = {}

    Object.keys(annotatedFields).forEach((key) => {
      if (key.endsWith('_types') && annotatedFields[key].type === 'COMBO') {
        typeToComboMap[key] = annotatedFields[key]
      }
    })

    parameters.forEach((p) => {
      const trimParam = p.trim()
      if (trimParam && !trimParam.startsWith('self')) {
        const inlineAnnotatedMatch = trimParam.match(
          /(\w+):\s*Annotated\[([^,]+),\s*(\w+Options?\([^)]*\))\](?:\s*=\s*(.+))?/
        )

        if (inlineAnnotatedMatch) {
          const paramName = inlineAnnotatedMatch[1].trim()
          const baseType = inlineAnnotatedMatch[2].trim()
          const optionsStr = inlineAnnotatedMatch[3].trim()
          const defaultValue = inlineAnnotatedMatch[4]
            ? inlineAnnotatedMatch[4].trim()
            : null

          const optionsArgs: Record<string, any> = {}
          const paramRegex = /(\w+)\s*=\s*([^,)]+)/g
          let paramMatch: RegExpExecArray | null

          while ((paramMatch = paramRegex.exec(optionsStr)) !== null) {
            const argName = paramMatch[1].trim()
            let argValue: any = paramMatch[2].trim()

            if (!isNaN(Number(argValue))) {
              argValue = argValue.includes('.')
                ? parseFloat(argValue)
                : parseInt(argValue)
            }

            optionsArgs[argName] = argValue
          }

          let mappedType = baseType
          for (const [pythonType, mappedValue] of Object.entries(typeMapping)) {
            if (baseType === pythonType) {
              mappedType = mappedValue
              break
            }
          }

          paramMap[paramName] = {
            type: mappedType,
            default: defaultValue,
            options: { optionsArgs }
          }
        } else {
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

          if (paramType && annotatedFields[paramType]) {
            paramMap[paramName] = {
              type: annotatedFields[paramType].type,
              default: defaultValue,
              options: annotatedFields[paramType]
            }
          } else if (
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
            for (const [pythonType, mappedValue] of Object.entries(
              typeMapping
            )) {
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
      }
    })

    const sourceParams = new Set<string>()

    if (sourceMatch) {
      const sourceSection = sourceMatch[1].trim()
      const sourceItems = parseDocSection(sourceSection)

      for (const item of sourceItems) {
        const { name, description } = item

        // Find actual parameter name that matches the documented name
        const actualParam = Object.keys(paramMap).find((paramName) => {
          // Check if documented name matches parameter name directly
          if (paramName === name) return true

          // Check if parameter has source type
          const paramInfo = paramMap[paramName]
          return (
            sourceTypes.has(paramInfo.type) ||
            config.sourceParameterPatterns.some((pattern) => pattern(paramName))
          )
        })

        if (actualParam && paramMap[actualParam]) {
          const type = paramMap[actualParam].type

          sources.push({
            name: actualParam, // Use actual parameter name
            type,
            description,
            options: paramMap[actualParam]?.options?.optionsArgs || {},
            behavior: 'STATIC',
            optional: false
          })

          sourceParams.add(actualParam)
        }
      }
    }

    Object.entries(paramMap).forEach(([name, info]) => {
      if (!sourceParams.has(name)) {
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
        } else if (
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

    if (argsMatch) {
      const argsSection = argsMatch[1].trim()
      const argsItems = parseDocSection(argsSection)

      for (const item of argsItems) {
        const { name, description } = item

        if (sourceParams.has(name)) continue

        if (name && paramMap[name]) {
          const paramInfo = paramMap[name]

          const argObj: any = {
            name,
            type: paramInfo.type,
            description,
            options: {},
            behavior: 'STATIC',
            optional: true
          }

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
            let parsedValue: any = paramInfo.default
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

    Object.entries(paramMap).forEach(([name, info]) => {
      if (!sourceParams.has(name) && !args.find((a) => a.name === name)) {
        const argObj: any = {
          name,
          type: info.type,
          description: name,
          options: {},
          behavior: 'STATIC',
          optional: true
        }

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
          let parsedValue: any = info.default
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

    const outputs: any[] = []

    // Parse outputs section from documentation
    const outputsRegex = buildSectionRegex('outputs')

    if (!outputsSection) {
      const returnsRegex = buildSectionRegex('returns')
      outputsSection = docstring.match(returnsRegex)
    }

    const documentedOutputs: DocItem[] = []
    if (outputsSection) {
      documentedOutputs.push(...parseDocSection(outputsSection[1]))
    }

    const returnLines: string[] = []
    const returnRegex = /return\s+([^;]+)/g
    let returnLineMatch: RegExpExecArray | null

    while ((returnLineMatch = returnRegex.exec(funcBody)) !== null) {
      const returnStatement = returnLineMatch[1].trim()
      // Clean up the return statement by removing trailing comments and extra whitespace
      const cleaned = returnStatement.split('\n')[0].trim()
      if (cleaned) {
        returnLines.push(cleaned)
      }
    }

    if (returnType) {
      if (returnType.includes('Tuple') || returnType.includes('tuple')) {
        const tupleMatch = returnType.match(/(?:Tuple|tuple)\[(.*)\]/)
        if (tupleMatch) {
          const types = parseTupleTypes(tupleMatch[1])
          types.forEach((type, index) => {
            const cleanType = type.trim()
            const mappedType = typeMapping[cleanType] || cleanType

            // Use return statement variable name
            console.log(returnLines)
            let outputName: string
            if (returnLines.length > 0) {
              const returnValues = parseReturnStatement(
                returnLines[returnLines.length - 1]
              )
              console.log(returnValues, index)
              outputName =
                returnValues[index]?.varName ||
                (index === 0
                  ? config.defaultNames.primaryData
                  : config.defaultNames.secondaryOutput(index - 1))
            } else {
              outputName =
                index === 0
                  ? config.defaultNames.primaryData
                  : config.defaultNames.secondaryOutput(index)
            }

            // Match with documented outputs for description
            let description = `Output ${outputName} from ${funcName}`
            const matchedDoc = documentedOutputs.find(
              (doc) => doc.name === outputName
            )
            if (matchedDoc) {
              description = matchedDoc.description
            }

            outputs.push({
              name: outputName,
              type: mappedType,
              description: description,
              behavior: 'STATIC'
            })
          })
        }
      } else {
        const cleanType = returnType.trim()
        const mappedType = typeMapping[cleanType] || cleanType

        let outputName = config.defaultNames.primaryData
        if (returnLines.length > 0) {
          const returnValues = parseReturnStatement(
            returnLines[returnLines.length - 1]
          )
          outputName =
            returnValues[0]?.varName || config.defaultNames.primaryData
        }

        let description = `Output ${outputName} from ${funcName}`
        const matchedDoc = documentedOutputs.find(
          (doc) => doc.name === outputName
        )
        if (matchedDoc) {
          description = matchedDoc.description
        }

        outputs.push({
          name: outputName,
          type: mappedType,
          description: description,
          behavior: 'STATIC'
        })
      }
    } else {
      // No return type annotation, parse return statement directly
      if (returnLines.length > 0) {
        const returnLine = returnLines[returnLines.length - 1]
        const returnValues = parseReturnStatement(returnLine)

        returnValues.forEach((returnValue, index) => {
          const outputName = returnValue.varName

          let outputType: string
          if (returnValue.isString) {
            outputType = typeMapping['str'] || 'STRING'
          } else {
            outputType =
              index === 0
                ? typeMapping['Matrix'] || '2D'
                : typeMapping['Array'] || '1D'
          }

          let description = `Output ${outputName} from ${funcName}`
          const matchedDoc = documentedOutputs.find(
            (doc) => doc.name === outputName
          )
          if (matchedDoc) {
            description = matchedDoc.description
          }

          outputs.push({
            name: outputName,
            type: outputType,
            description: description,
            behavior: 'STATIC'
          })
        })
      } else {
        const outputName = config.defaultNames.primaryData
        let description = `Output from ${funcName}`
        const matchedDoc = documentedOutputs.find(
          (doc) => doc.name === outputName
        )
        if (matchedDoc) {
          description = matchedDoc.description
        }

        outputs.push({
          name: outputName,
          type: typeMapping['Matrix'] || '2D',
          description: description,
          behavior: 'STATIC'
        })
      }
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

export async function validatePythonFile(
  pythonFile: File,
  { typeMapping, sourceTypes }: TypeDefinitions,
  optionsMapping: Record<
    string,
    Array<{ name: string; defaultValue: string | null }>
  >
): Promise<any> {
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

  let pythonCode = await readFileAsText(pythonFile)

  pythonCode = fixDocumentation(pythonCode, { typeMapping, sourceTypes })

  const hasClassDefinition = /class\s+\w+\s*:/g.test(pythonCode)
  const hasFunctionDefinition = /def\s+\w+\s*\(/g.test(pythonCode)

  if (!hasClassDefinition || !hasFunctionDefinition) {
    throw new Error(
      'This does not appear to be a valid Python module. Please upload a file containing class and function definitions.'
    )
  }

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
      /def\s+(\w+)\s*\([\s\S]*?\)(?:\s*->\s*[\s\S]*?)?:\s*(?:"""|''')([\s\S]*?)(?:"""|''')/g
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

        if (!hasSourceSection) {
          missingDocumentation.push(
            `${funcName} (missing: ${config.docSections.source.replace(':', '')})`
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
): Promise<{
  jsonConfig: any
  nodeDefs: any
  typeMapping: Record<string, string>
  optionsMapping: Record<
    string,
    Array<{ name: string; defaultValue: string | null }>
  >
}> {
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
