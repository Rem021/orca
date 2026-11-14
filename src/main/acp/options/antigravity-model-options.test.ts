import { expect, it } from 'vitest'
import { ANTIGRAVITY_ACP_DIALECT } from '../acp-dialects/antigravity-dialect'
import type { SessionConfigOption } from '../generated/acp-protocol.generated'
import { AcpStructuredOptions } from './acp-structured-options'

it('reads grouped Gemini effort menus from native variants while respecting the active menu', () => {
  const configOptions: SessionConfigOption[] = [
    {
      id: 'model',
      name: 'Model',
      type: 'select',
      category: 'model',
      currentValue: 'gemini-4-carbon',
      options: [
        { value: 'gemini-4-carbon', name: 'Carbon' },
        { value: 'gemini-4-hydrogen', name: 'Hydrogen' },
        { value: 'gemini-4-argon', name: 'Argon' },
        { value: 'unadvertised', name: 'Unadvertised' }
      ]
    },
    {
      id: 'thinking_level',
      name: 'Thinking Level',
      type: 'select',
      category: 'thought_level',
      currentValue: 'high',
      options: [{ value: 'high', name: 'High' }]
    }
  ]
  const options = new AcpStructuredOptions(ANTIGRAVITY_ACP_DIALECT)
  options.adoptSession({
    configOptions,
    models: {
      currentModelId: 'gemini-4-carbon-high',
      availableModels: [
        'gemini-4-carbon-low',
        'gemini-4-carbon-medium',
        'gemini-4-carbon-high',
        'gemini-4-hydrogen-high',
        'gemini-4-hydrogen-low',
        'gemini-4-hydrogen-xhigh',
        'gemini-4-hydrogen-medium',
        'gemini-4-argon-low',
        'gemini-4-argon-medium',
        'gemini-4-argon-high',
        'gemini-4-argon-xhigh-preview',
        'gemini-4-argon-other-high'
      ].map((modelId) => ({ modelId, name: modelId }))
    }
  })
  expect(
    options.read().models.map(({ id, efforts, effortsKnown }) => ({
      id,
      efforts: efforts.map(({ value }) => value),
      effortsKnown
    }))
  ).toEqual([
    { id: 'gemini-4-carbon', efforts: ['high'], effortsKnown: undefined },
    {
      id: 'gemini-4-hydrogen',
      efforts: ['low', 'medium', 'high', 'xhigh'],
      effortsKnown: undefined
    },
    { id: 'gemini-4-argon', efforts: ['low', 'medium', 'high'], effortsKnown: undefined },
    { id: 'unadvertised', efforts: [], effortsKnown: false }
  ])

  options.adoptConfigOptions(
    configOptions.map((option) =>
      option.category === 'thought_level' ? { ...option, options: [] } : option
    )
  )
  expect(options.read().models[0]).toMatchObject({ id: 'gemini-4-carbon', efforts: [] })
})
