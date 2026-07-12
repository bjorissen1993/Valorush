export type Player = {
  id: string
  name: string
  rp: number // Radianite Points
  bp: number // Battle Points
  sp: number // Spike Points
  lp: number // Loadout Points
  pa: number // Pacifist Award points
  duelWins: number
  position: number // board tile index (0-based)
}

export type SpikeState = {
  ownerId: string | null
  tile?: number | null
  active: boolean
  assignedAt?: number
}

export type GameState = {
  players: Player[]
  currentPlayer: number
  started: boolean
  spike?: SpikeState | null
  roundsPlayed: number
  maxRounds: number
}

const STORAGE_KEY = 'pgpp-game-v1'

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function createPlayer(name: string): Player {
  return { id: makeId(), name: name || 'Player', rp: 0, bp: 0, sp: 0, lp: 0, pa: 0, duelWins: 0, position: 0 }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)

    // Backwards-compat: older saves used `currentIndex` or players with `score`.
    if (parsed && typeof parsed.currentIndex === 'number' && typeof parsed.currentPlayer !== 'number') {
      parsed.currentPlayer = parsed.currentIndex
      delete parsed.currentIndex
    }

    if (parsed && Array.isArray(parsed.players)) {
      // Normalize player shape
      parsed.players = parsed.players.map((p: any) => {
        if (typeof p === 'string') {
          return createPlayer(p)
        }
        return {
          id: p.id ?? makeId(),
          name: p.name ?? 'Player',
          rp: typeof p.rp === 'number' ? p.rp : typeof p.score === 'number' ? p.score : 0,
          bp: typeof p.bp === 'number' ? p.bp : 0,
          sp: typeof p.sp === 'number' ? p.sp : 0,
          lp: typeof p.lp === 'number' ? p.lp : 0,
          pa: typeof p.pa === 'number' ? p.pa : 0,
          duelWins: typeof p.duelWins === 'number' ? p.duelWins : 0,
          position: typeof p.position === 'number' ? p.position : 0,
        }
      })
    }

    // Ensure rounds values exist for older saves
    if (typeof parsed.roundsPlayed !== 'number') parsed.roundsPlayed = 0
    if (typeof parsed.maxRounds !== 'number') parsed.maxRounds = 20

    return parsed as GameState
  } catch (e) {
    console.error('Failed to load state', e)
    return null
  }
}

export function saveState(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state', e)
  }
}

export function createEmptyState(): GameState {
  return { players: [], currentPlayer: 0, started: false, spike: null, roundsPlayed: 0, maxRounds: 20 }
}

export function createStateFromNames(names: string[], maxRounds = 20): GameState {
  const players = names.map((n) => createPlayer(n))
  const s: GameState = { players, currentPlayer: 0, started: true, spike: null, roundsPlayed: 0, maxRounds }
  saveState(s)
  return s
}

export function nextTurn(state: GameState): GameState {
  if (state.players.length === 0) return state
  const nextIndex = (state.currentPlayer + 1) % state.players.length
  let nextRounds = state.roundsPlayed
  // If we completed a cycle (back to player 0), increment rounds
  if (nextIndex === 0) nextRounds = state.roundsPlayed + 1

  const next: GameState = { ...state, currentPlayer: nextIndex, roundsPlayed: nextRounds }
  // If we've reached the max rounds, end the game
  if (nextRounds >= state.maxRounds) {
    const ended = { ...next, started: false }
    saveState(ended)
    return ended
  }

  saveState(next)
  return next
}

// Backwards-compatible generic addScore -> add Radianite Points (RP)
export function addScore(state: GameState, playerId: string, points: number): GameState {
  return addRadianite(state, playerId, points)
}

export function addRadianite(state: GameState, playerId: string, amount: number): GameState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, rp: p.rp + amount } : p))
  const next: GameState = { ...state, players }
  saveState(next)
  return next
}

export function addLoadoutPoints(state: GameState, playerId: string, amount: number): GameState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, lp: p.lp + amount } : p))
  const next: GameState = { ...state, players }
  saveState(next)
  return next
}

export function awardDuelWinner(state: GameState, winnerId: string): GameState {
  // +1 BP for winner, track duelWins for Pacifist Award
  const players = state.players.map((p) => (p.id === winnerId ? { ...p, bp: p.bp + 1, duelWins: p.duelWins + 1 } : p))
  const next: GameState = { ...state, players }
  saveState(next)
  return next
}

export function assignSpikeToRandomPlayer(state: GameState): GameState {
  if (state.players.length === 0) return state
  const index = Math.floor(Math.random() * state.players.length)
  const ownerId = state.players[index].id
  const spike = { ownerId, tile: Math.floor(Math.random() * 20) + 1, active: true, assignedAt: Date.now() }
  const next: GameState = { ...state, spike }
  saveState(next)
  return next
}

export function spawnSpikeOnTile(state: GameState, tile: number): GameState {
  const spike = { ownerId: state.spike?.ownerId ?? null, tile, active: true, assignedAt: Date.now() }
  const next: GameState = { ...state, spike }
  saveState(next)
  return next
}

export function resolveSpike(state: GameState, neutralizerId: string | null, spPoints = 1): GameState {
  // If neutralizerId provided, neutralizer gets SP. Otherwise owner gets SP.
  if (!state.spike || !state.spike.active) return state
  let players = state.players
  if (neutralizerId) {
    players = players.map((p) => (p.id === neutralizerId ? { ...p, sp: p.sp + spPoints } : p))
  } else if (state.spike.ownerId) {
    players = players.map((p) => (p.id === state.spike.ownerId ? { ...p, sp: p.sp + spPoints } : p))
  }
  const next: GameState = { ...state, players, spike: { ...(state.spike), active: false } }
  saveState(next)
  return next
}

export function applyPacifistAward(state: GameState, points = 2): GameState {
  const players = state.players.map((p) => (p.duelWins === 0 ? { ...p, pa: p.pa + points } : p))
  const next: GameState = { ...state, players }
  saveState(next)
  return next
}

export function movePlayerTo(state: GameState, playerId: string, position: number): GameState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, position } : p))
  const next: GameState = { ...state, players }
  saveState(next)
  return next
}

export function resetState(): GameState {
  const s = createEmptyState()
  saveState(s)
  return s
}
