import { $ } from 'bun'

const modelIndex = await fetch('https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json')
    .then(res => res.json())

const modelList = Object.entries(modelIndex).map(([name, model]) => {
    return { name, model: model as any }
})

const providerMapping = {
    'vertex-ai': ['vertex_ai-text-models', 'vertex_ai-chat-models', 'vertex_ai-code-text-models', 'vertex_ai-language-models', 'vertex_ai-vision-models', 'vertex_ai-embedding-models'],
} as Record<string, string[]>

const blockList = ['palm', 'gemini']

const modelPerProvider = modelList.reduce((acc, { model, name }) => {
    const {
        litellm_provider,
    } = model

    if (blockList.includes(litellm_provider)
        || !['chat', 'completion', 'embedding'].includes(model.mode)
    )
        return acc

    const provider = Object.keys(providerMapping).find(provider => providerMapping[provider].includes(litellm_provider)) ?? litellm_provider

    if (!acc[provider])
        acc[provider] = []

    const structured = {
        maxTokens: model.max_tokens ?? null,
        name,
        type: model.mode,
        inputCost: model.input_cost_per_token ?? model.input_cost_per_request ?? model.input_cost_per_pixel ?? null,
        inputCostUnit: model.input_cost_per_token
            ? 'token'
            : model.input_cost_per_request
                ? 'request'
                : model.input_cost_per_pixel
                    ? 'pixel'
                    : null,
        outputCost: model.output_cost_per_token ?? model.output_cost_per_request ?? model.output_cost_per_image ?? null,
        outputCostUnit: model.output_cost_per_token
            ? 'token'
            : model.output_cost_per_request
                ? 'request'
                : model.output_cost_per_image
                    ? 'image'
                    : null,

    }

    acc[provider].push(structured)

    return acc
}, {} as Record<string, any>)

const providerTypeUnion = Object.keys(modelPerProvider).map(provider => `'${provider}'`).join(' | ')

let modelListFileContent = `export type AICostModelProvider = ${providerTypeUnion}\n\n`

const modelPerProviderContent = JSON.stringify(modelPerProvider, null, 4)

modelListFileContent += `// Generated from LiteLLM\nexport const AICostModelList = ${modelPerProviderContent} as const`

const oldModelListFileContent = (await Bun.file('src/model-list.ts').text()).split('\n').slice(2).join('\n').trim()

if (oldModelListFileContent !== modelListFileContent) {
    modelListFileContent = `// Last updated: ${new Date().toISOString()}\n\n${modelListFileContent}`
    await $`echo ${modelListFileContent} > src/model-list.ts`
} else {
    console.log('No changes detected!')
}
