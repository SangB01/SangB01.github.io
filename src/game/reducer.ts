import { createInitialDeck } from '../data/cards'
import { leaders } from '../data/leaders'
import type {
  CardData,
  Difficulty,
  EventData,
  GameLogEntry,
  GameState,
  LeaderId,
  ResourceEffect,
  ResourceKey,
  Resources,
} from '../types/game'
import {
  applyEffects,
  canPlayCard,
  createEventQueue,
  drawCards,
  effectiveApCost,
  formatEffects,
  getEffectiveCardEffects,
  getRequirementPayment,
  getSatisfiedRequirement,
  getScoreAndEnding,
  makeRewardChoices,
  mitigateEasyFailure,
  pickReplacementEvent,
  selectFinalCrisis,
  shuffle,
} from './rules'

export type GameAction =
  | { type: 'START_GAME'; difficulty: Difficulty; leader: LeaderId }
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'SELECT_CHOICE'; choiceId: string }
  | { type: 'END_TURN' }
  | { type: 'CONTINUE_RESULT' }
  | { type: 'SELECT_REWARD'; card: CardData }
  | { type: 'OPEN_REMOVE_REWARD' }
  | { type: 'REMOVE_CARD'; cardId: string }
  | { type: 'RETURN_TO_SETUP' }

const baseResources: Resources = {
  food: 6,
  morale: 6,
  defense: 5,
  gold: 5,
}

export const initialState: GameState = {
  phase: 'setup',
  turn: 0,
  actionPoints: 3,
  resources: baseResources,
  difficulty: 'easy',
  leader: 'merchant',
  drawPile: [],
  hand: [],
  discardPile: [],
  removedCards: [],
  deckCatalog: [],
  currentEvent: null,
  nextEvent: null,
  eventQueue: [],
  usedEventIds: [],
  pendingEffects: [],
  modifiers: {
    revealUntil: 0,
    protectDisease: false,
    protectMorale: false,
    autoWinInvasion: false,
    eliteKnights: false,
    freeNextCard: false,
    smallerNextReward: false,
    economyRequirementPenalty: 0,
    goldenPromise: false,
  },
  selectedChoiceId: null,
  log: [],
  result: null,
  rewardChoices: [],
  rewardMode: 'choose',
  familyUsage: { economy: 0, welfare: 0, military: 0, tactics: 0 },
  rareCardsOwned: 0,
  score: 0,
  grade: '',
  ending: '',
  endingDescription: '',
  defeatReason: '',
  finalCrisisId: null,
  startedAt: 0,
}

function logEntry(
  turn: number,
  text: string,
  tone: GameLogEntry['tone'] = 'neutral',
): GameLogEntry {
  return {
    id: `${turn}-${Date.now()}-${Math.random()}`,
    turn,
    tone,
    text,
  }
}

function defeatName(resource: ResourceKey | null): string {
  if (resource === 'food') return '대기근'
  if (resource === 'morale') return '시민 혁명'
  if (resource === 'defense') return '왕국 점령'
  return '왕국의 몰락'
}

function startingResources(difficulty: Difficulty, leader: LeaderId): Resources {
  const resources = { ...baseResources }
  if (difficulty === 'easy') {
    resources.food += 1
    resources.morale += 1
    resources.defense += 1
  }
  if (leader === 'merchant') resources.gold += 3
  if (leader === 'hero') resources.defense = Math.min(10, resources.defense + 2)
  if (leader === 'advocate') resources.morale = Math.min(10, resources.morale + 2)
  if (leader === 'strategist') {
    resources.food -= 1
    resources.morale -= 1
  }
  return resources
}

function startGame(difficulty: Difficulty, leader: LeaderId): GameState {
  const deck = shuffle(createInitialDeck())
  const drawn = drawCards(deck, [], 5)
  const eventQueue = createEventQueue()
  const leaderName = leaders.find((item) => item.id === leader)?.title ?? '섭정'

  return {
    ...initialState,
    phase: 'playerAction',
    turn: 1,
    actionPoints: 3,
    resources: startingResources(difficulty, leader),
    difficulty,
    leader,
    drawPile: drawn.drawPile,
    hand: drawn.cards,
    discardPile: drawn.discardPile,
    deckCatalog: [...deck],
    currentEvent: eventQueue[0],
    nextEvent: eventQueue[1] ?? null,
    eventQueue,
    usedEventIds: [eventQueue[0].id],
    startedAt: Date.now(),
    log: [
      logEntry(
        1,
        `${leaderName}이(가) 임시 섭정으로 취임했습니다. 열 주를 버텨야 합니다.`,
      ),
    ],
  }
}

