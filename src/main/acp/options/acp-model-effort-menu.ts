import type { AcpDialect } from '../acp-dialects/acp-dialect'
import type { ModelInfo } from '../generated/acp-protocol.generated'
import type {
  AgentSessionModelOption,
  AgentSessionOptionChoice
} from '../../../shared/agent-session/agent-session-wire'

export function acpModelEffortMenu({
  dialect,
  modelId,
  availableModels,
  currentModel,
  sessionEfforts,
  hasEffortMenu,
  hasSessionMenus
}: {
  dialect: Pick<AcpDialect, 'modelEfforts' | 'groupedModelEfforts'>
  modelId: string
  availableModels: readonly ModelInfo[]
  currentModel?: string
  sessionEfforts: AgentSessionOptionChoice[]
  hasEffortMenu: boolean
  hasSessionMenus: boolean
}): Pick<
  AgentSessionModelOption,
  'efforts' | 'effortsKnown' | 'defaultEffort' | 'declaredDefaultEffort'
> {
  const info = availableModels.find((entry) => entry.modelId === modelId)
  const advertised =
    (info ? dialect.modelEfforts?.(info) : undefined) ??
    dialect.groupedModelEfforts?.(
      modelId,
      availableModels,
      modelId === currentModel && hasEffortMenu ? sessionEfforts : undefined
    )
  // A current-session menu supplies no negative evidence about an unobserved model.
  const sessionMenu =
    modelId === currentModel
      ? { efforts: sessionEfforts }
      : hasSessionMenus && !advertised
        ? { efforts: [], effortsKnown: false as const }
        : { efforts: [] }
  return {
    ...(advertised && (advertised.efforts.length > 0 || modelId !== currentModel)
      ? advertised
      : sessionMenu),
    ...(advertised?.declaredDefaultEffort !== undefined
      ? { declaredDefaultEffort: advertised.declaredDefaultEffort }
      : {})
  }
}
