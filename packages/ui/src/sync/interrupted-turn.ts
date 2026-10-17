import type { StoreApi } from "zustand"
import type { Message, Part, StructuredError } from "@/lib/opencode/model"
import type { DirectoryStore } from "./child-store"

// ---------------------------------------------------------------------------
// Interrupted-turn reconciliation
//
// When OpenCode stops or fails a turn it says so: the live
// `session.execution.interrupted`/`failed` event, and the `idle` record it
// appends to the session's history with the same outcome. That explicit
// record marks a turn stopped here, and so does OpenCode answering a Stop with
// "nothing was running" (`closeInterruptedTurn` from the abort action). The
// server does not always finalize the trailing assistant message and its tool
// parts before the record (anomalyco/opencode#19023), so the record's turn is
// completed locally (`closedLocally`) and its orphaned tools become
// `error`/`Interrupted` with an end time — the same shape OpenCode itself
// writes for cancelled tools. The message carries the error OpenCode reported
// for a failed turn; `aborted` only when the turn was stopped or the failure
// came without one. A later terminal event can supersede the mark;
// a stale refresh cannot regress the locally final state.
//
// An idle status, a status snapshot that no longer lists a session, or an
// unfinished message alone never marks a turn: a turn run by another
// OpenCode process on the same database (the TUI, `opencode run`) looks
// exactly like that while it is still going (#4156).
export function interruptedTurnToolParts(
  state: DirectoryStore,
  sessionID: string,
  now = Date.now(),
  failure?: StructuredError,
): { messageID: string; messages: Message[]; parts?: Part[] } | null {
  if ((state.form?.[sessionID] ?? []).length > 0) return null
  if ((state.permission?.[sessionID] ?? []).length > 0) return null
  // A session that is running again belongs to its new turn.
  const status = state.session_status?.[sessionID]
  if (status && status.type !== "idle") return null

  const messages = state.message[sessionID] ?? []
  let messageIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index]
    if (candidate.role === "user") return null
    if (candidate.role !== "assistant") continue
    messageIndex = index
    break
  }
  if (messageIndex < 0) return null

  const message = messages[messageIndex]
  if (message.role !== "assistant") return null
  if (message.time.completed !== undefined) {
    // The turn finished; a missed terminal tool event is the tail refresh's
    // job, not an interruption.
    return null
  }

  const messageID = message.id
  const nextMessages = [...messages]
  const error: StructuredError = failure ?? { type: "aborted", message: "aborted" }
  nextMessages[messageIndex] = {
    ...message,
    time: { ...message.time, completed: now },
    error,
    closedLocally: true,
  }

  let partsChanged = false
  const currentParts = state.part[messageID]
  const nextParts = currentParts?.map((part) => {
    if (part.type !== "tool") return part
    if (part.state.status !== "pending" && part.state.status !== "running") return part
    partsChanged = true
    const start = part.state.status === "running" ? part.state.time.start : now
    return {
      ...part,
      state: {
        ...part.state,
        status: "error" as const,
        error: "Interrupted",
        time: { start, end: now },
      },
    }
  })

  return {
    messageID,
    messages: nextMessages,
    parts: partsChanged ? nextParts : undefined,
  }
}

/**
 * Completes the session's unfinished trailing turn as stopped (or failed with
 * `failure`) in the store. Callers decide that OpenCode said so.
 */
export function closeInterruptedTurn(
  store: StoreApi<DirectoryStore>,
  sessionID: string,
  failure?: StructuredError,
): void {
  const interrupted = interruptedTurnToolParts(store.getState(), sessionID, Date.now(), failure)
  if (!interrupted) return

  const interruptedParts = interrupted.parts
  if (!interruptedParts) {
    store.setState((current) => ({
      message: { ...current.message, [sessionID]: interrupted.messages },
    }))
    return
  }

  store.setState((current) => ({
    message: { ...current.message, [sessionID]: interrupted.messages },
    part: { ...current.part, [interrupted.messageID]: interruptedParts },
  }))
}
