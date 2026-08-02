import { eventCategoryMeta } from '../data/events'
import {
  canAffordEffects,
  formatEffects,
  getDisplayRequirement,
  getRequirementPayment,
  getSatisfiedRequirement,
} from '../game/rules'
import type { GameState } from '../types/game'

interface EventPanelProps {
  state: GameState
  onChoice: (choiceId: string) => void
}

export function EventPanel({ state, onChoice }: EventPanelProps) {
  const event = state.currentEvent
  if (!event) return null
  const meta = eventCategoryMeta[event.category]
  const requirement = getSatisfiedRequirement(event, state)
  const autoWin =
    event.category === 'invasion' && state.modifiers.autoWinInvasion
  const forecastSuccess = Boolean(requirement) || autoWin
  const selectedChoice = event.choices?.find(
    (choice) => choice.id === state.selectedChoiceId,
  )

  return (
    <article
      className={`event-panel category-${event.category}${
        event.isCrisis ? ' is-crisis' : ''
      }`}
    >
      <div className="event-heading">
        <span className="event-category">
          <span aria-hidden="true">{meta.icon}</span> {meta.label}
        </span>
        {event.isCrisis && (
          <span className="crisis-label">{event.isFinal ? '최종 위기' : '중간 위기'}</span>
        )}
      </div>
      <div className="event-seal" aria-hidden="true">
        {meta.icon}
      </div>
      <p className="eyebrow">제 {state.turn}주 · 왕실 긴급 보고</p>
      <h1>{event.name}</h1>
      <p className="event-description">{event.description}</p>

      <div className="requirement-box">
        <span>해결 조건</span>
        <strong>{getDisplayRequirement(event, state)}</strong>
      </div>

      {event.choices ? (
        <div className="event-choices" aria-label="사건 선택지">
          {event.choices.map((choice) => {
            const affordable = canAffordEffects(state.resources, choice.effects)
            const selected = choice.id === state.selectedChoiceId
            return (
              <button
                key={choice.id}
                type="button"
                className={selected ? 'is-selected' : ''}
                disabled={Boolean(state.selectedChoiceId) || !affordable}
                onClick={() => onChoice(choice.id)}
              >
                <span>{selected ? '결정됨 · ' : ''}{choice.label}</span>
                <small>{choice.description}</small>
                {!affordable && <em>금화가 부족합니다</em>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className={`forecast ${forecastSuccess ? 'success' : 'failure'}`}>
          <span>{forecastSuccess ? '현재 해결 가능' : '현재 실패 예상'}</span>
          <strong>
            {forecastSuccess
              ? `${event.successText}${requirement?.payment?.length ? ` · ${formatEffects(getRequirementPayment(event, requirement, state))}` : ''}`
              : event.failureText}
          </strong>
        </div>
      )}

      {selectedChoice && (
        <p className="choice-confirmation">
          “{selectedChoice.label}”이 기록되었습니다. 이제 정책을 더 시행하거나 주를
          마칠 수 있습니다.
        </p>
      )}
    </article>
  )
}