function applySpecialCard(
  state: GameState,
  card: CardData,
): Pick<GameState, 'modifiers' | 'pendingEffects' | 'currentEvent' | 'usedEventIds'> {
  const modifiers = { ...state.modifiers }
  const pendingEffects = [...state.pendingEffects]
  let currentEvent = state.currentEvent
  let usedEventIds = [...state.usedEventIds]

  if (card.special === 'delayMorale') {
    pendingEffects.push({
      id: `debt-${Date.now()}`,
      dueTurn: state.turn + 3,
      label: '귀족 차입금의 대가',
      effects: [{ resource: 'morale', amount: -2 }],
    })
  }
  if (card.special === 'healDisease') modifiers.protectDisease = true
  if (card.special === 'eliteKnights') modifiers.eliteKnights = true
  if (card.special === 'preemptiveStrike') modifiers.autoWinInvasion = true
  if (card.special === 'hideMoraleDamage') modifiers.protectMorale = true
  if (card.special === 'foresee') modifiers.revealUntil = state.turn + 2
  if (card.special === 'freeNextCard') modifiers.freeNextCard = true
  if (card.special === 'mint') modifiers.smallerNextReward = true
  if (card.special === 'tariff') modifiers.economyRequirementPenalty = 1
  if (card.special === 'goldenPromise') modifiers.goldenPromise = true
  if (card.special === 'rerollEvent') {
    const replacement = pickReplacementEvent(state)
    if (replacement) {
      currentEvent = replacement
      usedEventIds = [...usedEventIds, replacement.id]
    }
  }

  return { modifiers, pendingEffects, currentEvent, usedEventIds }
}

function playCard(state: GameState, cardId: string): GameState {
  const card = state.hand.find((item) => item.id === cardId)
  if (!card) return state
  const validation = canPlayCard(card, state)
  if (!validation.allowed) return state

  const apCost = effectiveApCost(card, state)
  const effects = getEffectiveCardEffects(card, state.resources, state.leader)
  const resolved = applyEffects(state.resources, effects)
  const special = applySpecialCard(state, card)
  const modifiers = { ...special.modifiers, freeNextCard: false }
  if (card.special === 'freeNextCard') modifiers.freeNextCard = true
  const nextHand = state.hand.filter((item) => item.id !== card.id)
  const log = [
    logEntry(
      state.turn,
      `「${card.name}」 시행 — ${formatEffects(resolved.applied)}`,
      resolved.applied.some((effect) => effect.amount < 0) ? 'neutral' : 'positive',
    ),
    ...state.log,
  ]

  if (resolved.defeatResource) {
    return {
      ...state,
      phase: 'defeat',
      resources: resolved.resources,
      actionPoints: state.actionPoints - apCost,
      hand: nextHand,
      discardPile: [...state.discardPile, card],
      defeatReason: defeatName(resolved.defeatResource),
      log,
    }
  }

  return {
    ...state,
    resources: resolved.resources,
    actionPoints: state.actionPoints - apCost,
    hand: nextHand,
    discardPile: [...state.discardPile, card],
    familyUsage: {
      ...state.familyUsage,
      [card.family]: state.familyUsage[card.family] + 1,
    },
    modifiers,
    pendingEffects: special.pendingEffects,
    currentEvent: special.currentEvent,
    usedEventIds: special.usedEventIds,
    log,
  }
}

function selectChoice(state: GameState, choiceId: string): GameState {
  const choice = state.currentEvent?.choices?.find((item) => item.id === choiceId)
  if (!choice || state.selectedChoiceId) return state
  const resolved = applyEffects(state.resources, choice.effects)
  const log = [
    logEntry(
      state.turn,
      `${state.currentEvent?.name}: ${choice.label} — ${formatEffects(resolved.applied)}`,
      choice.effects.some((effect) => effect.amount < 0) ? 'neutral' : 'positive',
    ),
    ...state.log,
  ]
  if (resolved.defeatResource) {
    return {
      ...state,
      phase: 'defeat',
      resources: resolved.resources,
      selectedChoiceId: choiceId,
      defeatReason: defeatName(resolved.defeatResource),
      log,
    }
  }
  return {
    ...state,
    resources: resolved.resources,
    selectedChoiceId: choiceId,
    log,
  }
}

