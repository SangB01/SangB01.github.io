import { finalCrises, midCrises, normalEvents } from '../data/events'
import { legendaryCards, standardRewardCards } from '../data/cards'
import type {
  CardData,
  CardFamily,
  EventData,
  GameState,
  LeaderId,
  RequirementOption,
  ResourceEffect,
  ResourceKey,
  Resources,
} from '../types/game'

export const resourceLabels: Record<ResourceKey, string> = {
  food: '식량',
  morale: '민심',
  defense: '국방',
  gold: '금화',
}

export const resourceIcons: Record<ResourceKey, string> = {
  food: '♨',
  morale: '♥',
  defense: '♜',
  gold: '◆',
}

export const familyMeta: Record<
  CardFamily,
  { label: string; icon: string; short: string }
> = {
  economy: { label: '경제', icon: '◇', short: '상업' },
  welfare: { label: '복지', icon: '♥', short: '구휼' },
  military: { label: '군사', icon: '♜', short: '방위' },
  tactics: { label: '책략', icon: '◐', short: '계책' },
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function createEventQueue(): EventData[] {
  const queue: EventData[] = []
  const used = new Set<string>()
  for (const turn of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const candidates = shuffle(
      normalEvents.filter(
        (event) =>
          !used.has(event.id) &&
          (event.minTurn ?? 1) <= turn &&
          (event.maxTurn ?? 10) >= turn &&
          !(
            queue.at(-1)?.category === event.category &&
            queue.at(-2)?.category === event.category
          ),
      ),
    )
    const chosen = candidates[0]
    if (chosen) {
      queue.push(chosen)
      used.add(chosen.id)
    }
  }

  return [...queue.slice(0, 4), shuffle(midCrises)[0], ...queue.slice(4)]
}

export function effectiveApCost(card: CardData, state: GameState): number {
  if (state.modifiers.freeNextCard) return 0
  const leaderReduction = state.leader === 'strategist' && card.family === 'tactics' ? 1 : 0
  return Math.max(0, card.apCost - leaderReduction)
}

function addOrMergeEffect(effects: ResourceEffect[], effect: ResourceEffect) {
  const existing = effects.find((item) => item.resource === effect.resource)
  if (existing) existing.amount += effect.amount
  else effects.push({ ...effect })
}

export function getEffectiveCardEffects(
  card: CardData,
  resources: Resources,
  leader: LeaderId,
): ResourceEffect[] {
  const effects = card.effects.map((effect) => ({ ...effect }))

  if (card.id.startsWith('trade-treaty') && resources.food >= 5) {
    addOrMergeEffect(effects, { resource: 'gold', amount: 1 })
  }
  if (card.special === 'openGranary' && resources.morale <= 3) {
    addOrMergeEffect(effects, { resource: 'morale', amount: 4 })
  }
  if (card.special === 'raiseLowest') {
    const ordered: Array<keyof Pick<Resources, 'food' | 'morale' | 'defense'>> = [
      'food',
      'morale',
      'defense',
    ]
    const lowest = ordered.reduce((best, key) =>
      resources[key] < resources[best] ? key : best,
    )
    addOrMergeEffect(effects, { resource: lowest, amount: 2 })
  }
  if (card.special === 'mobilize') {
    effects.unshift({ resource: 'defense', amount: 10 - resources.defense })
  }

  if (leader === 'hero' && card.family === 'welfare') {
    for (const effect of effects) {
      if (
        (effect.resource === 'food' || effect.resource === 'morale') &&
        effect.amount > 0
      ) {
        effect.amount = Math.max(0, effect.amount - 1)
      }
    }
  }
  if (leader === 'advocate' && card.id.startsWith('collect-tax')) {
    addOrMergeEffect(effects, { resource: 'morale', amount: -1 })
  }
  if (leader === 'merchant' && card.family === 'military') {
    const goldCost = effects.find(
      (effect) => effect.resource === 'gold' && effect.amount < 0,
    )
    if (goldCost) goldCost.amount -= 1
  }

  return effects.filter((effect) => effect.amount !== 0)
}

export function canAffordEffects(resources: Resources, effects: ResourceEffect[]): boolean {
  let gold = resources.gold
  for (const effect of effects) {
    if (effect.resource === 'gold') gold += effect.amount
    if (gold < 0) return false
  }
  return true
}

export function canPlayCard(
  card: CardData,
  state: GameState,
): { allowed: boolean; reason: string } {
  const cost = effectiveApCost(card, state)
  if (state.actionPoints < cost) {
    return { allowed: false, reason: `행동력이 ${cost} 필요합니다.` }
  }
  const effects = getEffectiveCardEffects(card, state.resources, state.leader)
  if (!canAffordEffects(state.resources, effects)) {
    return { allowed: false, reason: '지불할 금화가 부족합니다.' }
  }
  if (card.special === 'preemptiveStrike' && state.currentEvent?.category !== 'invasion') {
    return { allowed: false, reason: '침략 사건에서만 사용할 수 있습니다.' }
  }
  if (
    card.special === 'rerollEvent' &&
    (state.currentEvent?.isCrisis || state.currentEvent?.isFinal)
  ) {
    return { allowed: false, reason: '위기 사건은 교체할 수 없습니다.' }
  }
  return { allowed: true, reason: '' }
}

export function applyEffects(
  resources: Resources,
  effects: ResourceEffect[],
): { resources: Resources; applied: ResourceEffect[]; defeatResource: ResourceKey | null } {
  const next = { ...resources }
  const applied: ResourceEffect[] = []
  let defeatResource: ResourceKey | null = null

  for (const effect of effects) {
    const before = next[effect.resource]
    const maximum = effect.resource === 'gold' ? 20 : 10
    next[effect.resource] = Math.max(0, Math.min(maximum, before + effect.amount))
    const actualAmount = next[effect.resource] - before
    if (actualAmount !== 0) applied.push({ ...effect, amount: actualAmount })
    if (
      effect.resource !== 'gold' &&
      next[effect.resource] <= 0
    ) {
      defeatResource = effect.resource
      break
    }
  }

  return { resources: next, applied, defeatResource }
}

export function previewEffects(resources: Resources, effects: ResourceEffect[]): Resources {
  return applyEffects(resources, effects).resources
}

export function isLethal(resources: Resources, effects: ResourceEffect[]): boolean {
  return applyEffects(resources, effects).defeatResource !== null
}

export function mitigateEasyFailure(effects: ResourceEffect[]): ResourceEffect[] {
  const result = effects.map((effect) => ({ ...effect }))
  const totalDamage = result.reduce(
    (sum, effect) => sum + (effect.amount < 0 ? Math.abs(effect.amount) : 0),
    0,
  )
  if (totalDamage <= 1) return result
  const firstDamage = result.find((effect) => effect.amount < 0)
  if (firstDamage) firstDamage.amount += 1
  return result.filter((effect) => effect.amount !== 0)
}

function requirementThreshold(
  event: EventData,
  value: number,
  state: GameState,
): number {
  let threshold = value
  if (event.isFinal && state.difficulty === 'easy') threshold = Math.max(0, threshold - 1)
  if (event.category === 'economy' && state.modifiers.economyRequirementPenalty > 0) {
    threshold += state.modifiers.economyRequirementPenalty
  }
  return threshold
}

export function getSatisfiedRequirement(
  event: EventData,
  state: GameState,
): RequirementOption | null {
  if (event.id === 'final-bankruptcy') {
    if (state.resources.gold >= (state.difficulty === 'easy' ? 6 : 7)) {
      return event.requirements?.[0] ?? null
    }
    const survivalTotal =
      state.resources.food + state.resources.morale + state.resources.defense
    if (survivalTotal >= (state.difficulty === 'easy' ? 17 : 18)) {
      return event.requirements?.[1] ?? null
    }
    return null
  }

  return (
    event.requirements?.find((option) =>
      Object.entries(option.checks).every(([key, value]) => {
        const resource = key as ResourceKey
        return (
          state.resources[resource] >=
          requirementThreshold(event, value ?? 0, state)
        )
      }),
    ) ?? null
  )
}

export function getRequirementPayment(
  event: EventData,
  requirement: RequirementOption | null,
  state: GameState,
): ResourceEffect[] {
  const payment = requirement?.payment?.map((effect) => ({ ...effect })) ?? []
  if (event.isFinal && state.difficulty === 'easy') {
    for (const effect of payment) {
      if (effect.amount < 0) effect.amount += 1
    }
  }
  return payment
}

export function getDisplayRequirement(event: EventData, state: GameState): string {
  if (event.id === 'final-bankruptcy' && state.difficulty === 'easy') {
    return '금화 6 이상 또는 생존 자원 합계 17 이상'
  }
  let delta = 0
  if (event.isFinal && state.difficulty === 'easy') delta -= 1
  if (event.category === 'economy') {
    delta += state.modifiers.economyRequirementPenalty
  }
  if (delta === 0 || !event.requirements?.length) return event.requirementText
  return event.requirements
    .map((option) =>
      option.label.replace(/\d+/, (match) =>
        String(Math.max(0, Number(match) + delta)),
      ),
    )
    .join(' 또는 ')
}

export function selectFinalCrisis(resources: Resources): EventData {
  const ordered: ResourceKey[] = ['food', 'morale', 'defense', 'gold']
  const lowest = ordered.reduce((best, key) =>
    resources[key] < resources[best] ? key : best,
  )
  const index: Record<ResourceKey, number> = {
    food: 0,
    morale: 1,
    defense: 2,
    gold: 3,
  }
  return finalCrises[index[lowest]]
}

export function drawCards(
  drawPile: CardData[],
  discardPile: CardData[],
  count: number,
): { cards: CardData[]; drawPile: CardData[]; discardPile: CardData[] } {
  let available = [...drawPile]
  let discard = [...discardPile]
  const cards: CardData[] = []

  while (cards.length < count) {
    if (available.length === 0) {
      if (discard.length === 0) break
      available = shuffle(discard)
      discard = []
    }
    const card = available.shift()
    if (card) cards.push(card)
  }

  return { cards, drawPile: available, discardPile: discard }
}

export function makeRewardChoices(
  state: GameState,
  legendary: boolean,
): CardData[] {
  const targetCount = state.modifiers.smallerNextReward ? 2 : 3
  const pool = legendary ? legendaryCards : standardRewardCards
  const dominant = (Object.entries(state.familyUsage) as Array<[CardFamily, number]>).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0]
  const shuffled = shuffle(pool)
  const choices: CardData[] = []
  const offFamily = shuffled.find((card) => card.family !== dominant)
  if (offFamily) choices.push(offFamily)
  for (const card of shuffled) {
    if (choices.some((item) => item.id === card.id)) continue
    choices.push(card)
    if (choices.length === targetCount) break
  }
  return choices.map((card, index) => ({
    ...card,
    id: `${card.id}__reward_${state.turn}_${index}_${Math.floor(Math.random() * 10000)}`,
  }))
}

