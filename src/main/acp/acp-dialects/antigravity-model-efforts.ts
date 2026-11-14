import type { AcpDialect } from './acp-dialect'

const EFFORT_LABELS: Readonly<Record<string, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra'
}

// Grouped config IDs and suffixed model IDs describe the same account-scoped catalog.
export const antigravityModelEfforts: NonNullable<AcpDialect['groupedModelEfforts']> = (
  modelId,
  availableModels,
  currentEfforts
) => {
  if (currentEfforts !== undefined) {
    return { efforts: [...currentEfforts] }
  }
  const offered = new Set<string>()
  const prefix = `${modelId}-`
  for (const variant of availableModels) {
    if (!variant.modelId.startsWith(prefix)) {
      continue
    }
    const level = variant.modelId.slice(prefix.length)
    if (Object.hasOwn(EFFORT_LABELS, level)) {
      offered.add(level)
    }
  }
  return {
    efforts: Object.entries(EFFORT_LABELS).flatMap(([value, label]) =>
      offered.has(value) ? [{ value, label }] : []
    ),
    ...(offered.size === 0 ? { effortsKnown: false as const } : {})
  }
}
