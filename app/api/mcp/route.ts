import { type NextRequest } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const DEFAULT_TZ = "Asia/Kolkata";

/**
 * Optional: When MCP_AUTH_TOKEN is set, require valid token via:
 * - Authorization: Bearer <token> header, or
 * - ?token=<token> query parameter (for ChatGPT connector URL)
 */
function isAuthenticated(req: NextRequest): boolean {
  const secret = process.env.MCP_AUTH_TOKEN?.trim();
  if (!secret) return true;

  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const queryToken = req.nextUrl.searchParams.get("token");

  return bearer === secret || queryToken === secret;
}

/**
 * Returns true if this looks like an MCP client request (has session or expects SSE).
 * Plain browser GETs lack these headers and get a friendly response instead.
 */
function isMcpClientRequest(req: NextRequest): boolean {
  const sessionId = req.headers.get("mcp-session-id");
  const accept = req.headers.get("accept") ?? "";
  return !!(sessionId || accept.includes("text/event-stream"));
}

/**
 * Resolve the effective timezone:
 * 1. Tool parameter (explicit request from user/ChatGPT)
 * 2. DEFAULT_TIMEZONE env var (configured in Vercel project settings)
 * 3. Asia/Kolkata (India) as default
 */
function resolveTimezone(requestedTimezone?: string): string {
  if (requestedTimezone?.trim()) {
    return requestedTimezone.trim();
  }
  const envTimezone = process.env.DEFAULT_TIMEZONE?.trim();
  if (envTimezone && isValidTimezone(envTimezone)) {
    return envTimezone;
  }
  return DEFAULT_TZ;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Get comprehensive current date and time information for a given timezone.
 * @param timezone IANA timezone (e.g. America/New_York). Uses resolved default if omitted.
 */
function getCurrentDateTimeInfo(timezone?: string) {
  const now = new Date();
  const tz = resolveTimezone(timezone);

  const locale = "en-US";
  const baseOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  };

  const formattedFull = now.toLocaleString(locale, baseOptions);
  const formattedDate = now.toLocaleDateString(locale, {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = now.toLocaleTimeString(locale, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  const isoString = now.toISOString();
  const unixTimestamp = Math.floor(now.getTime() / 1000);

  return {
    iso8601: isoString,
    formatted: formattedFull,
    date: formattedDate,
    time: formattedTime,
    timezone: tz,
    dayOfWeek: now.toLocaleDateString(locale, {
      timeZone: tz,
      weekday: "long",
    }),
    unixTimestamp,
  };
}

const handler = createMcpHandler(
  async (server) => {
    // Primary tool: Get current date and time
    // CRITICAL for temporal awareness - ChatGPT should call this to provide accurate date/time in responses
    server.registerTool(
      "get_current_datetime",
      {
        title: "Get Current Date and Time",
        description:
          "Returns the exact current date and time. " +
          "IMPORTANT: Call this tool at the start of conversations and when the user's message may benefit from temporal context. " +
          "Include the returned date and time in your response so the user knows exactly when you are responding. " +
          "This keeps the conversation time-aware across all messages.",
        inputSchema: z.object({
          timezone: z
            .string()
            .optional()
            .transform((val) => (val === "" ? undefined : val))
            .describe(
              "Optional IANA timezone (e.g. 'America/New_York', 'Europe/London'). Omit to use DEFAULT_TIMEZONE env (if set) or Asia/Kolkata (India)."
            ),
        }),
      },
      async ({ timezone }) => {
        let info;
        let fallbackUsed = false;

        if (timezone && !isValidTimezone(timezone)) {
          info = getCurrentDateTimeInfo(undefined);
          fallbackUsed = true;
        } else {
          info = getCurrentDateTimeInfo(timezone);
        }

        let result =
          `**Current Date & Time**\n` +
          `- **Full**: ${info.formatted}\n` +
          `- **ISO 8601**: ${info.iso8601}\n` +
          `- **Date**: ${info.date}\n` +
          `- **Time**: ${info.time}\n` +
          `- **Timezone**: ${info.timezone}\n` +
          `- **Day of Week**: ${info.dayOfWeek}\n` +
          `- **Unix Timestamp**: ${info.unixTimestamp}`;

        if (fallbackUsed && timezone) {
          result += `\n\n_(Invalid timezone "${timezone}" – using configured/default timezone instead)_`;
        }

        return {
          content: [{ type: "text" as const, text: result }],
        };
      }
    );
  },
  {},
  {
    basePath: "/api",
    verboseLogs: process.env.NODE_ENV === "development",
    maxDuration: 60,
    disableSse: true,
  }
);

const FRIENDLY_GET_RESPONSE = {
  name: "Time Aware MCP Server",
  status: "running",
  mcp: "Connect with an MCP client (e.g. ChatGPT, MCP Inspector) using POST",
};

function requireAuth(req: NextRequest): Response | null {
  if (!isAuthenticated(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    if (!isMcpClientRequest(req)) {
      return Response.json(FRIENDLY_GET_RESPONSE, { status: 200 });
    }
    return await handler(req);
  } catch {
    return Response.json(FRIENDLY_GET_RESPONSE, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  return handler(req);
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  return handler(req);
}