function protectedFailureEffects(state: GameState, event: EventData): ResourceEffect[] {
  if (event.category === 'disease' && state.modifiers.protectDisease) return []
  let effects = event.failureEffects.map((effect) => ({ ...effect }))
  if (state.modifiers.protectMorale) {
    effects = effects.filter((effect) => effect.resource !== 'morale' || effect.amount > 0)
  }
  if (state.difficulty === 'easy') effects = mitigateEasyFailure(effects)
  return effects
}

function endTurn(state: GameState): GameState {
  const event = state.currentEvent
  if (!event) return state
  if (event.choices && !state.selectedChoiceId) return state

  let success = Boolean(event.choices)
  let effects: ResourceEffect[] = []
  let summary = '선택의 결과가 왕국에 남았습니다.'
  const modifiers = { ...state.modifiers }

  if (!event.choices) {
    const requirement = getSatisfiedRequirement(event, state)
    success =
      Boolean(requirement) ||
      (event.category === 'invasion' && state.modifiers.autoWinInvasion)
    if (success) {
      effects = [
        ...getRequirementPayment(event, requirement, state),
        ...event.successEffects,
        ...(event.category === 'invasion' && state.modifiers.eliteKnights
          ? [{ resource: 'defense' as const, amount: 1 }]
          : []),
      ]
      summary = event.successText
    } else {
      const resolvedEvent =
        event.id === 'great-crop-failure'
          ? {
              ...event,
              failureEffects: [
                {
                  resource: 'morale' as const,
                  amount: -Math.max(1, 7 - state.resources.food),
                },
              ],
            }
          : event
      effects = protectedFailureEffects(state, resolvedEvent)
      summary = event.failureText
    }
  }

  const resolved = applyEffects(state.resources, effects)
  if (event.category === 'disease') modifiers.protectDisease = false
  modifiers.protectMorale = false
  modifiers.autoWinInvasion = false
  if (event.category === 'economy') modifiers.economyRequirementPenalty = 0

  const result = {
    success,
    title: success ? '사건 해결' : event.isFinal ? '최종 위기 실패' : '대가를 치렀습니다',
    summary,
    changes: resolved.applied,
  }
  const log = [
    logEntry(
      state.turn,
      `${event.name} ${success ? '성공' : '실패'} — ${summary}`,
      success ? 'positive' : 'negative',
    ),
    ...state.log,
  ]

  if (resolved.defeatResource) {
    return {
      ...state,
      phase: 'defeat',
      resources: resolved.resources,
      modifiers,
      result,
      defeatReason: defeatName(resolved.defeatResource),
      log,
    }
  }

  return {
    ...state,
    phase: 'eventResult',
    resources: resolved.resources,
    modifiers,
    result,
    log,
  }
}

function startNextTurn(state: GameState): GameState {
  const nextTurn = state.turn + 1
  const currentEvent =
    nextTurn === 10
      ? selectFinalCrisis(state.resources)
      : state.eventQueue[nextTurn - 1] ?? null
  const nextEvent =
    nextTurn >= 9 ? null : state.eventQueue[nextTurn] ?? null
  const pendingNow = state.pendingEffects.filter((effect) => effect.dueTurn === nextTurn)
  const remainingPending = state.pendingEffects.filter((effect) => effect.dueTurn !== nextTurn)
  let resources = state.resources
  let defeatResource: ResourceKey | null = null
  let log = [...state.log]

  for (const pending of pendingNow) {
    const resolved = applyEffects(resources, pending.effects)
    resources = resolved.resources
    defeatResource = resolved.defeatResource
    log = [
      logEntry(
        nextTurn,
        `${pending.label} — ${formatEffects(resolved.applied)}`,
        'negative',
      ),
      ...log,
    ]
    if (defeatResource) break
  }

  if (defeatResource) {
    return {
      ...state,
      phase: 'defeat',
      turn: nextTurn,
      resources,
      pendingEffects: remainingPending,
      defeatReason: defeatName(defeatResource),
      log,
    }
  }

  const discardPile = [...state.discardPile, ...state.hand]
  const drawn = drawCards(state.drawPile, discardPile, 5)
  return {
    ...state,
    phase: 'playerAction',
    turn: nextTurn,
    actionPoints: 3,
    resources,
    drawPile: drawn.drawPile,
    hand: drawn.cards,
    discardPile: drawn.discardPile,
    currentEvent,
    nextEvent,
    usedEventIds: currentEvent
      ? [...state.usedEventIds, currentEvent.id]
      : state.usedEventIds,
    pendingEffects: remainingPending,
    selectedChoiceId: null,
    result: null,
    rewardChoices: [],
    rewardMode: 'choose',
    finalCrisisId: currentEvent?.isFinal ? currentEvent.id : state.finalCrisisId,
    log: currentEvent?.isFinal
      ? [
          logEntry(
            nextTurn,
            `가장 취약한 자원이 마지막 위기를 불렀습니다: ${currentEvent.name}`,
            'negative',
          ),
          ...log,
        ]
      : log,
  }
}

