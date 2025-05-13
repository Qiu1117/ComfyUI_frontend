export async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export async function extractTypeDefinitions(pythonCode) {
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

export async function extractOptionDefinitions(pythonCode) {
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

export function parseReturnStatement(returnStatement) {
  const returnValues = []
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
    const result = {
      item: item,
      varName: `output_${index + 1}`,
      isString: item.startsWith('"') || item.startsWith("'")
    }

    const varMatch = item.match(/^\s*(\w+)\s*$/)
    if (varMatch) {
      result.varName = varMatch[1]
      console.log(
        `Extracted variable name '${result.varName}' from return value: ${item}`
      )
    } else if (result.isString) {
      result.varName = 'text_output'
    } else if (item.includes('(') && item.includes(')')) {
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

export async function validateTypeFile(typeFile) {
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

export async function validateOptionsFile(optionsFile, typeMapping) {
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
  pythonCode,
  fileName,
  typeMapping,
  optionsMapping
) {
  // 解析文档字符串中的部分（Source、Args、Outputs）
  function parseDocSection(section) {
    if (!section) return []

    const lines = section.trim().split('\n')
    const items = []

    let currentItem = null

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // 处理以"-"开头的条目（Google风格）
      if (trimmedLine.startsWith('-')) {
        if (currentItem) {
          items.push(currentItem)
        }

        const content = trimmedLine.substring(1).trim()
        const parts = content.split(':')
        const name = parts[0].trim()
        const desc = parts.length > 1 ? parts.slice(1).join(':').trim() : name

        currentItem = { name, description: desc }
      }
      // 处理直接以名称开头的条目（标准模式）
      else if (trimmedLine.includes(':')) {
        if (currentItem) {
          items.push(currentItem)
        }

        const parts = trimmedLine.split(':')
        const name = parts[0].trim()
        const desc = parts.length > 1 ? parts.slice(1).join(':').trim() : name

        currentItem = { name, description: desc }
      }
      // 处理当前条目的继续行
      else if (currentItem) {
        currentItem.description += ' ' + trimmedLine
      }
    }

    if (currentItem) {
      items.push(currentItem)
    }

    return items
  }

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
  const version = versionMatch ? versionMatch[1] : ''
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

    // 先尝试查找Outputs部分，如果没有再尝试查找Returns部分
    let outputsSection = docstring.match(/Outputs:\s*\n([\s\S]*?)(?:\n\s*\n|$)/)

    // 如果没有找到Outputs部分，尝试查找Returns部分
    if (!outputsSection) {
      outputsSection = docstring.match(/Returns:\s*\n([\s\S]*?)(?:\n\s*\n|$)/)
    }

    // 创建一个变量名映射表，记录docstring中定义的输出变量名
    const outputVarNames = {}

    // 解析Outputs/Returns部分来找到变量名
    if (outputsSection) {
      const outputsItems = parseDocSection(outputsSection[1])

      outputsItems.forEach((item, index) => {
        outputVarNames[index] = item.name
        console.log(
          `Found output variable from docs: ${item.name} at position ${index}`
        )
      })
    }

    const descLines = docstring.split('\n')
    let functionDescription = descLines.length > 0 ? descLines[0].trim() : ''

    const sourceRegex =
      /Source:\s*\n([\s\S]*?)(?:\n\s*Args:|\n\s*Returns:|\n\s*Outputs:|$)/
    const argsRegex = /Args:\s*\n([\s\S]*?)(?:\n\s*Returns:|\n\s*Outputs:|$)/

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
            behavior: 'STATIC', // 添加behavior字段
            optional: false
          })

          sourceParams.add(name)
          console.log(`Found source parameter: ${name}`)
        }
      }
    }

    // 源类型集合 - 用于通过类型识别源参数
    const sourceTypes = new Set([
      'DICOM_FILE',
      'IMAGE_FILE',
      'CSV_FILE',
      'EXCEL_FILE',
      'DATA_FILE',
      'Matrix',
      'Volume',
      'Array',
      'Image',
      'Sequence',
      'FILE',
      'FILES'
    ])

    // 通过参数类型推断源参数
    Object.entries(paramMap).forEach(([name, info]) => {
      if (!sourceParams.has(name)) {
        // 通过类型判断是否为源参数
        if (sourceTypes.has(info.type)) {
          sources.push({
            name,
            type: info.type,
            description: `Input ${name}`,
            options: info.options?.optionsArgs || {},
            behavior: 'STATIC', // 添加behavior字段
            optional: false
          })
          sourceParams.add(name)
          console.log(
            `Inferred source parameter from type: ${name} (${info.type})`
          )
        }
        // 通过命名模式判断是否为源参数
        else if (
          name === 'data' ||
          name === 'input_data' ||
          name.endsWith('_data') ||
          name.startsWith('input_') ||
          name.match(/data\d+/) ||
          name.endsWith('_file') ||
          name.endsWith('_files') ||
          name.includes('series') ||
          name.includes('image') ||
          name.includes('volume')
        ) {
          sources.push({
            name,
            type: info.type,
            description: `Input ${name}`,
            options: info.options?.optionsArgs || {},
            behavior: 'STATIC', // 添加behavior字段
            optional: false
          })
          sourceParams.add(name)
          console.log(`Inferred source parameter from name: ${name}`)
        }
      }
    })

    if (argsMatch) {
      const argsSection = argsMatch[1].trim()
      const argsItems = parseDocSection(argsSection)

      for (const item of argsItems) {
        const { name, description } = item

        // 跳过已经标记为源参数的
        if (sourceParams.has(name)) {
          continue
        }

        if (name && paramMap[name]) {
          const paramInfo = paramMap[name]

          const argObj = {
            name,
            type: paramInfo.type,
            description,
            options: {},
            behavior: 'STATIC',
            optional: true
          }

          if (paramInfo.options && paramInfo.options.optionsArgs) {
            Object.assign(argObj.options, paramInfo.options.optionsArgs)
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
              parsedValue = parsedValue.substring(1, parsedValue.length - 1)
            }

            argObj.options.default = parsedValue
          }

          args.push(argObj)
          console.log(`Found args parameter: ${name}`)
        }
      }
    }

    Object.entries(paramMap).forEach(([name, info]) => {
      if (!sourceParams.has(name) && !args.find((a) => a.name === name)) {
        const argObj = {
          name,
          type: info.type,
          description: name,
          options: {},
          behavior: 'STATIC',
          optional: true
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

    // 首先尝试查找返回语句
    const returnLines = []
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
              : `Output ${index + 1} from ${funcName}`,
          behavior: 'STATIC'
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
                : `Output ${index + 1} from ${funcName}`,
          behavior: 'STATIC'
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
        description: `Output from ${funcName}`,
        behavior: 'STATIC'
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

export async function validatePythonFile(
  pythonFile,
  typeMapping,
  optionsMapping
) {
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

  return await parsePythonToJson(
    pythonCode,
    pythonFile.name,
    typeMapping,
    optionsMapping
  )
}

export function pluginConfig2ComfyNodeDefs(config, print = true) {
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

export async function validatePythonPlugin(typeFile, optionsFile, pythonFile) {
  const typeMapping = await validateTypeFile(typeFile)
  const optionsMapping = await validateOptionsFile(optionsFile, typeMapping)
  const jsonConfig = await validatePythonFile(
    pythonFile,
    typeMapping,
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
