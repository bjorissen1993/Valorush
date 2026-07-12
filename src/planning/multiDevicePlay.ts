/**
 * FUTURE ARCHITECTURE — multi-device play
 *
 * MVP implemented: WebSocket lobby rooms (server/index.ts), create/join flow,
 * optional Twitch OAuth identity, real-time waiting room sync (players + agents).
 * Gameplay still runs on the host screen only; see SpectatorWaitingPage.
 *
 * Deferred:
 * - Server-authoritative game state sync across clients
 * - IRC !join / live-chatter auto-invite into rooms
 * - Production deployment of lobby server + OAuth proxy
 */

export {};
