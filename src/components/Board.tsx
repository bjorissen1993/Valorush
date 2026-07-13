import React, { useState } from 'react'
import {
  GameState,
  movePlayerTo,
  nextTurn,
  addRadianite,
  addLoadoutPoints,
  awardDuelWinner,
  spawnSpikeOnTile,
  assignSpikeToRandomPlayer,
  resetState,
} from '../gameState'

type Props = {
  state: GameState
  setState: React.Dispatch<React.SetStateAction<GameState>>
}

const BOARD_SIZE = 20

type TileType = 'empty' | 'rp' | 'spike' | 'duel' | 'shop'

const tiles: TileType[] = Array.from({ length: BOARD_SIZE }).map((_, i) => {
  if (i % 7 === 0) return 'spike'
  if (i % 5 === 0) return 'shop'
  if (i % 3 === 0) return 'duel'
  if (i % 2 === 0) return 'rp'
  return 'empty'
})

function initials(name: string) {
  return name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Board({ state, setState }: Props) {
  const current = state.players[state.currentPlayer]
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [modal, setModal] = useState<{ tile: number; type: TileType } | null>(null)

  function tokensForTile(idx: number) {
    return state.players.filter((p) => p.position === idx)
  }

  async function rollDice() {
    if (!current) return
    const roll = Math.floor(Math.random() * 6) + 1
    setLastRoll(roll)
    const from = current.position || 0
    const to = (from + roll) % BOARD_SIZE

    // persist move
    setState((s) => movePlayerTo(s, current.id, to))

    // show event
    const t = tiles[to]
    setModal({ tile: to, type: t })

    // auto-resolve simple events after short delay
    await new Promise((r) => setTimeout(r, 250))
    if (t === 'rp') {
      const amt = Math.floor(Math.random() * 3) + 1
      setState((s) => addRadianite(s, current.id, amt))
      setModal(null)
      setTimeout(() => setState((s) => nextTurn(s)), 200)
    } else if (t === 'shop') {
      setState((s) => addLoadoutPoints(s, current.id, 1))
      setModal(null)
      setTimeout(() => setState((s) => nextTurn(s)), 200)
    } else if (t === 'spike' || t === 'duel') {
      // wait for user resolution in modal
    } else {
      setModal(null)
      setTimeout(() => setState((s) => nextTurn(s)), 200)
    }
  }

  function resolveSpikeSpawnHere(tile: number) {
    setState((s) => spawnSpikeOnTile(s, tile))
    setModal(null)
    setTimeout(() => setState((s) => nextTurn(s)), 200)
  }

  function resolveSpikeLetOwner(tile: number) {
    // owner is current (we moved them there)
    setState((s) => ({ ...s, spike: { ownerId: current?.id ?? null, tile, active: true, assignedAt: Date.now() } }))
    setModal(null)
    setTimeout(() => setState((s) => nextTurn(s)), 200)
  }

  function resolveDuelRandom() {
    if (!current) return
    const opponents = state.players.filter((p) => p.id !== current.id)
    if (opponents.length === 0) return
    const winner = opponents[Math.floor(Math.random() * opponents.length)]
    setState((s) => awardDuelWinner(s, winner.id))
    setModal(null)
    setTimeout(() => setState((s) => nextTurn(s)), 200)
  }

  function resolveDuelChoose(playerId: string) {
    setState((s) => awardDuelWinner(s, playerId))
    setModal(null)
    setTimeout(() => setState((s) => nextTurn(s)), 200)
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-semibold">Current turn: {current ? current.name : '—'}</div>
          <div className="text-sm text-gray-600">RP:{current ? current.rp : 0} · BP:{current ? current.bp : 0} · SP:{current ? current.sp : 0}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm">Laatste worp: {lastRoll ?? '—'}</div>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={rollDice} disabled={!current}>
            Werp dobbelsteen
          </button>
          <button className="px-2 py-1 bg-gray-300 rounded" onClick={() => setState(resetState())}>Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: BOARD_SIZE }).map((_, idx) => (
          <div key={idx} className="p-2 border rounded bg-white/80">
            <div className="text-xs text-gray-500">#{idx}</div>
            <div className="font-medium">{tiles[idx]}</div>
            <div className="mt-2 flex gap-1 flex-wrap">
              {tokensForTile(idx).map((p) => (
                <div key={p.id} className="px-2 py-0.5 bg-gray-800 text-white rounded text-xs">{initials(p.name)}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal simple */}
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-white p-4 rounded max-w-sm w-full">
            <h3 className="font-semibold mb-2">Tile event: {modal.type} (#{modal.tile})</h3>
            {modal.type === 'rp' && <p>Radianite ontvangen, automatisch verwerkt.</p>}
            {modal.type === 'shop' && <p>Shop: Loadout point gekregen, automatisch verwerkt.</p>}
            {modal.type === 'spike' && (
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => resolveSpikeLetOwner(modal.tile)}>Laat owner spawnen</button>
                <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => resolveSpikeSpawnHere(modal.tile)}>Spawn spike hier</button>
                <button className="px-3 py-1 bg-gray-300 rounded" onClick={() => { setState((s) => assignSpikeToRandomPlayer(s)); setModal(null); setTimeout(() => setState((s) => nextTurn(s)), 200) }}>Wijs willekeurig toe</button>
              </div>
            )}
            {modal.type === 'duel' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 flex-wrap">
                  {state.players.map((p) => (
                    <button key={p.id} className="px-3 py-1 bg-red-600 text-white rounded text-sm" onClick={() => resolveDuelChoose(p.id)}>{p.name} wint</button>
                  ))}
                </div>
                <div className="mt-2">
                  <button className="px-3 py-1 bg-gray-300 rounded" onClick={resolveDuelRandom}>Random winnaar</button>
                </div>
              </div>
            )}

            <div className="mt-3 text-right">
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setModal(null); setTimeout(() => setState((s) => nextTurn(s)), 200) }}>Sluit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