export function getScoreAndEnding(
  resources: Resources,
  rareCardsOwned: number,
): {
  score: number
  grade: string
  ending: string
  endingDescription: string
} {
  const score =
    1000 +
    resources.food * 100 +
    resources.morale * 100 +
    resources.defense * 100 +
    resources.gold * 30 +
    rareCardsOwned * 50
  const grade =
    score >= 3500 ? 'S' : score >= 3000 ? 'A' : score >= 2500 ? 'B' : score >= 2000 ? 'C' : 'D'

  if (resources.food >= 6 && resources.morale >= 6 && resources.defense >= 6) {
    return {
      score,
      grade,
      ending: '균형 잡힌 왕국',
      endingDescription:
        '새 국왕은 굶주리지 않는 백성, 충성스러운 도시, 굳건한 성벽을 물려받았습니다. 조용하지만 단단한 재건이 시작됩니다.',
    }
  }
  if (resources.defense >= 9 && resources.morale <= 4) {
    return {
      score,
      grade,
      ending: '군사 국가',
      endingDescription:
        '왕국은 어떤 적도 넘보지 못하는 요새가 되었습니다. 그러나 광장보다 병영의 목소리가 더 커졌습니다.',
    }
  }
  if (resources.gold >= 12 && (resources.food <= 4 || resources.morale <= 4)) {
    return {
      score,
      grade,
      ending: '황금의 왕국',
      endingDescription:
        '금고는 넘치고 상선은 끊이지 않습니다. 그 찬란함 아래, 풍요에서 멀어진 이들의 그림자도 길어집니다.',
    }
  }
  if (resources.morale >= 9 && resources.defense <= 4) {
    return {
      score,
      grade,
      ending: '백성의 왕국',
      endingDescription:
        '사람들은 새 시대를 환호로 맞았습니다. 다만 먼 국경의 봉화는 여전히 불안하게 흔들립니다.',
    }
  }
  return {
    score,
    grade,
    ending: '간신히 생존',
    endingDescription:
      '열 번째 주의 새벽은 밝았습니다. 왕국은 살아남았지만, 다음 계절까지는 아직 수많은 선택이 남았습니다.',
  }
}

export function formatEffects(effects: ResourceEffect[]): string {
  if (effects.length === 0) return '자원 변화 없음'
  return effects
    .map(
      (effect) =>
        `${resourceLabels[effect.resource]} ${effect.amount > 0 ? '+' : ''}${effect.amount}`,
    )
    .join(' · ')
}

export function pickReplacementEvent(state: GameState): EventData | null {
  const candidates = normalEvents.filter(
    (event) =>
      !state.usedEventIds.includes(event.id) &&
      event.id !== state.currentEvent?.id &&
      (event.minTurn ?? 1) <= state.turn &&
      (event.maxTurn ?? 10) >= state.turn,
  )
  return shuffle(candidates)[0] ?? null
}
