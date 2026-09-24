import { createMCPClient } from "@ai-sdk/mcp";
import { dynamicTool, type ToolSet } from "ai";

// ThoughtSpot's Spotter MCP server is a hosted gateway, NOT a path on your
// own cluster — the cluster is identified by the `x-ts-host` header below.
// Unpinned so it tracks the latest tool set; ThoughtSpot recommends pinning
// with `?api-version=YYYY-MM-DD` for long-lived integrations.
const TS_MCP_URL = process.env.TS_MCP_URL || "https://agent.thoughtspot.app/token/mcp?api-version=latest";

export async function connectThoughtSpotMcp(authToken: string) {
  const host = (process.env.NEXT_PUBLIC_TS_HOST ?? "").replace(/^https?:\/\//, "");

  return createMCPClient({
    transport: {
      type: "http",
      url: TS_MCP_URL,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "x-ts-host": host,
      },
    },
  });
}

type McpClient = Awaited<ReturnType<typeof connectThoughtSpotMcp>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Pulls the parsed payload out of a tool result, whichever of the MCP
 *  spec's result shapes the server used. */
function extractToolJson(result: unknown): unknown {
  if (!isRecord(result)) return null;
  if (result.structuredContent != null) return result.structuredContent;
  if (result.toolResult != null) return result.toolResult;
  if (Array.isArray(result.content)) {
    const textPart = result.content.find(
      (part) => isRecord(part) && part.type === "text",
    );
    if (isRecord(textPart) && typeof textPart.text === "string") {
      try {
        return JSON.parse(textPart.text);
      } catch {
        return textPart.text;
      }
    }
  }
  return null;
}

// step_notification text comes verbatim from ThoughtSpot's backend and is
// shown in the UI without passing through Claude's wording first, so this is
// the only chance to catch a vendor mention before an operator sees it.
function sanitizeVendorMentions(text: string): string {
  return text.replace(/thoughtspot|spotter/gi, "the analysis");
}

function collectUpdateEvents(parsed: unknown): Array<Record<string, unknown>> {
  if (!isRecord(parsed)) return [];
  return Array.isArray(parsed.session_updates)
    ? parsed.session_updates.filter(isRecord)
    : [];
}

// POLL_TIMEOUT_MS is the limit that actually bites; MAX_POLLS is a backstop.
// Broad questions over a full history can legitimately take a couple of
// minutes, so these are deliberately generous.
const MAX_POLLS = 200;
const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 240_000;

/**
 * The MCP tool set for one chat turn, hard-locked to a single data model and
 * with `get_session_updates` replaced by a version that polls to completion
 * internally.
 *
 * Two things are enforced in code rather than by prompting, because
 * prompting is not a guarantee:
 *  - `search_objects` is removed. It searches the whole object catalog with
 *    no way to scope it to one data source, so a broad "what data do you
 *    have" question could surface unrelated datasets on the same instance.
 *  - `create_analysis_session` always has `data_source_id` forced, overriding
 *    whatever the model passes or omits.
 *
 * `get_session_updates` is wrapped because its documented contract is "call
 * repeatedly until is_done" — mechanical waiting that does not benefit from
 * an LLM turn per poll. Left raw, every poll costs a full round trip through
 * Claude on top of the network call. The wrapper keeps the same tool name and
 * input schema, but runs the loop in plain code and returns one accumulated
 * result, so a multi-poll wait is a single tool call from Claude's side.
 */
export async function getMarginalTools(mcpClient: McpClient, dataSourceId: string) {
  const mcpTools = await mcpClient.tools();
  const tools: ToolSet = { ...mcpTools };

  delete tools.search_objects;

  const sessionTool = tools.create_analysis_session;
  if (sessionTool?.execute) {
    const createExecute = sessionTool.execute;
    tools.create_analysis_session = dynamicTool({
      description:
        "Start an analysis session. The data source is fixed to this app's single connected data model — you don't need to, and cannot, specify a different one.",
      inputSchema: sessionTool.inputSchema,
      execute: async (input: unknown, options) => {
        const forced = isRecord(input)
          ? { ...input, data_source_id: dataSourceId }
          : { data_source_id: dataSourceId };
        return createExecute(forced, options);
      },
    });
  }

  const pollTool = tools.get_session_updates;
  if (pollTool?.execute) {
    const pollExecute = pollTool.execute;
    tools.get_session_updates = dynamicTool({
      description:
        "Wait for the analysis session's response and return the complete, final result in one call. This already polls internally until the answer is ready (or a wait limit is hit) — call it exactly once per question and do not call it again afterward.",
      inputSchema: pollTool.inputSchema,
      // Async generator: the SDK streams each yielded value to the UI as it
      // is produced, which is what keeps the thinking indicator moving
      // instead of sitting on one static line for the whole wait.
      execute: async function* (input: unknown, options) {
        const notifications: string[] = [];
        const answerChunks: string[] = [];
        let visualization: Record<string, unknown> | null = null;
        let latestStatus = "Reading semantic layer…";
        const startedAt = Date.now();

        for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) break;

          const parsed = extractToolJson(await pollExecute(input, options));

          for (const event of collectUpdateEvents(parsed)) {
            const text = typeof event.text === "string" ? event.text : undefined;
            if (event.type === "step_notification" && text) {
              const sanitized = sanitizeVendorMentions(text);
              notifications.push(sanitized);
              latestStatus = sanitized;
            } else if (
              event.type === "text_chunk" &&
              text &&
              event.is_thinking !== true
            ) {
              // Fragments of the final answer, concatenated in order with no
              // separator — each already carries its own leading whitespace.
              answerChunks.push(text);
            } else if (event.type === "answer") {
              visualization = event;
            }
          }

          if (isRecord(parsed) && (parsed.is_done === true || parsed.isDone === true)) {
            const answerText = answerChunks.length > 0 ? answerChunks.join("") : null;
            yield {
              is_done: true,
              narration: notifications.join(" "),
              answer_text: answerText,
              iframe_url: visualization?.iframe_url ?? visualization?.frame_url ?? null,
              note:
                answerText || visualization
                  ? "This is the complete, final result for this question — no further polling needed."
                  : "The session finished with no answer text and no visualization. Tell the user the query returned nothing rather than inventing an answer.",
            };
            return;
          }

          yield { is_done: false, status: latestStatus };
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        yield {
          is_done: false,
          narration: notifications.join(" "),
          timed_out: true,
          note: "Still not finished after waiting — let the user know this is taking longer than expected rather than guessing at an answer.",
        };
      },
    });
  }

  return tools;
}
