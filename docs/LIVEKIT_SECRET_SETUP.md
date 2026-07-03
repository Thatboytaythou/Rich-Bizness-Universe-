# LiveKit Secret Setup

The live studio is already wired to the Supabase Edge Function:

- Function: `livekit-token`
- Project: `xfsrqomsiulswbalgknx`
- LiveKit URL: `wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud`
- JWT required: yes

## Required Supabase secrets

Set these in Supabase, not GitHub and not the frontend:

```bash
LIVEKIT_API_KEY=<your actual LiveKit API key>
LIVEKIT_API_SECRET=<your actual LiveKit API secret>
LIVEKIT_URL=wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud
```

## Supabase CLI command

```bash
supabase secrets set \
  LIVEKIT_API_KEY="<your actual LiveKit API key>" \
  LIVEKIT_API_SECRET="<your actual LiveKit API secret>" \
  LIVEKIT_URL="wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud" \
  --project-ref xfsrqomsiulswbalgknx
```

## Dashboard path

Supabase Dashboard → Project `xfsrqomsiulswbalgknx` → Edge Functions → Secrets → Add New Secret

Add:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL`

## What happens after secrets are set

1. Open `/live.html`.
2. Sign in.
3. Tap `PREVIEW CAM`.
4. Allow camera and microphone.
5. Tap `GO LIVE 🔴`.
6. The frontend calls `/functions/v1/livekit-token`.
7. The Edge Function signs a LiveKit token.
8. The browser connects to LiveKit and publishes camera/mic tracks.
9. `live_streams`, `live_stream_members`, and `live_view_sessions` are updated in Supabase.

## Do not commit secrets

Never put the API key or secret into:

- `src/live-tv.js`
- `index.html`
- `package.json`
- any public `.env` file

The only public value is the LiveKit URL.