function finishVictory(state: GameState): GameState {
  let resources = state.resources
  let log = [...state.log]
  if (state.modifiers.goldenPromise) {
    const resolved = applyEffects(resources, [{ resource: 'morale', amount: -2 }])
    resources = resolved.resources
    log = [
      logEntry(10, '황금의 약속이 마지막 대가를 요구했습니다 — 민심 -2', 'negative'),
      ...log,
    ]
    if (resolved.defeatResource) {
      return {
        ...state,
        phase: 'defeat',
        resources,
        defeatReason: defeatName(resolved.defeatResource),
        log,
      }
    }
  }
  const outcome = getScoreAndEnding(resources, state.rareCardsOwned)
  return {
    ...state,
    ...outcome,
    resources,
    phase: 'victory',
    log,
  }
}

function continueResult(state: GameState): GameState {
  if (!state.result) return state
  if (state.currentEvent?.isFinal) {
    if (!state.result.success) {
      return {
        ...state,
        phase: 'defeat',
        defeatReason: state.currentEvent.name,
      }
    }
    return finishVictory(state)
  }

  if ([3, 5, 7].includes(state.turn)) {
    return {
      ...state,
      phase: 'reward',
      rewardChoices: makeRewardChoices(state, state.turn === 5),
      rewardMode: 'choose',
      modifiers: { ...state.modifiers, smallerNextReward: false },
    }
  }
  return startNextTurn(state)
}

function selectReward(state: GameState, card: CardData): GameState {
  const next = {
    ...state,
    discardPile: [...state.discardPile, card],
    deckCatalog: [...state.deckCatalog, card],
    rareCardsOwned:
      state.rareCardsOwned + (card.rarity === 'common' ? 0 : 1),
    log: [
      logEntry(state.turn, `새 정책 「${card.name}」을(를) 채택했습니다.`, 'positive'),
      ...state.log,
    ],
  }
  return startNextTurn(next)
}

function removeCard(state: GameState, cardId: string): GameState {
  const all = [
    ...state.hand,
    ...state.drawPile,
    ...state.discardPile,
  ]
  const target = all.find((card) => card.id === cardId)
  if (!target) return state
  const strip = (cards: CardData[]) => cards.filter((card) => card.id !== cardId)
  const next = {
    ...state,
    hand: strip(state.hand),
    drawPile: strip(state.drawPile),
    discardPile: strip(state.discardPile),
    deckCatalog: strip(state.deckCatalog),
    removedCards: [...state.removedCards, target],
    log: [
      logEntry(state.turn, `정책 「${target.name}」을(를) 폐기했습니다.`, 'neutral'),
      ...state.log,
    ],
  }
  return startNextTurn(next)
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(action.difficulty, action.leader)
    case 'PLAY_CARD':
      return state.phase === 'playerAction' ? playCard(state, action.cardId) : state
    case 'SELECT_CHOICE':
      return state.phase === 'playerAction' ? selectChoice(state, action.choiceId) : state
    case 'END_TURN':
      return state.phase === 'playerAction' ? endTurn(state) : state
    case 'CONTINUE_RESULT':
      return state.phase === 'eventResult' ? continueResult(state) : state
    case 'SELECT_REWARD':
      return state.phase === 'reward' ? selectReward(state, action.card) : state
    case 'OPEN_REMOVE_REWARD':
      return state.phase === 'reward' ? { ...state, rewardMode: 'remove' } : state
    case 'REMOVE_CARD':
      return state.phase === 'reward' ? removeCard(state, action.cardId) : state
    case 'RETURN_TO_SETUP':
      return { ...initialState }
    default:
      return state
  }
}
