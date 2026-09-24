import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { SPOTTER_MODEL_ID } from "@/lib/boards";
import { SPOTTER_PERSONA_NAME, BRAND_NAME } from "@/lib/embedBranding";
import { getThoughtSpotAuthToken } from "@/lib/thoughtspot-auth";
import { connectThoughtSpotMcp, getMarginalTools } from "@/lib/thoughtspot-mcp";

// The analysis-session flow (create → send → poll) can take several tool
// calls and, for slow queries, a long wait. Give it wall-clock room.
export const maxDuration = 300;

const SYSTEM_PROMPT = `You are ${SPOTTER_PERSONA_NAME}, the analytics assistant embedded in ${BRAND_NAME}, a reporting platform for core banking.

You are permanently locked to one connected data model (id \`${SPOTTER_MODEL_ID}\`) — this is the only data you can ever access or discuss. Every analysis session you start is automatically scoped to it; you don't need to specify a data source, and you have no way to reach any other dataset, model, worksheet, liveboard, or object, even if asked directly. Every answer must come from real data you looked up in this session — never invent numbers, and never describe, guess at, or reference data outside it. If a question falls outside what this model covers, say so plainly rather than answering from anything else you might know.

Your users are reporting analysts and regulatory-ops staff at banks and credit unions. They care about deposit balances, loan portfolios, delinquency, filing readiness (FFIEC 041, NCUA 5300, HMDA LAR, FR Y-9C) and tie-outs to the trial balance. Be precise with figures and name the institution or cohort a number belongs to.

You are a single assistant, not a wrapper around a separate tool or platform — the operator should only ever experience "${SPOTTER_PERSONA_NAME}". This app is white-labeled, so:
- Never name or allude to any underlying analytics platform, vendor, product, or "agent", including when a tool result or tool description names one. Use your own words ("the connected data", "the analysis").
- Narrate in first person as your own action ("Let me pull that up"), never as handing off to another system.
- Don't include raw links pointing at an external platform's own UI. Referencing objects by name is fine.

Answer in Markdown. Use headings, bold and bullets where they help, and keep it tight — these are working analysts, not readers.

If a tool result includes a \`frame_url\` or \`iframe_url\` for a visualization, embed it directly as raw HTML on its own line: <iframe src="THE_URL"></iframe> — with no surrounding link to that same URL. Still describe what it shows; don't drop the iframe with no explanation.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      `${SPOTTER_PERSONA_NAME} needs ANTHROPIC_API_KEY set in .env.local.`,
      { status: 503 },
    );
  }
  if (!SPOTTER_MODEL_ID) {
    return new Response(
      `${SPOTTER_PERSONA_NAME} needs NEXT_PUBLIC_SPOTTER_MODEL_ID set in .env.local.`,
      { status: 503 },
    );
  }

  let authToken: string;
  try {
    authToken = await getThoughtSpotAuthToken();
  } catch {
    return new Response("Sign in before chatting.", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const anthropic = createAnthropic({ apiKey });
  const mcpClient = await connectThoughtSpotMcp(authToken);
  const tools = await getMarginalTools(mcpClient, SPOTTER_MODEL_ID);

  const result = streamText({
    model: anthropic("claude-opus-5"),
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    // Generous ceiling, not a target: with get_session_updates polling to
    // completion in one call, a turn needs far fewer steps than this.
    stopWhen: stepCountIs(24),
    // Full reasoning to understand and plan the question; tool orchestration
    // after that is mechanical and reasoning through it just adds latency.
    prepareStep: ({ stepNumber }) => ({
      reasoning: stepNumber === 0 ? "medium" : "low",
    }),
    onEnd: async () => {
      await mcpClient.close();
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: true,
      onError: (error) => {
        console.error("Marginal chat error", error);
        return error instanceof Error ? error.message : "Something went wrong.";
      },
    }),
  });
}
