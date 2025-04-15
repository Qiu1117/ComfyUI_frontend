/**
 * 定义各种类型
 */
type ReturnValueAnalysis = {
  item: string
  varName: string
  isString: boolean
}

type PluginOutput = {
  name: string
  type: string
  description: string
}

type PluginArg = {
  name: string
  type: string
  description: string
  options: Record<string, any>
}

type PluginSource = {
  name: string
  type: string
  description: string
  options: Record<string, any>
}

type PluginFunction = {
  function_name: string
  display_name: string
  description: string
  input: {
    source: PluginSource[]
    args: PluginArg[]
  }
  output: PluginOutput[]
}

type PluginConfig = {
  plugin_name: string
  description: string
  version: string
  author: string
  functions: PluginFunction[]
}

type TypeMapping = Record<string, string>
type OptionsMapping = Record<
  string,
  Array<{ name: string; defaultValue: string | null }>
>

type ValidationResult = {
  jsonConfig: PluginConfig
  nodeDefs: Record<string, any>
  typeMapping: TypeMapping
  optionsMapping: OptionsMapping
}

/**
 * 读取文件内容为文本
 * @param file 文件对象
 * @returns 文件内容
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * 从Python代码中提取类型定义
 * @param pythonCode Python代码
 * @returns 类型映射
 */
export async function extractTypeDefinitions(
  pythonCode: string
): Promise<TypeMapping> {
  const classRegex = /class\s+(\w+)(?:\(([^)]+)\))?:/g
  const typeMapping: TypeMapping = {}

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
      const mappingMatch = line.match(/\s*(\w+)\s*->\s*(\w+)(?:\s*->\s*(\w+))?/)
      if (mappingMatch) {
        const pythonType = mappingMatch[1]
        const finalType = mappingMatch[3] || mappingMatch[2]
        typeMapping[pythonType] = finalType
      }
    }
  }

  return typeMapping
}

/**
 * 从Python代码中提取选项定义
 * @param pythonCode Python代码
 * @returns 选项映射
 */
