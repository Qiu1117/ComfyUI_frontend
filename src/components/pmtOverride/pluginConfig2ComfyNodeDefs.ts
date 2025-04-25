export function pluginConfig2ComfyNodeDefs(config: any, print = true) {
  const defs = {} as Record<string, any>

  if (!config || !config.functions) {
    return defs
  }

  config.functions.forEach((func: any) => {
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
      func.input?.source.forEach((src: any) => {
        if (!input.required) {
          input.required = {}
        }
        input.required[src.name] = [src.type]
        if (src.options && Object.keys(src.options).length > 0) {
          input.required[src.name].push(src.options)
        }
        if (!input_order.required) {
          input_order.required = []
        }
        input_order.required.push(src.name)
      })
    }
    if (func.input?.args) {
      func.input?.args.forEach((arg: any) => {
        if (!input.optional) {
          input.optional = {}
        }
        input.optional[arg.name] = [arg.type]
        if (arg.options && Object.keys(arg.options).length > 0) {
          input.optional[arg.name].push(arg.options)
        }
        if (!input_order.optional) {
          input_order.optional = []
        }
        input_order.optional.push(arg.name)
      })
    }

    const output = def.output as any
    const output_name = def.output_name as any
    const output_is_list = def.output_is_list as any
    if (func.output) {
      func.output.forEach((out: any) => {
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

export default pluginConfig2ComfyNodeDefs
