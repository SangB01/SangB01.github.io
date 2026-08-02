import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import kingdomPanorama from './assets/kingdom-panorama.png'
import { EventPanel } from './components/EventPanel'
import { PolicyCard } from './components/PolicyCard'
import { ResourceBar } from './components/ResourceBar'
import { RewardModal } from './components/RewardModal'
import { eventCategoryMeta } from './data/events'
import { leaders } from './data/leaders'
import { gameReducer, initialState } from './game/reducer'
import {
  effectiveApCost,
  formatEffects,
  getDisplayRequirement,
  getEffectiveCardEffects,
  isLethal,
  previewEffects,
  resourceIcons,
  resourceLabels,
} from './game/rules'
import type {
  CardData,
  Difficulty,
  GameState,
  LeaderId,
  ResourceKey,
} from './types/game'
import './App.css'

interface Settings {
  sound: boolean
  reducedMotion: boolean
}

interface Profile {
  bestScore: number
  victories: number
}

const defaultSettings: Settings = {
  sound: true,
  reducedMotion: false,
}

const defaultProfile: Profile = {
  bestScore: 0,
  victories: 0,
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function SetupScreen({
  profile,
  onStart,
}: {
  profile: Profile
  onStart: (difficulty: Difficulty, leader: LeaderId) => void
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [leader, setLeader] = useState<LeaderId>('merchant')

  return (
    <main className="setup-screen">
      <img className="setup-background" src={kingdomPanorama} alt="" />
      <div className="setup-vignette" />
      <header className="setup-brand">
        <div className="crown-mark" aria-hidden="true">♛</div>
        <div>
          <p>FIVE-MINUTE KINGDOM</p>
          <h1>5분 왕국</h1>
          <span>열 주의 섭정 기록</span>
        </div>
      </header>

      <section className="setup-card" aria-labelledby="setup-title">
        <div className="setup-intro">
          <p className="eyebrow">왕실력 847년 · 계승자가 도착하기 10주 전</p>
          <h2 id="setup-title">좋은 선택만 할 수는 없습니다.</h2>
          <p>
            전쟁과 기근으로 흔들리는 왕국의 임시 섭정이 되어, 제한된 정책과
            자원으로 마지막 열 주를 버티십시오.
          </p>
        </div>

        <div className="setup-section">
          <div className="section-title">
            <span>01</span>
            <div>
              <h3>난이도 선택</h3>
              <p>첫 원정에는 쉬움을 권장합니다.</p>
            </div>
          </div>
          <div className="difficulty-grid">
            <button
              type="button"
              className={difficulty === 'easy' ? 'is-selected' : ''}
              onClick={() => setDifficulty('easy')}
            >
              <span className="radio-mark" aria-hidden="true" />
              <strong>쉬움</strong>
              <small>핵심 자원 +1 · 실패 피해 -1</small>
              <em>다음 사건의 이름과 분류 공개</em>
            </button>
            <button
              type="button"
              className={difficulty === 'normal' ? 'is-selected' : ''}
              onClick={() => setDifficulty('normal')}
            >
              <span className="radio-mark" aria-hidden="true" />
              <strong>보통</strong>
              <small>기획 기준 그대로의 자원과 피해</small>
              <em>다음 사건의 분류만 공개</em>
            </button>
          </div>
        </div>

        <div className="setup-section">
          <div className="section-title">
            <span>02</span>
            <div>
              <h3>섭정 선택</h3>
              <p>강점과 대가는 한 판 내내 적용됩니다.</p>
            </div>
          </div>
          <div className="leader-grid">
            {leaders.map((item) => (
              <button
                type="button"
                key={item.id}
                className={leader === item.id ? 'is-selected' : ''}
                onClick={() => setLeader(item.id)}
              >
                <span className="leader-icon" aria-hidden="true">{item.icon}</span>
                <span className="leader-copy">
                  <small>{item.title}</small>
                  <strong>{item.name}</strong>
                  <em className="benefit">{item.benefit}</em>
                  <em className="drawback">{item.drawback}</em>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-footer">
          <div>
            <span>최고 점수</span>
            <strong>{profile.bestScore.toLocaleString()}</strong>
            <small>승리 {profile.victories}회</small>
          </div>
          <button
            type="button"
            className="primary-button start-button"
            onClick={() => onStart(difficulty, leader)}
          >
            <span>섭정직 수락</span>
            <small>10주 기록 시작</small>
          </button>
        </div>
      </section>
      <p className="setup-quote">
        “어떤 손실을 감수해 왕국을 지킬지 결정한다.”
      </p>
    </main>
  )
}

function TurnTrack({ turn }: { turn: number }) {
  return (
    <div className="turn-track" aria-label={`전체 10주 중 ${turn}주`}>
      <div className="turn-track-copy">
        <span>새 국왕 도착까지</span>
        <strong>{Math.max(0, 10 - turn)}주</strong>
      </div>
      <div className="turn-dots" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={
              index + 1 < turn
                ? 'is-past'
                : index + 1 === turn
                  ? 'is-current'
                  : index + 1 === 5 || index + 1 === 10
                    ? 'is-crisis'
                    : ''
            }
          >
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  )
}

function NextEventCard({ state }: { state: GameState }) {
  const event = state.nextEvent
  if (state.turn === 9) {
    return (
      <section className="side-card next-event-card">
        <p className="side-heading">다음 보고</p>
        <div className="unknown-event">
          <span aria-hidden="true">?</span>
          <strong>최종 위기 산정 중</strong>
          <p>이번 주가 끝나면 가장 낮은 자원이 마지막 위기를 결정합니다.</p>
        </div>
      </section>
    )
  }
  if (!event) {
    return (
      <section className="side-card next-event-card">
        <p className="side-heading">마지막 보고</p>
        <div className="unknown-event">
          <span aria-hidden="true">♛</span>
          <strong>왕국의 운명이 걸렸습니다</strong>
          <p>이 위기를 해결하면 새 국왕이 도착합니다.</p>
        </div>
      </section>
    )
  }
  const meta = eventCategoryMeta[event.category]
  const revealName =
    state.difficulty === 'easy' || state.modifiers.revealUntil >= state.turn + 1
  const revealRequirement = state.modifiers.revealUntil >= state.turn + 1
  return (
    <section className="side-card next-event-card">
      <p className="side-heading">다음 주 예고</p>
      <div className={`next-event category-${event.category}`}>
        <span className="next-category">
          <i aria-hidden="true">{meta.icon}</i> {meta.label}
        </span>
        <strong>{revealName ? event.name : '봉인된 왕실 보고'}</strong>
        <p>
          {revealRequirement
            ? event.requirementText
            : revealName
              ? '상세 조건은 다음 주에 공개됩니다.'
              : '사건의 분류만 미리 파악했습니다.'}
        </p>
      </div>
    </section>
  )
}

function ActionPoints({ state }: { state: GameState }) {
  return (
    <section className="side-card action-card">
      <div className="side-heading-row">
        <p className="side-heading">남은 행동력</p>
        <strong>{state.actionPoints} / 3</strong>
      </div>
      <div className="action-seals" aria-label={`행동력 ${state.actionPoints} 남음`}>
        {[0, 1, 2].map((index) => (
          <span key={index} className={index < state.actionPoints ? 'is-active' : ''}>
            <i>♛</i>
          </span>
        ))}
      </div>
      <p className="side-help">정책 카드마다 인장 1~3개를 사용합니다.</p>
    </section>
  )
}

function Chronicle({ state }: { state: GameState }) {
  return (
    <details className="side-card chronicle" open>
      <summary>
        <span>왕국 연대기</span>
        <small>{state.log.length}건</small>
      </summary>
      <div className="log-list">
        {state.log.slice(0, 6).map((entry) => (
          <div key={entry.id} className={`log-entry tone-${entry.tone}`}>
            <span>{entry.turn}주</span>
            <p>{entry.text}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function EventResultModal({
  state,
  onContinue,
}: {
  state: GameState
  onContinue: () => void
}) {
  if (!state.result) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className={`result-modal ${state.result.success ? 'success' : 'failure'}`}>
        <div className="result-stamp" aria-hidden="true">
          {state.result.success ? '해결' : '실패'}
        </div>
        <p className="eyebrow">제 {state.turn}주 왕실 기록</p>
        <h2>{state.result.title}</h2>
        <p className="result-summary">{state.result.summary}</p>
        <div className="result-changes">
          {state.result.changes.length === 0 ? (
            <span>자원 변화 없음</span>
          ) : (
            state.result.changes.map((effect, index) => (
              <span
                key={`${effect.resource}-${index}`}
                className={effect.amount > 0 ? 'positive' : 'negative'}
              >
                <i aria-hidden="true">{resourceIcons[effect.resource]}</i>
                {resourceLabels[effect.resource]} {effect.amount > 0 ? '+' : ''}
                {effect.amount}
              </span>
            ))
          )}
        </div>
        <button type="button" className="primary-button" onClick={onContinue} autoFocus>
          {state.currentEvent?.isFinal
            ? state.result.success
              ? '왕국의 결말 확인'
              : '패배 기록 확인'
            : [3, 5, 7].includes(state.turn)
              ? '정책 보상 선택'
              : '다음 주로'}
        </button>
      </section>
    </div>
  )
}

function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings
  onChange: (settings: Settings) => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="settings-modal">
        <p className="eyebrow">게임 설정</p>
        <h2>읽기와 연출</h2>
        <label>
          <span>
            <strong>효과음</strong>
            <small>카드와 사건 결과에 짧은 소리를 재생합니다.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(event) =>
              onChange({ ...settings, sound: event.target.checked })
            }
          />
        </label>
        <label>
          <span>
            <strong>애니메이션 줄이기</strong>
            <small>흔들림, 떠오름, 화면 전환 효과를 최소화합니다.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) =>
              onChange({ ...settings, reducedMotion: event.target.checked })
            }
          />
        </label>
        <button type="button" className="primary-button" onClick={onClose} autoFocus>
          완료
        </button>
      </section>
    </div>
  )
}

function EndScreen({
  state,
  onRestart,
  onSetup,
}: {
  state: GameState
  onRestart: () => void
  onSetup: () => void
}) {
  const victory = state.phase === 'victory'
  return (
    <main className={`end-screen ${victory ? 'victory' : 'defeat'}`}>
      <img src={kingdomPanorama} alt="" />
      <div className="end-vignette" />
      <section className="end-card">
        <p className="eyebrow">{victory ? '열 번째 주 · 새벽' : `제 ${state.turn}주 · 마지막 기록`}</p>
        {victory ? (
          <>
            <div className="grade-medallion">
              <small>왕국 등급</small>
              <strong>{state.grade}</strong>
            </div>
            <h1>{state.ending}</h1>
            <p className="ending-copy">{state.endingDescription}</p>
            <strong className="final-score">{state.score.toLocaleString()}점</strong>
          </>
        ) : (
          <>
            <div className="broken-seal" aria-hidden="true">♛</div>
            <p className="end-kicker">왕국은 열 주를 버티지 못했습니다</p>
            <h1>{state.defeatReason}</h1>
            <p className="ending-copy">
              모든 손실에는 기록이 남았습니다. 연대기를 돌아보고 다른 섭정과
              정책으로 다시 왕국을 맡아 보십시오.
            </p>
          </>
        )}

        <div className="final-resources">
          {(['food', 'morale', 'defense', 'gold'] as ResourceKey[]).map((key) => (
            <div key={key}>
              <span aria-hidden="true">{resourceIcons[key]}</span>
              <small>{resourceLabels[key]}</small>
              <strong>{state.resources[key]}</strong>
            </div>
          ))}
        </div>
        <div className="end-actions">
          <button type="button" className="primary-button" onClick={onRestart}>
            같은 설정으로 다시 시작
          </button>
          <button type="button" className="secondary-button" onClick={onSetup}>
            섭정과 난이도 변경
          </button>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [confirmLethal, setConfirmLethal] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>(() =>
    loadStored('five-minute-kingdom-settings', defaultSettings),
  )
  const [profile, setProfile] = useState<Profile>(() =>
    loadStored('five-minute-kingdom-profile', defaultProfile),
  )
  const audioContext = useRef<AudioContext | null>(null)
  const previousPhase = useRef(state.phase)
  const savedRun = useRef(0)

  const selectedEffects = useMemo(
    () =>
      selectedCard
        ? getEffectiveCardEffects(selectedCard, state.resources, state.leader)
        : [],
    [selectedCard, state.resources, state.leader],
  )
  const preview = selectedCard
    ? previewEffects(state.resources, selectedEffects)
    : null
  const lethal = selectedCard
    ? isLethal(state.resources, selectedEffects)
    : false

  const sound = useCallback((kind: 'paper' | 'success' | 'failure') => {
    if (!settings.sound) return
    try {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextConstructor) return
      const context = audioContext.current ?? new AudioContextConstructor()
      audioContext.current = context
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = kind === 'paper' ? 'triangle' : 'sine'
      oscillator.frequency.value =
        kind === 'paper' ? 180 : kind === 'success' ? 520 : 110
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(
        kind === 'paper' ? 0.035 : 0.065,
        context.currentTime + 0.015,
      )
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + (kind === 'paper' ? 0.09 : 0.45),
      )
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.5)
    } catch {
      // Audio feedback is optional; browsers may block it before user interaction.
    }
  }, [settings.sound])

  useEffect(() => {
    window.localStorage.setItem('five-minute-kingdom-settings', JSON.stringify(settings))
    document.documentElement.classList.toggle(
      'reduce-motion',
      settings.reducedMotion,
    )
  }, [settings])

  useEffect(() => {
    if (state.phase !== previousPhase.current) {
      if (state.phase === 'eventResult') {
        sound(state.result?.success ? 'success' : 'failure')
      }
      if (state.phase === 'defeat') sound('failure')
      if (state.phase === 'victory') sound('success')
      previousPhase.current = state.phase
    }
  }, [sound, state.phase, state.result])

  useEffect(() => {
    if (state.phase !== 'victory' || savedRun.current === state.startedAt) return
    savedRun.current = state.startedAt
    const next = {
      bestScore: Math.max(profile.bestScore, state.score),
      victories: profile.victories + 1,
    }
    setProfile(next)
    window.localStorage.setItem('five-minute-kingdom-profile', JSON.stringify(next))
  }, [state.phase, state.score, state.startedAt, profile])

  function start(difficulty: Difficulty, leader: LeaderId) {
    savedRun.current = 0
    dispatch({ type: 'START_GAME', difficulty, leader })
  }

  function playSelected() {
    if (!selectedCard) return
    if (lethal && !confirmLethal) {
      setConfirmLethal(true)
      return
    }
    sound('paper')
    dispatch({ type: 'PLAY_CARD', cardId: selectedCard.id })
    setSelectedCard(null)
    setConfirmLethal(false)
  }

  if (state.phase === 'setup') {
    return <SetupScreen profile={profile} onStart={start} />
  }

  if (state.phase === 'victory' || state.phase === 'defeat') {
    return (
      <EndScreen
        state={state}
        onRestart={() => start(state.difficulty, state.leader)}
        onSetup={() => dispatch({ type: 'RETURN_TO_SETUP' })}
      />
    )
  }

  const endDisabled = Boolean(
    state.currentEvent?.choices && !state.selectedChoiceId,
  )
  const endRisk =
    !state.currentEvent?.choices &&
    state.currentEvent &&
    !state.result

  return (
    <div className="game-shell">
      <header className="game-header">
        <button
          type="button"
          className="mini-brand"
          onClick={() => dispatch({ type: 'RETURN_TO_SETUP' })}
          title="처음 화면으로"
        >
          <span aria-hidden="true">♛</span>
          <span><strong>5분 왕국</strong><small>FIVE-MINUTE KINGDOM</small></span>
        </button>
        <TurnTrack turn={state.turn} />
        <button
          type="button"
          className="icon-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="설정 열기"
          title="설정"
        >
          ⚙
        </button>
      </header>

      <ResourceBar resources={state.resources} preview={preview} />

      <main className="game-main">
        <EventPanel
          state={state}
          onChoice={(choiceId) => {
            sound('paper')
            dispatch({ type: 'SELECT_CHOICE', choiceId })
          }}
        />
        <aside className="game-sidebar">
          <NextEventCard state={state} />
          <ActionPoints state={state} />
          {state.pendingEffects.length > 0 && (
            <section className="side-card pending-card">
              <p className="side-heading">예약된 대가</p>
              {state.pendingEffects.map((effect) => (
                <div key={effect.id}>
                  <span>{effect.dueTurn}주</span>
                  <p>{effect.label}</p>
                  <small>{formatEffects(effect.effects)}</small>
                </div>
              ))}
            </section>
          )}
          <Chronicle state={state} />
        </aside>
      </main>

      <section className="hand-zone" aria-labelledby="hand-title">
        <div className="hand-heading">
          <div>
            <p className="eyebrow">왕실 정책안</p>
            <h2 id="hand-title">손에 든 정책</h2>
          </div>
          <div className="deck-counts">
            <span>뽑을 카드 <strong>{state.drawPile.length}</strong></span>
            <span>버린 카드 <strong>{state.discardPile.length}</strong></span>
          </div>
        </div>

        {selectedCard && (
          <div className={`selected-policy${lethal ? ' is-lethal' : ''}`}>
            <div>
              <span className="selected-label">{lethal ? '치명적 결과 경고' : '예상 자원 변화'}</span>
              <strong>{selectedCard.name}</strong>
              <p>{formatEffects(selectedEffects)}</p>
            </div>
            <div className="selected-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSelectedCard(null)
                  setConfirmLethal(false)
                }}
              >
                선택 취소
              </button>
              <button
                type="button"
                className={lethal ? 'danger-button' : 'primary-button'}
                onClick={playSelected}
              >
                {lethal
                  ? confirmLethal
                    ? '정말 시행하여 패배를 감수'
                    : '위험을 확인하고 시행'
                  : `정책 시행 · 행동력 ${effectiveApCost(selectedCard, state)}`}
              </button>
            </div>
          </div>
        )}

        <div className="hand-cards">
          {state.hand.map((card) => (
            <PolicyCard
              card={card}
              state={state}
              key={card.id}
              selected={selectedCard?.id === card.id}
              onSelect={(nextCard) => {
                sound('paper')
                setSelectedCard(nextCard)
                setConfirmLethal(false)
              }}
            />
          ))}
          {state.hand.length === 0 && (
            <div className="empty-hand">
              <span aria-hidden="true">♛</span>
              <p>이번 주에 시행할 정책을 모두 사용했습니다.</p>
            </div>
          )}
        </div>

        <div className="turn-actions">
          <p>
            {endDisabled
              ? '사건의 선택지를 먼저 결정해야 합니다.'
              : state.actionPoints > 0
                ? `행동력 ${state.actionPoints}을 남기고도 주를 마칠 수 있습니다.`
                : '행동력을 모두 사용했습니다. 사건을 판정하십시오.'}
          </p>
          <button
            type="button"
            className="end-turn-button"
            disabled={endDisabled}
            onClick={() => {
              setSelectedCard(null)
              setConfirmLethal(false)
              dispatch({ type: 'END_TURN' })
            }}
          >
            <span>{state.turn === 10 ? '최종 위기 판정' : '이번 주 마치기'}</span>
            <small>
              {endDisabled
                ? '선택 필요'
                : endRisk
                  ? state.currentEvent
                    ? getDisplayRequirement(state.currentEvent, state)
                    : '사건 결과 확인'
                  : '사건 결과 확인'}
            </small>
          </button>
        </div>
      </section>

      {state.phase === 'eventResult' && (
        <EventResultModal
          state={state}
          onContinue={() => {
            setSelectedCard(null)
            setConfirmLethal(false)
            dispatch({ type: 'CONTINUE_RESULT' })
          }}
        />
      )}
      {state.phase === 'reward' && (
        <RewardModal
          state={state}
          onSelect={(card) => dispatch({ type: 'SELECT_REWARD', card })}
          onOpenRemove={() => dispatch({ type: 'OPEN_REMOVE_REWARD' })}
          onRemove={(cardId) => dispatch({ type: 'REMOVE_CARD', cardId })}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

export default App
