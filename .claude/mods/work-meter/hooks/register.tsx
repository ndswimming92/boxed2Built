import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Tokens } from '../types'

const PANE = 'work-meter'
const IDLE: Activity = {
  isBusy: false,
  label: 'Idle',
  steps: 0,
  toolsDone: 0,
  toolsRunning: 0,
  startedAt: 0,
  endedAt: 0,
}
const ZERO: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

// Change a shape tag when that value's fields change.
const activity = atom({ plugin: 'work-meter', key: 'activity' } as const, IDLE, { shape: 'activity-1' })
const tokens = atom({ plugin: 'work-meter', key: 'tokens' } as const, ZERO, { shape: 'tokens-1' })
const costUsd = atom({ plugin: 'work-meter', key: 'costUsd' } as const, null as number | null)
const contextPercent = atom({ plugin: 'work-meter', key: 'contextPercent' } as const, null as number | null)

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
const money = (usd: number | null) => (usd === null ? '—' : `$${usd.toFixed(usd < 1 ? 3 : 2)}`)

function describe(tool: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>
  const hint =
    (typeof i.description === 'string' && i.description) ||
    (typeof i.file_path === 'string' && i.file_path.split('/').pop()) ||
    (typeof i.pattern === 'string' && i.pattern) ||
    ''
  const text = hint ? `${tool}: ${hint}` : tool
  return text.length > 60 ? `${text.slice(0, 57)}...` : text
}

async function refresh($: EngineInterface) {
  const usage = await $.session.usage()
  const usd = usage.cost?.usd ?? null
  await update($, costUsd, () => usd)
  await update($, contextPercent, () => usage.context.percent ?? null)
  const t = await read($, tokens)
  const a = await read($, activity)
  $.ui.status(
    `${a.isBusy ? '● ' : ''}${fmt(t.input + t.cacheRead + t.cacheWrite)} in · ${fmt(t.output)} out · ~${money(usd)}`,
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'meter', description: 'Open the work meter (activity, tokens, cost)' })
    void $.ui.open({ id: PANE, title: 'Work meter' })
    const ran = await next(e)
    await refresh($)
    return ran
  })

  on('command.run', { command: 'meter' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Work meter' })
    return { text: 'Work meter opened.' }
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, activity, () => ({ ...IDLE, isBusy: true, label: 'Reading your request', startedAt: now }))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      await update($, activity, a => ({ ...a, isBusy: true, steps: a.steps + 1, label: 'Thinking' }))
    }
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      await update($, tokens, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
      }))
    }
    await refresh($)
    return r
  })

  on('tool.call', async ($, e, next) => {
    const label = `${e.agentId ? 'Subagent · ' : ''}${describe(e.tool, e)}`
    await update($, activity, a => ({ ...a, isBusy: true, label, toolsRunning: a.toolsRunning + 1 }))
    try {
      return await next(e)
    } finally {
      await update($, activity, a => ({
        ...a,
        toolsRunning: Math.max(0, a.toolsRunning - 1),
        toolsDone: a.toolsDone + 1,
        label: a.toolsRunning <= 1 ? 'Thinking' : a.label,
      }))
    }
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const now = await $.clock.now()
    await update($, activity, a => ({
      ...a,
      isBusy: false,
      toolsRunning: 0,
      endedAt: now,
      label: 'Done — waiting for you',
    }))
    await refresh($)
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Progress } = $.ui.resolve(e)
    const a = await read($, activity)
    const t = await read($, tokens)
    const usd = await read($, costUsd)
    const pct = await read($, contextPercent)
    const end = a.isBusy ? await $.clock.now() : a.endedAt
    const secs = a.startedAt ? Math.max(0, Math.round((end - a.startedAt) / 1000)) : 0
    const width = Math.max(10, Math.min(40, (e.viewport?.columns ?? 40) - 4))
    const filled = Math.round((Math.min(100, pct ?? 0) / 100) * width)
    const ctxColor = (pct ?? 0) > 80 ? 'red' : (pct ?? 0) > 60 ? 'yellow' : 'green'
    const summary = `step ${a.steps} · ${a.toolsDone} tools · ${secs}s`

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Now</Text>
          <Text>{a.label}</Text>
          {a.isBusy ? (
            <Progress label={a.label} valueText={summary} />
          ) : a.startedAt ? (
            <Progress label="Turn finished" value={1} max={1} valueText={summary} />
          ) : (
            <Text dimColor>Nothing running yet.</Text>
          )}
          <Text dimColor>
            {summary}
            {a.toolsRunning ? ` · ${a.toolsRunning} running` : ''}
          </Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>Tokens (this session)</Text>
          <Text>
            Input {fmt(t.input)} · Output {fmt(t.output)}
          </Text>
          <Text dimColor>
            Cache read {fmt(t.cacheRead)} · Cache write {fmt(t.cacheWrite)}
          </Text>
          <Text>Total {fmt(t.input + t.output + t.cacheRead + t.cacheWrite)}</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>Context window{pct === null ? '' : ` ${Math.round(pct)}%`}</Text>
          <Box flexDirection="row">
            {filled > 0 && <Box width={filled} height={1} backgroundColor={ctxColor} />}
            {width - filled > 0 && <Box width={width - filled} height={1} backgroundColor="gray" />}
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold>Cost {money(usd)}</Text>
          <Text dimColor>Estimate at list prices, not your bill.</Text>
        </Box>
      </Box>
    )
  })
}
