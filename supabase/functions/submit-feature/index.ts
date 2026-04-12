import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, description, category, userEmail } = await req.json()

    if (!title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data, error } = await supabase
      .from('feature_requests')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category: category || 'general',
        user_email: userEmail || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[submit-feature] Insert error:', error.message)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Send email notification to admin via Postmark
    const postmarkKey = Deno.env.get('POSTMARK_API_KEY')
    if (postmarkKey) {
      try {
        let parsed: any = null
        try { parsed = JSON.parse(description ?? '') } catch { /* not structured JSON */ }

        const htmlBody = parsed?.userStory
          ? `<h2 style="margin:0 0 8px">${title}</h2>
             <p style="color:#666;margin:0 0 12px"><strong>Category:</strong> ${category} &nbsp;|&nbsp; <strong>Priority:</strong> ${parsed.priority ?? 'n/a'} &nbsp;|&nbsp; <strong>From:</strong> ${userEmail ?? 'unknown'}</p>
             <p style="margin:0 0 12px">${parsed.summary}</p>
             <p style="color:#888;font-style:italic;margin:0 0 12px">${parsed.userStory}</p>
             <p style="margin:0 0 4px"><strong>Acceptance Criteria:</strong></p>
             <ul style="margin:0 0 12px;padding-left:20px">${(parsed.acceptanceCriteria ?? []).map((c: string) => `<li>${c}</li>`).join('')}</ul>
             ${parsed.notes ? `<p style="color:#888;border-top:1px solid #eee;padding-top:8px;margin-top:12px">${parsed.notes}</p>` : ''}`
          : `<h2 style="margin:0 0 8px">${title}</h2>
             <p style="color:#666;margin:0 0 12px"><strong>Category:</strong> ${category} &nbsp;|&nbsp; <strong>From:</strong> ${userEmail ?? 'unknown'}</p>
             <pre style="white-space:pre-wrap;font-size:13px">${description ?? ''}</pre>`

        await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Postmark-Server-Token': postmarkKey,
          },
          body: JSON.stringify({
            From: 'RE Analyzer Pro <andrew@chaiholdings.com>',
            To: 'andrew@chaiholdings.com',
            Subject: `[Feature Request] ${title}`,
            HtmlBody: htmlBody,
            MessageStream: 'outbound',
          }),
        })
      } catch (emailErr: any) {
        // Don't fail the request if email fails — feature is already saved
        console.error('[submit-feature] Email error:', emailErr.message)
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('[submit-feature] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message ?? 'Submission failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
