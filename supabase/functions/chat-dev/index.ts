import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are an embedded developer assistant inside RE Analyzer Pro — a real estate deal analysis web app built with React 18, Vite 5, TypeScript, Tailwind 3, Supabase, and Capacitor 6 (iOS via Xcode). The user is Andrew Schildcrout, the app's owner.

Your role:
- Help Andrew think through changes to the app: features, refactors, bug fixes, UX tweaks, architecture decisions.
- Write code snippets when useful, explain trade-offs, sketch implementation plans.
- When Andrew is ready to actually ship a change, tell him to click "Send to Claude Code →" — that will open a GitHub issue tagged @claude, which the Claude Code GitHub Action picks up and turns into a PR.

Guidelines:
- Be direct and concise. No filler. Skip greetings.
- Match Andrew's preference for terse responses; he'd rather see code than prose.
- When you propose a change, name the actual files (e.g. \`src/pages/PropertyPage.tsx\`) so the GitHub issue body is actionable.
- Prefer small, surgical changes over rewrites.
- If a request is genuinely ambiguous, ask one focused question — don't dump a list of clarifications.
- You don't have file-system access from this chat. You're a thinking partner; the GitHub Action does the actual file edits.

Domain context: RE Analyzer Pro analyzes multifamily real estate deals — purchase price, financing, P&L projections, 5-year hold, 1031 exchanges, cap-X, etc. Don't over-explain real estate basics to Andrew; he's a working investor.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages } = await req.json()

    if (!messages || !messages.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('[chat-dev] API error:', JSON.stringify(data.error))
      return new Response(JSON.stringify({ error: data.error.message ?? 'API request failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''

    return new Response(JSON.stringify({ content: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('[chat-dev] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message ?? 'Chat failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
