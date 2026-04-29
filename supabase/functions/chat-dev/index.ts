import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REPO = '3JTexas/RE-Analyzer-Pro'
const DEFAULT_REF = 'design-refresh'
const MAX_FILE_BYTES = 300_000
const MAX_TOOL_ITERATIONS = 25

const SYSTEM_PROMPT = `You are an embedded developer assistant inside RE Analyzer Pro — a real estate deal analysis web app built with React 18, Vite 5, TypeScript, Tailwind 3, Supabase, and Capacitor 6 (iOS via Xcode). The user is Andrew Schildcrout, the app's owner.

You have READ access to the GitHub repo ${REPO} via tools:
- read_file(path, ref?) — read a file from the repo
- list_directory(path, ref?) — list directory contents
- grep_repo(pattern, path?) — search file contents with a regex/string pattern

Default branch for unspecified refs: ${DEFAULT_REF}. Use main only when explicitly asked about prod.

Your role:
- Help Andrew think through changes: features, refactors, bug fixes, UX tweaks, architecture decisions.
- Read the actual code with your tools BEFORE answering questions about how something works. Don't speculate when you can verify in 2-3 tool calls.
- When proposing a change, name the files and quote the relevant snippets so the GitHub issue body (created when Andrew clicks "Send to Claude Code") is precise and actionable.
- When ready to ship, tell Andrew to click "Send to Claude Code →" — that opens a GitHub issue tagged @claude, which the Claude Code GitHub Action picks up and turns into a PR.

Guidelines:
- Be direct and concise. No filler. Skip greetings.
- Match Andrew's preference for terse responses; show code, not prose.
- Prefer small, surgical changes over rewrites.
- If a request is genuinely ambiguous AFTER reading the relevant code, ask one focused question.
- You cannot write files. Tools are read-only. The Claude Code GitHub Action does the file edits via a PR.

Tool-use efficiency (IMPORTANT):
- You have a hard cap of ${MAX_TOOL_ITERATIONS} tool-call iterations per chat turn. Budget them.
- Plan your reads: pick the 4-6 files most likely to contain the answer, read them, then write your final answer. Do not chain dozens of small reads.
- Use grep_repo + list_directory to locate symbols BEFORE reading large files.
- Once you have enough to answer, STOP calling tools and produce a final text response — even if some open questions remain (call them out at the end).
- If you do hit the iteration cap, your final turn will be re-prompted with no tools available, so make sure to track what you've learned so far.

Domain context: RE Analyzer Pro analyzes multifamily real estate deals — purchase price, financing, P&L projections, 5-year hold, 1031 exchanges, cap-X, depreciation, tax benefits. Don't over-explain RE basics; Andrew is a working investor.`

const TOOLS = [
  {
    name: 'read_file',
    description: `Read a file from the ${REPO} repository. Returns the raw text content. Files >${MAX_FILE_BYTES} bytes are rejected — narrow your read with grep_repo first.`,
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root, e.g. "src/types/index.ts"' },
        ref: { type: 'string', description: `Git ref. Defaults to "${DEFAULT_REF}".` },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: `List entries (files and subdirs) at a directory path in the ${REPO} repo. Pass empty string for repo root.`,
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to repo root. Empty string for root.' },
        ref: { type: 'string', description: `Git ref. Defaults to "${DEFAULT_REF}".` },
      },
      required: ['path'],
    },
  },
  {
    name: 'grep_repo',
    description: `Search file contents in the ${REPO} repo for a pattern using GitHub code search. Returns matching files with line context. Use this before read_file when you need to find a symbol or string and don't know which file it lives in.`,
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'String or symbol to search for.' },
        path: { type: 'string', description: 'Optional path filter (e.g. "src" or "supabase/functions").' },
      },
      required: ['pattern'],
    },
  },
]

function ghHeaders(): Record<string, string> {
  const token = Deno.env.get('GITHUB_REPO_TOKEN') ?? ''
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RE-Analyzer-DevChat',
  }
}

