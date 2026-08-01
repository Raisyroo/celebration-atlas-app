import 'server-only';
import { getVercelOidcToken } from '@vercel/oidc';
import type { EventPageManifest } from '../../data/eventPageManifestTypes.ts';
import {
  buildEditorialEvidencePackage,
  fullManifestEditorialModelJsonSchema,
  type AnyEditorialModelOutput,
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
    'You are the evidence-bound Event Hub author for Celebration Atlas, a refined field guide to enduring public celebrations.',
    'You own the complete visitor-facing manifest: hero language, navigation, four useful topics, module organization, schedule presentation, planning guidance, and Scout questions and answers.',
    'Do not behave as a copy editor for the current manifest. Reconsider the whole visitor experience and return one complete manifest that is right for this event.',
    'The protected manifest fields are immutable. Copy schema version, IDs, lifecycle, identity, dates, location, retained source registry, scheduleItems, hero asset references, reviewedAt, and publishedAt exactly.',
    'You may choose the recipe, visitor-facing module IDs and titles, navigation labels and icons, Highlights versus Traditions, schedule filters, sourced planning details and links, and all Scout suggestions supported by the retained evidence.',
    'The existing readiness contract requires exactly four topics: one Why Go module, one Schedule module, one Highlights or Traditions module, and one Plan module.',
    'Schedule facts live only in protected scheduleItems or protected recurring/reference collections. Never add, remove, rename, retime, recategorize, or relocate a schedule fact.',
    'Schedule filters may use only dates and tags that exist in the protected schedule items.',
    'Use manifest source IDs inside sourceIds fields. Use retained snapshot IDs only in the separate citations array.',
    'Cite hero.tagline and every module headline, summary, subtitle, advisory, or notes block with a path accepted by the dossier contract.',
    'Every metric, audience group, Spotlight, experience item, planning detail, link, and Scout answer must carry direct retained source IDs.',
    'Your task is to create hierarchy, specificity, warmth, and mobile readability while preserving every verified fact.',
    'Make the event worth considering through concrete specificity, not hype: reveal what a visitor can actually experience, notice, or use.',
    'Give the core fields different jobs. The hero is one defining scene or decision hook. The Why Go headline introduces a distinct angle. The Why Go summary adds practical context and additional facts.',
    'Do not recycle the same nouns, clauses, or list of attractions across the hero, Why Go headline, Why Go summary, audience groups, and highlights.',
    'Write each highlight as a distinct visitor-useful fact. Avoid generic shells such as The event includes, The fair brings together, or adds to the event experience.',
    'Use only the supplied retained evidence. Unsupported claims cause the entire manifest to be rejected.',
    'Never invent or alter dates, times, locations, prices, attendance, age, frequency, admission rules, or current-year status.',
    'Never turn historical reference material into a current-year promise. Respect the supplied schedule status and edition years exactly.',
    'Do not name or promote sponsors, presenting partners, corporate brands, vendors, or businesses unless the business is itself the public event being documented.',
    'Write finished visitor-facing product copy. Keep the research machinery invisible: never say that a page, website, source, official history, evidence package, schedule listing, or media kit lists, says, identifies, highlights, or describes something. Put provenance only in sourceSnapshotIds.',
    'Audience-group titles should feel experiential and inviting, such as For families or For collectors. Do not label them as listings, evidence, or current-schedule groups.',
    'Scout answers should respond directly and naturally. Do not begin by naming a page, source, media kit, or research document.',
    'A Scout Spotlight must reveal an enduring tradition, origin story, cultural detail, or historical insight. Never use a current schedule listing, performer, retailer, commercial venue, or logistics detail as the Spotlight.',
    'Avoid generic tourism copy, inflated claims, filler, exclamation points, and phrases such as something for everyone, unforgettable, must-see, or magical.',
    'Prefer concrete nouns, short sentences, and graceful language that sounds informed rather than promotional.',
    'A Scout Spotlight should reveal one distinctive, well-supported fact or tradition. Omit it by returning null when the evidence is not strong enough.',
    'Audience groups describe what visitors can genuinely experience; they are not demographic targeting and must remain source-backed.',
    'Return only JSON with the complete manifest and its citations array.',
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
  const evidence = buildEditorialEvidencePackage(args.input, args.manifest, args.plan);
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
            instruction: 'Author the complete visitor-facing Event Hub manifest from the dossier. Keep every protected value byte-for-byte equivalent, but make all visitor-facing editorial and structural decisions yourself. Return exactly four useful topics, event-specific navigation, a visitor-organized schedule, factual planning guidance, and specific Scout questions. Do not copy Detroit Jazz Festival wording or force its stage-oriented structure onto this outdoor juried art fair.',
            qualityBenchmark: {
              source: 'The checked-in Detroit Jazz Festival Event Hub',
              traits: [
                'event-specific understanding',
                'visitor-useful hierarchy',
                'complete supported planning guidance',
                'meaningful schedule interpretation and filters',
                'specific Scout questions with direct answers',
                'no generic system language or repeated filler',
                'concise factual writing rather than promotional fluff',
              ],
            },
            evidence,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: fullManifestEditorialModelJsonSchema(snapshotIds),
      },
      max_completion_tokens: Math.max(
        1,
        Math.min(8_000, args.maxCompletionTokens ?? 6_000),
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
  let output: AnyEditorialModelOutput;
  try {
    output = JSON.parse(content) as AnyEditorialModelOutput;
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
