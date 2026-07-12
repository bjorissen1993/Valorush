import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPlayer,
  createStateFromNames,
  createEmptyState,
  addRadianite,
  addLoadoutPoints,
  awardDuelWinner,
  assignSpikeToRandomPlayer,
  spawnSpikeOnTile,
  resolveSpike,
  applyPacifistAward,
  nextTurn,
  resetState,
  saveState,
  loadState,
} from './gameState'

beforeEach(() => {
  localStorage.clear()
})

describe('gameState helpers', () => {
  it('createPlayer returns player with zeroed scores', () => {
    const p = createPlayer('Alice')
    expect(p.name).toBe('Alice')
    expect(typeof p.id).toBe('string')
    expect(p.rp).toBe(0)
    expect(p.bp).toBe(0)
    expect(p.sp).toBe(0)
    expect(p.lp).toBe(0)
    expect(p.pa).toBe(0)
    expect(p.duelWins).toBe(0)
  })

  it('createStateFromNames persists state to localStorage', () => {
    const s = createStateFromNames(['A', 'B'])
    expect(s.players.length).toBe(2)
    expect(s.started).toBe(true)
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    expect((loaded as any).players.length).toBe(2)
  })

  it('addRadianite and addLoadoutPoints update the correct player', () => {
    let s = createStateFromNames(['A'])
    const id = s.players[0].id
    s = addRadianite(s, id, 5)
    expect(s.players.find((p) => p.id === id)!.rp).toBe(5)
    s = addLoadoutPoints(s, id, 2)
    expect(s.players.find((p) => p.id === id)!.lp).toBe(2)
  })

  it('awardDuelWinner increments BP and duelWins', () => {
    let s = createStateFromNames(['A'])
    const id = s.players[0].id
    s = awardDuelWinner(s, id)
    const p = s.players.find((p) => p.id === id)!
    expect(p.bp).toBe(1)
    expect(p.duelWins).toBe(1)
  })

  it('assignSpikeToRandomPlayer, spawnSpikeOnTile and resolveSpike (owner) work', () => {
    let s = createStateFromNames(['A', 'B', 'C'])
    s = assignSpikeToRandomPlayer(s)
    expect(s.spike).toBeTruthy()
    expect(s.spike!.active).toBe(true)
    expect(s.spike!.ownerId).toBeTruthy()
    const ownerId = s.spike!.ownerId!
    s = resolveSpike(s, null)
    expect(s.spike!.active).toBe(false)
    const owner = s.players.find((p) => p.id === ownerId)!
    expect(owner.sp).toBe(1)
    s = spawnSpikeOnTile(s, 7)
    expect(s.spike!.tile).toBe(7)
  })

  it('resolveSpike to neutralizer awards SP to neutralizer', () => {
    let s = createStateFromNames(['A', 'B'])
    s = spawnSpikeOnTile(s, 3)
    s = { ...s, spike: { ownerId: s.players[0].id, tile: 3, active: true, assignedAt: Date.now() } }
    const neutralizerId = s.players[1].id
    s = resolveSpike(s, neutralizerId, 2)
    expect(s.spike!.active).toBe(false)
    expect(s.players.find((p) => p.id === neutralizerId)!.sp).toBe(2)
  })

  it('applyPacifistAward gives points only to players with zero duelWins', () => {
    let s = createStateFromNames(['A', 'B'])
    s = awardDuelWinner(s, s.players[0].id)
    s = applyPacifistAward(s, 3)
    const a = s.players.find((p) => p.name === 'A')!
    const b = s.players.find((p) => p.name === 'B')!
    expect(a.pa).toBe(0)
    expect(b.pa).toBe(3)
  })

  it('nextTurn cycles currentPlayer', () => {
    let s = createStateFromNames(['A', 'B', 'C'])
    expect(s.currentPlayer).toBe(0)
    s = nextTurn(s)
    expect(s.currentPlayer).toBe(1)
    s = nextTurn(s)
    expect(s.currentPlayer).toBe(2)
    s = nextTurn(s)
    expect(s.currentPlayer).toBe(0)
  })

  it('resetState clears players and storage', () => {
    let s = createStateFromNames(['A'])
    s = resetState()
    expect(s.players.length).toBe(0)
    expect(s.started).toBe(false)
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    expect(loaded!.players.length).toBe(0)
  })
})
