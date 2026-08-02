import type { Resources } from '../types/game'
import { resourceIcons, resourceLabels } from '../game/rules'

interface ResourceBarProps {
  resources: Resources
  preview?: Resources | null
}

const keys = ['food', 'morale', 'defense', 'gold'] as const

export function ResourceBar({ resources, preview }: ResourceBarProps) {
  return (
    <section className="resource-bar" aria-label="왕국 자원">
      {keys.map((key) => {
        const value = resources[key]
        const next = preview?.[key]
        const changed = next !== undefined && next !== value
        const danger = (key !== 'gold' && value <= 2) || (key === 'gold' && value === 0)
        return (
          <div
            className={`resource-item resource-${key}${danger ? ' is-danger' : ''}`}
            key={key}
            title={
              key === 'gold'
                ? '정책을 실행하는 데 쓰입니다. 0이어도 패배하지 않습니다.'
                : `${resourceLabels[key]}이 0이 되면 즉시 패배합니다.`
            }
          >
            <span className="resource-icon" aria-hidden="true">
              {resourceIcons[key]}
            </span>
            <span className="resource-copy">
              <small>{resourceLabels[key]}</small>
              <strong>
                {value}
                {changed && (
                  <>
                    <span className="resource-arrow">→</span>
                    <span className={(next ?? value) > value ? 'positive' : 'negative'}>
                      {next}
                    </span>
                  </>
                )}
              </strong>
            </span>
            <span className="resource-cap">/ {key === 'gold' ? 20 : 10}</span>
          </div>
        )
      })}
    </section>
  )
}
