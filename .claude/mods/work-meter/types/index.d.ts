export type Activity = {
  isBusy: boolean
  label: string
  steps: number
  toolsDone: number
  toolsRunning: number
  startedAt: number
  endedAt: number
}

export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

declare module 'claude-code' {
  interface PluginState {
    'work-meter': {
      activity: Shaped<Activity>
      tokens: Shaped<Tokens>
      costUsd: number | null
      contextPercent: number | null
    }
  }
}
