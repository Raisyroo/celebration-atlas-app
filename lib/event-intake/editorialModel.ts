import 'server-only';
import { getVercelOidcToken } from '@vercel/oidc';
import type { EventPageManifest } from '../../data/eventPageManifestTypes.ts';
import {
  buildEditorialEvidencePackage,
  buildBoundedEditorialRewriteTargets,
  editorialModelJsonSchema,
  type EditorialModelOutput,
} from './editorialAssistance';
import type { EditorialPlan, EventSourceSynthesisInput } from './synthesisTypes';

const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const DEFAULT_EDITORIAL_MODEL = 'openai/gpt-5.4-mini';

type GatewayResponse = {
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string;
      refusal?: string | null;
    };
  }>;
  error?: { message?: string };
};

async function gatewayToken() {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (apiKey) return apiKey;

  try {
    const runtimeToken = await getVercelOidcToken();
    if (runtimeToken?.trim()) return runtimeToken.trim();
  } catch {
    // Local scripts can fall back to a freshly pulled Vercel OIDC token.
  }

  return process.env.VERCEL_OIDC_TOKEN?.trim() || '';
}

function editorialModel() {
  return process.env.AI_GATEWAY_EDITORIAL_MODEL?.trim() || DEFAULT_EDITORIAL_MODEL;
}

function systemPrompt() {
  return [
    'You are the evidence-bound editorial writer for Celebration Atlas, a refined guide to enduring public celebrations.',
    'Your task is to improve hierarchy, specificity, warmth, and mobile readability while preserving every verified fact.',
    'Make the event worth considering through concrete specificity, not hype: reveal what a visitor can actually experience, notice, or use.',
    'Give the core fields different jobs. The hero is one defining scene or decision hook. The Why Go headline introduces a distinct angle. The Why Go summary adds practical context and additional facts.',
    'Do not recycle the same nouns, clauses, or list of attractions across the hero, Why Go headline, Why Go summary, audience groups, and highlights.',
    'Write each highlight as a distinct visitor-useful fact. Avoid generic shells such as The event includes, The fair brings together, or adds to the event experience.',
    'Use only the supplied official-source evidence. Every rewrite, audience group, and Spotlight must cite the source snapshot IDs that directly support it.',
    'Never invent or alter dates, times, locations, prices, attendance, age, frequency, admission rules, or current-year status.',
    'Never turn historical reference material into a current-year promise. Respect the supplied schedule status and edition years exactly.',
    'Do not name or promote sponsors, presenting partners, corporate brands, vendors, or businesses unless the business is itself the public event being documented.',
    'Write finished visitor-facing product copy. Keep the research machinery invisible: never say that a page, website, source, official history, evidence package, schedule listing, or media kit lists, says, identifies, highlights, or describes something. Put provenance only in sourceSnapshotIds.',
    'Audience-group titles should feel experiential and inviting, such as For families or For parade traditions. Do not label them as listings, evidence, or current-schedule groups.',
    'Scout answers should respond directly and naturally. Do not begin by naming a page, source, media kit, or research document.',
    'A Scout Spotlight must reveal an enduring tradition, origin story, cultural detail, or historical insight. Never use a current schedule listing, performer, retailer, commercial venue, or logistics detail as the Spotlight.',
    'Avoid generic tourism copy, inflated claims, filler, exclamation points, and phrases such as something for everyone, unforgettable, must-see, or magical.',
    'Prefer concrete nouns, short sentences, and graceful language that sounds informed rather than promotional.',
    'A Scout Spotlight should reveal one distinctive, well-supported fact or tradition. Omit it by returning null when the evidence is not strong enough.',
    'Audience groups describe what visitors can genuinely experience; they are not demographic targeting and must remain source-backed.',
    'Return only JSON matching the supplied schema.',
  ].join('\n');
}

export async function generateEditorialModelDraft(args: {
  input: EventSourceSynthesisInput;
  manifest: EventPageManifest;
  plan: EditorialPlan;
  configuredModel?: string;
  maxCompletionTokens?: number;
}) {
  const token = await gatewayToken();
  if (!token) {
    throw new Error('AI Gateway authentication is unavailable. Vercel OIDC or AI_GATEWAY_API_KEY is required.');
  }
  const model = args.configuredModel?.trim() || editorialModel();
  const bounded = buildBoundedEditorialRewriteTargets(args.manifest);
  const targets = bounded.targets;
  const evidence = buildEditorialEvidencePackage(args.input, args.manifest, args.plan);
  const editorialQuality = bounded.quality;
  const snapshotIds = args.input.snapshots.map((snapshot) => snapshot.id);
  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt() },
        {
          role: 'user',
          content: JSON.stringify({
            instruction: editorialQuality.ok
              ? 'Rewrite only targets you can materially improve. Preserve concise existing copy when evidence does not support a better version.'
              : 'Resolve every listed editorial-quality issue using only grounded facts. Rewrite the hero, Why Go headline, Why Go summary, and any generic highlights needed to make their roles distinct.',
            editorialQualityIssues: editorialQuality.errors,
            targets,
            evidence,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: editorialModelJsonSchema(targets, snapshotIds),
      },
      max_completion_tokens: Math.max(
        1,
        Math.min(6_000, args.maxCompletionTokens ?? 6_000),
      ),
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => ({})) as GatewayResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `AI Gateway returned HTTP ${response.status}.`);
  }
  const refusal = payload.choices?.[0]?.message?.refusal;
  if (refusal) throw new Error('The editorial model declined the evidence package.');
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('The editorial model returned no structured draft.');
  let output: EditorialModelOutput;
  try {
    output = JSON.parse(content) as EditorialModelOutput;
  } catch {
    throw new Error('The editorial model returned invalid structured JSON.');
  }
  return {
    output,
    provider: 'vercel-ai-gateway',
    model: payload.model || model,
    requestedModel: model,
    responseId: payload.id ?? null,
    usage: {
      inputTokens:
        payload.usage?.input_tokens ??
        payload.usage?.prompt_tokens ??
        null,
      outputTokens:
        payload.usage?.output_tokens ??
        payload.usage?.completion_tokens ??
        null,
    },
  };
}
