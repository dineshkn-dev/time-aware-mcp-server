# Time Aware MCP Server

An MCP (Model Context Protocol) server that makes your ChatGPT Plus account **time-aware** across all conversations. It provides the exact current date and time so ChatGPT can respond with accurate temporal context in every message.

## Features

- **`get_current_datetime` tool** – Returns the current date, time, timezone, day of week, and Unix timestamp
- **Optional timezone parameter** – Get the time in any IANA timezone (e.g., `America/New_York`)
- **Vercel-ready** – Deploy for free on Vercel's Hobby plan
- **ChatGPT Custom Apps compatible** – Add as a Connector in ChatGPT

## Deploy to Vercel

1. **Push to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/dineshkn-dev/time-aware-mcp-server.git
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - (Optional) Add environment variable **`DEFAULT_TIMEZONE`** to use your timezone by default – use [IANA names](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (e.g. `America/New_York`, `Europe/London`, `Asia/Tokyo`) – otherwise uses India (Asia/Kolkata)
   - Deploy
   - Your MCP endpoint will be: `https://YOUR_PROJECT.vercel.app/api/mcp`
   - **Note**: Vercel Hobby (free) tier limits serverless functions to 10 seconds. This MCP server typically responds in milliseconds.

### GitHub website URL (optional)

Vercel automatically adds the deployment URL to your GitHub repo's "Website" field. To avoid exposing the endpoint:

1. On GitHub: repo → **About** (gear icon) → set **Website** to your repo URL (e.g. `https://github.com/dineshkn-dev/time-aware-mcp-server`) instead of leaving it blank. Vercel won't overwrite it.
2. Add optional auth (see [Authentication](#authentication) below).

## Authentication

To restrict access, set **`MCP_AUTH_TOKEN`** in Vercel (Project → Settings → Environment Variables). When set, requests must include either:

- **Header**: `Authorization: Bearer <your-token>`
- **Query param**: `?token=<your-token>` (use this in the ChatGPT Connector URL: `https://your-project.vercel.app/api/mcp?token=your-secret`)

Use a long, random string (e.g. from `openssl rand -hex 32`). Unauthenticated requests return `401 Unauthorized`.

## Connect to ChatGPT Plus

1. **Enable Developer Mode**:
   - Go to **Settings → Apps & Connectors → Advanced settings**
   - Toggle **Developer mode** on (if your organization allows it)

2. **Create the Connector**:
   - Go to **Settings → Connectors → Create**
   - **Connector name**: `Time Aware` (or any name you prefer)
   - **Description**: `Provides the exact current date and time. Makes conversations time-aware so ChatGPT includes date/time in responses.`
   - **Connector URL**: `https://YOUR_PROJECT.vercel.app/api/mcp` (or add `?token=YOUR_MCP_AUTH_TOKEN` if using auth)
   - Click **Create**

3. **Use in conversations**:
   - Start a new chat
   - Click the **+** button near the message composer → **More**
   - Select your Time Aware connector
   - ChatGPT will now have access to the time tool and can include date/time in responses

## Usage Tips

- **For every message**: The tool description instructs ChatGPT to call it for temporal context. In new conversations, you can also prompt: *"Always include the current date and time when you respond."*
- **Specific timezone**: Ask *"What time is it in Tokyo?"* – ChatGPT can call the tool with `timezone: "Asia/Tokyo"`.
- **Scheduling**: *"What day is it today?"* or *"Remind me – what's the date?"* will trigger the tool.

## Local Development

```bash
# Install dependencies
npm install

# Optional: Copy .env.example to .env and set DEFAULT_TIMEZONE
# cp .env.example .env

# Run development server
npm run dev
```

Then test with the MCP Inspector:
```bash
pnpm dlx @modelcontextprotocol/inspector@latest http://localhost:3000/api/mcp
```

Open http://127.0.0.1:6274 and connect to `http://localhost:3000/api/mcp`.

For local ChatGPT testing, expose your local server with [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), then use the public URL as the Connector URL.

## Configurable Timezone

**How timezone is resolved** (in order of priority):

1. **Tool parameter** – When ChatGPT calls the tool with `timezone: "America/New_York"`, that timezone is used
2. **`DEFAULT_TIMEZONE` env** – Set in Vercel: Project → Settings → Environment Variables. Use IANA names (e.g. `America/New_York`, `Europe/London`)
3. **Default** – `Asia/Kolkata` (India Standard Time)

**Timezone reference** – Use IANA timezone names. See the [full list of valid values](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (e.g. `America/New_York`, `Europe/London`, `Asia/Tokyo`).

To set your preferred timezone in Vercel:

1. Project → **Settings** → **Environment Variables**
2. Add `DEFAULT_TIMEZONE` = `America/New_York` (or your IANA timezone)
3. Redeploy

## Technical Details

- Built with [Next.js 15](https://nextjs.org/) and [mcp-handler](https://github.com/vercel/mcp-handler)
- Uses `@modelcontextprotocol/sdk@1.25.2` (required by mcp-handler; upgrade to 1.26.0 when mcp-handler supports it)
- Node.js 18+ required
- Uses Streamable HTTP transport (MCP standard)
- Single tool: `get_current_datetime` with optional `timezone` parameter
- Timezone: tool param → `DEFAULT_TIMEZONE` env → `Asia/Kolkata` (India)
