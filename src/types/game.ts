export type ResourceKey = 'food' | 'morale' | 'defense' | 'gold'
export type SurvivalResource = Exclude<ResourceKey, 'gold'>
export type CardFamily = 'economy' | 'welfare' | 'military' | 'tactics'
export type Rarity = 'common' | 'rare' | 'legendary'
export type Difficulty = 'easy' | 'normal'
export type LeaderId = 'merchant' | 'hero' | 'advocate' | 'strategist'
export type EventCategory =
  | 'famine'
  | 'unrest'
  | 'invasion'
  | 'economy'
  | 'disease'
  | 'nobles'
  | 'special'
  | 'military'

export interface Resources {
  food: number
  morale: number
  defense: number
  gold: number
}

export interface ResourceEffect {
  resource: ResourceKey
  amount: number
}

export type CardSpecial =
  | 'raiseLowest'
  | 'delayMorale'
  | 'healDisease'
  | 'openGranary'
  | 'eliteKnights'
  | 'preemptiveStrike'
  | 'hideMoraleDamage'
  | 'foresee'
  | 'freeNextCard'
  | 'rerollEvent'
  | 'mobilize'
  | 'goldenPromise'
  | 'mint'
  | 'tariff'

export interface CardData {
  id: string
  name: string
  family: CardFamily
  rarity: Rarity
  apCost: number
  effects: ResourceEffect[]
  description: string
  flavor: string
  copies?: number
  special?: CardSpecial
}

export interface RequirementOption {
  label: string
  checks: Partial<Resources>
  payment?: ResourceEffect[]
}

export interface EventChoice {
  id: string
  label: string
  description: string
  effects: ResourceEffect[]
}

export interface EventData {
  id: string
  name: string
  category: EventCategory
  description: string
  requirementText: string
  requirements?: RequirementOption[]
  successText: string
  successEffects: ResourceEffect[]
  failureText: string
  failureEffects: ResourceEffect[]
  choices?: EventChoice[]
  minTurn?: number
  maxTurn?: number
  isCrisis?: boolean
  isFinal?: boolean
}

export interface TimedEffect {
  id: string
  dueTurn: number
  label: string
  effects: ResourceEffect[]
}

export interface GameLogEntry {
  id: string
  turn: number
  tone: 'neutral' | 'positive' | 'negative'
  text: string
}

export interface GameModifiers {
  revealUntil: number
  protectDisease: boolean
  protectMorale: boolean
  autoWinInvasion: boolean
  eliteKnights: boolean
  freeNextCard: boolean
  smallerNextReward: boolean
  economyRequirementPenalty: number
  goldenPromise: boolean
}

export type GamePhase =
  | 'setup'
  | 'playerAction'
  | 'eventResult'
  | 'reward'
  | 'victory'
  | 'defeat'

export interface GameResult {
  success: boolean
  title: string
  summary: string
  changes: ResourceEffect[]
}

export interface GameState {
  phase: GamePhase
  turn: number
  actionPoints: number
  resources: Resources
  difficulty: Difficulty
  leader: LeaderId
  drawPile: CardData[]
  hand: CardData[]
  discardPile: CardData[]
  removedCards: CardData[]
  deckCatalog: CardData[]
  currentEvent: EventData | null
  nextEvent: EventData | null
  eventQueue: EventData[]
  usedEventIds: string[]
  pendingEffects: TimedEffect[]
  modifiers: GameModifiers
  selectedChoiceId: string | null
  log: GameLogEntry[]
  result: GameResult | null
  rewardChoices: CardData[]
  rewardMode: 'choose' | 'remove'
  familyUsage: Record<CardFamily, number>
  rareCardsOwned: number
  score: number
  grade: string
  ending: string
  endingDescription: string
  defeatReason: string
  finalCrisisId: string | null
  startedAt: number
}

export interface LeaderData {
  id: LeaderId
  name: string
  title: string
  icon: string
  benefit: string
  drawback: string
}