function b64decode(s: string): string {
  const bin = atob(s.replace(/\n/g, ''))
  // Handle UTF-8
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

async function tool_read_file(input: { path: string; ref?: string }): Promise<string> {
  const ref = input.ref ?? DEFAULT_REF
  const url = `https://api.github.com/repos/${REPO}/contents/${input.path}?ref=${encodeURIComponent(ref)}`
  const r = await fetch(url, { headers: ghHeaders() })
  if (!r.ok) {
    const t = await r.text()
    return `Error ${r.status}: ${t.slice(0, 500)}`
  }
  const data = await r.json()
  if (Array.isArray(data)) return `${input.path} is a directory, not a file. Use list_directory instead.`
  if (typeof data.size === 'number' && data.size > MAX_FILE_BYTES) {
    return `File too large (${data.size} bytes, limit ${MAX_FILE_BYTES}). Use grep_repo to narrow.`
  }
  if (data.encoding === 'base64' && typeof data.content === 'string') {
    return b64decode(data.content)
  }
  if (data.download_url) {
    const r2 = await fetch(data.download_url)
    if (r2.ok) return await r2.text()
  }
  return `Could not read file: unexpected response shape.`
}

async function tool_list_directory(input: { path: string; ref?: string }): Promise<string> {
  const ref = input.ref ?? DEFAULT_REF
  const url = `https://api.github.com/repos/${REPO}/contents/${input.path}?ref=${encodeURIComponent(ref)}`
  const r = await fetch(url, { headers: ghHeaders() })
  if (!r.ok) {
    const t = await r.text()
    return `Error ${r.status}: ${t.slice(0, 500)}`
  }
  const data = await r.json()
  if (!Array.isArray(data)) return `${input.path} is a file, not a directory. Use read_file.`
  const lines = data
    .sort((a: any, b: any) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    .map((d: any) => `${d.type === 'dir' ? '[d]' : '[f]'} ${d.path}${d.type === 'file' && typeof d.size === 'number' ? ` (${d.size}b)` : ''}`)
    .join('\n')
  return lines || '(empty directory)'
}

async function tool_grep_repo(input: { pattern: string; path?: string }): Promise<string> {
  const parts = [input.pattern, `repo:${REPO}`]
  if (input.path) parts.push(`path:${input.path}`)
  const q = encodeURIComponent(parts.join(' '))
  const url = `https://api.github.com/search/code?q=${q}&per_page=20`
  const r = await fetch(url, { headers: ghHeaders() })
  if (!r.ok) {
    const t = await r.text()
    return `Error ${r.status}: ${t.slice(0, 500)}`
  }
  const data = await r.json()
  const items = (data.items || []) as any[]
  if (items.length === 0) return `No matches for "${input.pattern}"${input.path ? ` in path:${input.path}` : ''}.`
  const lines: string[] = []
  for (const it of items.slice(0, 20)) {
    lines.push(`- ${it.path}`)
    if (Array.isArray(it.text_matches)) {
      for (const tm of it.text_matches.slice(0, 3)) {
        const frag = (tm.fragment || '').replace(/\s+/g, ' ').slice(0, 200)
        if (frag) lines.push(`    ${frag}`)
      }
    }
  }
  if (data.total_count > items.length) lines.push(`(showing first ${items.length} of ${data.total_count} matches)`)
  return lines.join('\n')
}

async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case 'read_file':       return await tool_read_file(input)
      case 'list_directory':  return await tool_list_directory(input)
      case 'grep_repo':       return await tool_grep_repo(input)
      default:                return `Unknown tool: ${name}`
    }
  } catch (e: any) {
    return `Tool ${name} failed: ${e.message ?? String(e)}`
  }
}

async function callAnthropic(messages: any[], opts: { withTools?: boolean } = {}) {
  const withTools = opts.withTools ?? true
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      ...(withTools ? { tools: TOOLS } : {}),
      messages,
    }),
  })
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages: incoming } = await req.json()
    if (!incoming?.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Convert incoming chat history to Anthropic message format.
    // Each incoming message is { role, content } where content is a plain string from the UI.
    const messages: any[] = incoming.map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    }))

    let finalText = ''
    let iterations = 0

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++
      const data = await callAnthropic(messages)

      if (data.error) {
        console.error('[chat-dev] API error:', JSON.stringify(data.error))
        return new Response(JSON.stringify({ error: data.error.message ?? 'API request failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Append the assistant's full content (including tool_use blocks) so the next
      // turn carries them and the tool_result blocks can reference the tool_use_ids.
      messages.push({ role: 'assistant', content: data.content })

      if (data.stop_reason !== 'tool_use') {
        // Final answer — collect text blocks.
        finalText = (data.content || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n')
        break
      }

      // Execute every tool_use block in this assistant turn, in order.
      const toolUses = (data.content || []).filter((b: any) => b.type === 'tool_use')
      const toolResults: any[] = []
      for (const tu of toolUses) {
        const result = await executeTool(tu.name, tu.input ?? {})
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result,
        })
      }

      messages.push({ role: 'user', content: toolResults })
    }

    if (!finalText) {
      // Hit iteration cap. Re-prompt without tools so Claude can summarize
      // what it learned from the reads so far instead of returning a useless
      // "limit reached" message.
      messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: 'You\'ve reached the tool-use iteration cap. Stop calling tools and produce your best final answer based on what you\'ve read so far. If there are gaps you couldn\'t resolve, list them at the end so the user can clarify.',
        }],
      })
      const final = await callAnthropic(messages, { withTools: false })
      finalText = (final.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
      if (!finalText) {
        finalText = '(Reached tool-use iteration limit and could not produce a final summary. Try narrowing the question.)'
      }
    }

    return new Response(JSON.stringify({ content: finalText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e: any) {
    console.error('[chat-dev] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message ?? 'Chat failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
