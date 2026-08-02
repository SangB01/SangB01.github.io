import type { LeaderData } from '../types/game'

export const leaders: LeaderData[] = [
  {
    id: 'merchant',
    name: '엘리아스',
    title: '상인 출신 섭정',
    icon: '◆',
    benefit: '시작 금화 +3',
    drawback: '군사 카드의 금화 비용 +1',
  },
  {
    id: 'hero',
    name: '카시안',
    title: '전쟁 영웅',
    icon: '♜',
    benefit: '시작 국방 +2',
    drawback: '복지 카드의 회복량 -1',
  },
  {
    id: 'advocate',
    name: '마라',
    title: '백성의 대변자',
    icon: '✦',
    benefit: '시작 민심 +2',
    drawback: '세금 징수의 민심 피해 +1',
  },
  {
    id: 'strategist',
    name: '세베린',
    title: '냉혹한 책략가',
    icon: '◐',
    benefit: '책략 카드 행동력 -1',
    drawback: '시작 식량 -1 · 민심 -1',
  },
]