export async function extractOptionDefinitions(
  pythonCode: string
): Promise<OptionsMapping> {
  const classRegex = /class\s+(\w+)Options:/g
  const optionsMapping: OptionsMapping = {}

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

/**
 * 解析return语句，提取返回值和变量名
 * @param returnStatement return语句
 * @returns 解析后的返回值数组
 */
export function parseReturnStatement(
  returnStatement: string
): ReturnValueAnalysis[] {
  const returnValues: string[] = []
  let currentItem = ''
  let bracketLevel = 0

  // 首先分离返回值
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

  // 添加最后一项
  if (currentItem.trim()) {
    returnValues.push(currentItem.trim())
  }

  // 分析每个返回值
  return returnValues.map((item, index) => {
    const result: ReturnValueAnalysis = {
      item: item,
      varName: `output_${index + 1}`, // 默认名称
      isString: item.startsWith('"') || item.startsWith("'")
    }

    // 检查是否为简单变量名
    const varMatch = item.match(/^\s*(\w+)\s*$/)
    if (varMatch) {
      result.varName = varMatch[1]
      console.log(
        `Extracted variable name '${result.varName}' from return value: ${item}`
      )
    } else if (result.isString) {
      result.varName = 'text_output'
    } else if (item.includes('(') && item.includes(')')) {
      // 可能是函数调用
      const funcCallMatch = item.match(/^\s*(\w+)\(/)
      if (funcCallMatch) {
        result.varName = `${funcCallMatch[1]}_result`
      }
    } else if (index === 0) {
      result.varName = 'data'
    }

    return result
  })
}

/**
 * 验证类型定义文件
 * @param typeFile 类型定义文件
 * @returns 提取的类型映射
 * @throws {Error} 如果文件无效
 */
export async function validateTypeFile(typeFile: File): Promise<TypeMapping> {
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

/**
 * 验证选项定义文件
 * @param optionsFile 选项定义文件
 * @param typeMapping 类型映射
 * @returns 提取的选项映射
 * @throws {Error} 如果文件无效
 */
export async function validateOptionsFile(
  optionsFile: File,
  typeMapping: TypeMapping
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

/**
 * 解析Python文件为JSON配置
 * @param pythonCode Python代码
 * @param fileName 文件名
 * @param typeMapping 类型映射
 * @param optionsMapping 选项映射
 * @returns 解析后的JSON配置
 */
export async function parsePythonToJson(
  pythonCode: string,
  fileName: string,
  typeMapping: TypeMapping,
  optionsMapping: OptionsMapping
): Promise<PluginConfig> {
  const classRegex = /class\s+(\w+)\s*:/
  const classMatch = pythonCode.match(classRegex)
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
  const version = versionMatch ? versionMatch[1] : '0.1.0'
  const author = authorMatch ? authorMatch[1] : ''

  let executableFunctions: string[] = []
  if (executableMatch && executableMatch[1]) {
    executableFunctions = executableMatch[1]
      .split(',')
      .map((f) => f.trim().replace(/['"]/g, ''))
      .filter((f) => f)
  }

  const result: PluginConfig = {
    plugin_name: pluginName,
    description: description,
    version: version,
    author: author,
    functions: []
  }

  interface AnnotatedField {
    type: string
    optionsClass: string
    optionsArgs: Record<string, any>
  }

  const annotatedFields: Record<string, AnnotatedField> = {}
  const annotatedRegex =
    /(\w+)_with_options\s*=\s*Annotated\[(\w+),\s*(\w+)Options\(([^)]*)\)\]/g
  let annotatedMatch

  while ((annotatedMatch = annotatedRegex.exec(pythonCode)) !== null) {
    const fieldName = annotatedMatch[1]
    const fieldType = annotatedMatch[2]
    const optionsClass = annotatedMatch[3]
    const optionsArgsStr = annotatedMatch[4]

    const optionsArgs: Record<string, any> = {}

    const paramRegex = /(\w+)\s*=\s*([^,]+)(?:,|$)/g
    let paramMatch

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

    // 先尝试查找Outputs部分，如果没有再尝试查找Returns部分
    let outputsSection = docstring.match(/Outputs:\s*\n([\s\S]*?)(?:\n\s*\n|$)/)

    // 如果没有找到Outputs部分，尝试查找Returns部分
    if (!outputsSection) {
      outputsSection = docstring.match(/Returns:\s*\n([\s\S]*?)(?:\n\s*\n|$)/)
    }

    const outputsInfo = outputsSection
      ? outputsSection[1].trim().split('\n')
      : []

    // 创建一个变量名映射表，记录docstring中定义的输出变量名
    const outputVarNames: Record<number, string> = {}

    // 解析Outputs/Returns部分来找到变量名
    outputsInfo.forEach((line, index) => {
      const outputLine = line.trim()
      const parts = outputLine.split(':')
      if (parts.length > 0) {
        const name = parts[0].trim()
        // 将在docstring中找到的变量名按顺序存储
        outputVarNames[index] = name
        console.log(
          `Found output variable from docs: ${name} at position ${index}`
        )
      }
    })

    const descLines = docstring.split('\n')
    const functionDescription = descLines.length > 0 ? descLines[0].trim() : ''

    const sourceRegex =
      /Source:\s*\n([\s\S]*?)(?:\n\s*Args:|\n\s*Returns:|\n\s*Outputs:|$)/
    const argsRegex = /Args:\s*\n([\s\S]*?)(?:\n\s*Returns:|\n\s*Outputs:|$)/

    const sourceMatch = docstring.match(sourceRegex)
    const argsMatch = docstring.match(argsRegex)

    const sources: PluginSource[] = []
    const args: PluginArg[] = []

    interface ParamInfo {
      type: string
      default: string | null
      options: AnnotatedField | null
    }

    const paramMap: Record<string, ParamInfo> = {}
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

    const sourceParams = new Set<string>()

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
      let currentArg: PluginArg | null = null
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

              let parsedValue: any = value
              if (
                value.toLowerCase() === 'true' ||
                value.toLowerCase() === 'false'
              ) {
                parsedValue = value.toLowerCase() === 'true'
              } else if (!isNaN(Number(value))) {
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
            const nameMatch = argLine.substring(2).match(/^(\w+)(?::\s*(.+))?$/)

            if (nameMatch) {
              const name = nameMatch[1].trim()
              const desc = nameMatch[2] ? nameMatch[2].trim() : name

              if (sourceParams.has(name)) {
                continue
              }

              const paramInfo = paramMap[name] || {
                type: typeMapping['str'] || 'STRING',
                default: null,
                options: null
              }

              currentArg = {
                name,
                type: paramInfo.type,
                description: desc,
                options: {}
              }

              if (paramInfo.options && paramInfo.options.optionsArgs) {
                Object.assign(currentArg.options, paramInfo.options.optionsArgs)
              }

              if (paramInfo.default) {
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
        const argObj: PluginArg = {
          name,
          type: info.type,
          description: name,
          options: {}
        }

        if (info.options && info.options.optionsArgs) {
          Object.assign(argObj.options, info.options.optionsArgs)
        }

        if (info.default) {
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

    const outputs: PluginOutput[] = []

    // 首先尝试查找返回语句
    const returnLines: string[] = []
    const returnRegex = /return\s+(.+?)(?:\n|$)/g
    let returnLineMatch

    while ((returnLineMatch = returnRegex.exec(funcBody)) !== null) {
      returnLines.push(returnLineMatch[1].trim())
    }

    // 找出最后一个return语句（通常是函数的实际返回值）
    const returnLine =
      returnLines.length > 0 ? returnLines[returnLines.length - 1] : null

    if (returnType) {
      // 使用类型注解来确定返回类型
      const returnTypes = returnType.split(',').map((t) => t.trim())

      returnTypes.forEach((type, index) => {
        let mappedType = typeMapping['Array'] || '1D'
        for (const [pythonType, mappedValue] of Object.entries(typeMapping)) {
          if (type.includes(pythonType)) {
            mappedType = mappedValue
            break
          }
        }

        // 尝试从Outputs/Returns文档部分获取变量名
        let outputName = outputVarNames[index] || null

        if (!outputName && returnLine) {
          // 如果我们有return语句，尝试从中提取变量名
          const returnValues = parseReturnStatement(returnLine)
          if (returnValues.length > index) {
            outputName = returnValues[index].varName
          }
        }

        // 如果仍然没有找到名称，使用默认值
        if (!outputName) {
          outputName = index === 0 ? 'data' : `output_${index + 1}`
        }

        outputs.push({
          name: outputName,
          type: mappedType,
          description:
            index === 0
              ? `Output data from ${funcName}`
              : `Output ${index + 1} from ${funcName}`
        })
      })
    } else if (returnLine) {
      // 没有类型注解，但有return语句
      const returnValues = parseReturnStatement(returnLine)

      console.log(`Parsed return values:`, returnValues)

      returnValues.forEach((returnValue, index) => {
        // 尝试从Outputs/Returns文档部分获取更好的输出名称
        const outputName = outputVarNames[index] || returnValue.varName

        // 确定输出类型
        let outputType
        if (returnValue.isString) {
          outputType = typeMapping['str'] || 'STRING'
        } else if (index === 0) {
          // 根据函数名推断第一个返回值的类型
          outputType = funcName.includes('2d')
            ? typeMapping['Matrix'] || '2D'
            : funcName.includes('3d')
              ? typeMapping['Volume'] || '3D'
              : typeMapping['Array'] || '1D'
        } else {
          // 为其他返回值尝试更智能的类型推断
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
                : `Output ${index + 1} from ${funcName}`
        })
      })
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

    const functionObj: PluginFunction = {
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

/**
 * 验证Python文件并生成JSON配置
 * @param pythonFile Python文件
 * @param typeMapping 类型映射
 * @param optionsMapping 选项映射
 * @returns 生成的JSON配置
 * @throws {Error} 如果文件无效
 */
export async function validatePythonFile(
  pythonFile: File,
  typeMapping: TypeMapping,
  optionsMapping: OptionsMapping
): Promise<PluginConfig> {
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
    const foundFunctions = new Set<string>()
    const missingDocumentation: string[] = []

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

  return await parsePythonToJson(
    pythonCode,
    pythonFile.name,
    typeMapping,
    optionsMapping
  )
}

/**
 * 将插件配置转换为ComfyUI节点定义
 * @param config 插件配置
 * @param print 是否打印结果
 * @returns ComfyUI节点定义
 */
export function pluginConfig2ComfyNodeDefs(
  config: PluginConfig,
  print = true
): Record<string, any> {
  const defs: Record<string, any> = {}

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

    const input = def.input as any
    const input_order = def.input_order as any
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

    const output = def.output as any[]
    const output_name = def.output_name as any[]
    const output_is_list = def.output_is_list as boolean[]
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

/**
 * 完整的Python文件验证流程，处理所有三个文件并返回结果
 * @param typeFile 类型定义文件
 * @param optionsFile 选项定义文件
 * @param pythonFile Python文件
 * @returns 解析后的配置结果和节点定义
 * @throws {Error} 如果任何验证步骤失败
 */
export async function validatePythonPlugin(
  typeFile: File,
  optionsFile: File,
  pythonFile: File
): Promise<ValidationResult> {
  // 验证类型定义文件
  const typeMapping = await validateTypeFile(typeFile)

  // 验证选项定义文件
  const optionsMapping = await validateOptionsFile(optionsFile, typeMapping)

  // 验证Python文件并生成JSON
  const jsonConfig = await validatePythonFile(
    pythonFile,
    typeMapping,
    optionsMapping
  )

  // 生成ComfyUI节点定义
  const nodeDefs = pluginConfig2ComfyNodeDefs(jsonConfig, false)

  return {
    jsonConfig,
    nodeDefs,
    typeMapping,
    optionsMapping
  }
}
