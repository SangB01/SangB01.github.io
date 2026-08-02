import type { CardData, GameState } from '../types/game'
import { PolicyCard } from './PolicyCard'

interface RewardModalProps {
  state: GameState
  onSelect: (card: CardData) => void
  onOpenRemove: () => void
  onRemove: (cardId: string) => void
}

export function RewardModal({
  state,
  onSelect,
  onOpenRemove,
  onRemove,
}: RewardModalProps) {
  const uniqueCards = Array.from(
    new Map(
      [...state.hand, ...state.drawPile, ...state.discardPile].map((card) => [
        card.name,
        card,
      ]),
    ).values(),
  )
  const counts = [...state.hand, ...state.drawPile, ...state.discardPile].reduce<
    Record<string, number>
  >((result, card) => {
    result[card.name] = (result[card.name] ?? 0) + 1
    return result
  }, {})

  return (
    <div className="modal-backdrop reward-backdrop" role="dialog" aria-modal="true">
      <section className="reward-modal">
        <p className="eyebrow">
          {state.turn === 5 ? '중간 위기 특별 포상' : `제 ${state.turn}주 정책 보상`}
        </p>
        <h2>{state.rewardMode === 'choose' ? '새 정책을 선택하십시오' : '폐기할 정책을 선택하십시오'}</h2>
        <p className="modal-lead">
          {state.rewardMode === 'choose'
            ? state.turn === 5
              ? '왕국의 방향을 바꿀 전설 정책 한 장을 덱에 추가합니다.'
              : '선택한 카드는 버린 카드 더미에 들어가 다음 순환부터 등장합니다.'
            : '선택한 카드 한 장을 이번 게임의 덱에서 영구히 제거합니다.'}
        </p>

        {state.rewardMode === 'choose' ? (
          <>
            <div className="reward-grid">
              {state.rewardChoices.map((card) => (
                <PolicyCard
                  card={card}
                  key={card.id}
                  state={state}
                  compact
                  onSelect={onSelect}
                />
              ))}
            </div>
            <button type="button" className="text-button policy-discard" onClick={onOpenRemove}>
              새 카드를 받지 않고 기존 정책 폐기
            </button>
          </>
        ) : (
          <div className="remove-list">
            {uniqueCards.map((card) => (
              <button
                type="button"
                key={card.id}
                onClick={() => onRemove(card.id)}
              >
                <span>{card.name}</span>
                <small>{card.description}</small>
                <b>보유 {counts[card.name]}장</b>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
