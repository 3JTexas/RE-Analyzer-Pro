import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a product manager assistant for RE Analyzer Pro, a real estate deal analysis application. Your job is to help users articulate feature requests clearly through a brief conversational Q&A.

The app includes: 6-tab underwriting model (Broker, Flags, Inputs, P&L, Tax, Compare), deal pipeline tracking, 1031 exchange analysis, crime maps, PDF/Excel export, LOI generator, property photo upload, and a Claude-powered deal assistant chat.

## Your process:
1. The user will describe a feature idea (possibly vague or brief).
2. Ask 1-2 focused clarifying questions to understand: what exactly they want, where in the app it fits, and what problem it solves. Keep questions short and specific. Don't ask more than 2 questions per turn.
3. Once you have enough detail (usually after 1-3 exchanges total), produce the final structured feature request.

## When ready, output the feature request in this EXACT format:

---FEATURE_REQUEST---
{
  "title": "Short descriptive title (under 80 chars)",
  "category": "one of: general, underwriting, pipeline, tax, reporting, mobile, other",
  "summary": "1-2 sentence plain-English summary of the feature",
  "userStory": "As a [user type], I want [action] so that [benefit]",
  "acceptanceCriteria": ["criterion 1", "criterion 2", "criterion 3"],
  "priority": "one of: nice-to-have, should-have, must-have (your recommendation based on impact)",
  "notes": "Any implementation notes or considerations"
}
---END_FEATURE_REQUEST---

## Rules:
- Be conversational and brief. No walls of text.
- Don't ask unnecessary questions — if the user's description is already clear, go straight to generating the feature request.
- Always produce the structured output when you have enough info. Don't keep asking forever.
- The structured JSON block must be valid JSON between the ---FEATURE_REQUEST--- and ---END_FEATURE_REQUEST--- markers.
- Include a brief conversational message before the structured block, like "Here's your feature request — review it and hit Submit if it looks good:"
- If the user provides corrections after seeing the structured output, regenerate it with the updates.`

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('[refine-feature] API error:', JSON.stringify(data.error))
      return new Response(JSON.stringify({ error: data.error.message ?? 'API request failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''

    // Check if the response contains a structured feature request
    const featureMatch = text.match(/---FEATURE_REQUEST---\s*([\s\S]*?)\s*---END_FEATURE_REQUEST---/)
    let featureRequest = null
    let displayText = text

    if (featureMatch) {
      try {
        featureRequest = JSON.parse(featureMatch[1].trim())
        // Remove the JSON block from display text, keep only the conversational part
        displayText = text.replace(/---FEATURE_REQUEST---[\s\S]*?---END_FEATURE_REQUEST---/, '').trim()
      } catch {
        // JSON parse failed — just return as regular text
      }
    }

    return new Response(JSON.stringify({ content: displayText, featureRequest }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('[refine-feature] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message ?? 'Failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
