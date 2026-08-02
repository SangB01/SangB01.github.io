import type { CardData, GameState } from '../types/game'
import {
  canPlayCard,
  effectiveApCost,
  familyMeta,
  getEffectiveCardEffects,
  resourceIcons,
} from '../game/rules'

interface PolicyCardProps {
  card: CardData
  state: GameState
  selected?: boolean
  compact?: boolean
  onSelect?: (card: CardData) => void
}

export function PolicyCard({
  card,
  state,
  selected = false,
  compact = false,
  onSelect,
}: PolicyCardProps) {
  const validation = canPlayCard(card, state)
  const cost = effectiveApCost(card, state)
  const effects = getEffectiveCardEffects(card, state.resources, state.leader)
  const meta = familyMeta[card.family]

  return (
    <button
      type="button"
      className={`policy-card family-${card.family}${selected ? ' is-selected' : ''}${
        validation.allowed ? '' : ' is-disabled'
      }${compact ? ' is-compact' : ''}`}
      onClick={() => onSelect?.(card)}
      disabled={!validation.allowed && !compact}
      aria-pressed={selected}
      title={!validation.allowed ? validation.reason : card.flavor}
    >
      <span className="card-ornament" aria-hidden="true" />
      <span className="card-topline">
        <span className="family-mark" aria-label={`${meta.label} 계열`}>
          {meta.icon}
        </span>
        <span className={`rarity rarity-${card.rarity}`}>
          {card.rarity === 'legendary' ? '전설' : card.rarity === 'rare' ? '희귀' : meta.label}
        </span>
        <span className="ap-cost" aria-label={`행동력 ${cost}`}>
          {cost}
        </span>
      </span>
      <span className="card-title">{card.name}</span>
      {!compact && <span className="card-flavor">{card.flavor}</span>}
      <span className="card-effects">
        {effects.length === 0 ? (
          <span>{card.description}</span>
        ) : (
          effects.map((effect, index) => (
            <span
              key={`${effect.resource}-${index}`}
              className={effect.amount > 0 ? 'positive' : 'negative'}
            >
              <span aria-hidden="true">{resourceIcons[effect.resource]}</span>{' '}
              {effect.amount > 0 ? '+' : ''}
              {effect.amount}
            </span>
          ))
        )}
      </span>
      {!compact && (
        <span className="card-action-hint">
          {validation.allowed ? '선택하여 미리보기' : validation.reason}
        </span>
      )}
    </button>
  )
}
