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
    'You own the complete visitor-facing manifest: hero language, navigation, topic count and order, module organization, schedule presentation, planning guidance, and Scout questions and answers.',
    'Do not behave as a copy editor for the current manifest. Reconsider the whole visitor experience and return one complete manifest that is right for this event.',
    'The protected manifest fields are immutable. Copy schema version, IDs, lifecycle, identity, dates, location, retained source registry, scheduleItems, hero asset references, reviewedAt, and publishedAt exactly.',
    'You may choose the recipe, visitor-facing module IDs, the event-specific third topic and its title, navigation icons, schedule filters and presentation groups, sourced planning details, and Scout content supported by the retained evidence.',
    'Use exactly four topics and exactly this navigation order: Why Go, Schedule, one source-backed event-specific Highlights or Traditions topic, Plan. The labels Why Go, Schedule, and Plan are fixed. The third label is a short, familiar noun phrase that reveals what is distinctive about this event.',
    'Never create vague or editorial-sounding categories such as Highlights, Traditions, Experience, Three Days, Weekend Rhythm, or What to Expect. Condense the valuable material into the four-topic structure.',
    'Schedule facts live only in protected scheduleItems or protected recurring/reference collections. Never add, remove, rename, retime, recategorize, or relocate a schedule fact.',
    'Schedule filters may use only dates and tags that exist in the protected schedule items.',
    'When the protected program supports stages, venues, days, competitions, or another event-specific mental model, use presentationGroups to organize every protected schedule item exactly once. Group labels and summaries must be source-grounded.',
    'Use manifest source IDs inside sourceIds fields. Use retained snapshot IDs only in the separate citations array.',
    'Cite hero.tagline and every module headline, summary, subtitle, advisory, or notes block with a path accepted by the dossier contract.',
    'Every metric, audience group, Spotlight, experience item, planning detail, link, and Scout answer must carry direct retained source IDs.',
    'Your task is to create hierarchy, specificity, warmth, and mobile readability while preserving every verified fact.',
    'Make the event worth considering through concrete specificity, not hype: reveal what a visitor can actually experience, notice, or use.',
    'Give every field one job. The hero is one defining scene or decision hook. The Why Go headline and 30-to-45-word summary form a brief, accurate, enticing, evergreen pitch that remains useful from year to year.',
    'Never repeat a fact, attraction, date, location, claim, noun list, or lightly rephrased idea across the hero, Why Go, Schedule, the event-specific topic, Scout, and Plan. If a fact already appears once, delete it from every other surface.',
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
    'A Scout Spotlight should reveal one distinctive, well-supported fact or tradition. Generic planning advice is a failure. Omit the Spotlight when the evidence is not strong enough.',
    'Scout may instead call out one especially useful, source-backed event detail when it is genuinely distinctive, such as a signature after-dark moment. Do not repeat that detail elsewhere.',
    'Omit primaryAction. Official event-site, schedule, registration, ticket, FAQ, and information links belong only in the manifest source registry rendered in the footer. Do not place an official-site link in the hero, topics, Plan, Highlights, or Scout. Plan may include a non-official map-directions link only when useful.',
    'Plan is a compact field guide, not an address card. Include at least two sourced visitor decisions, with at least one useful access, viewing, transportation, timing, or site-orientation detail beyond the venue address.',
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
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  additionalInstructions?: string[];
  providerRoute?: 'gateway' | 'openai_direct';
}) {
  const providerRoute = args.providerRoute ?? 'gateway';
  const token = providerRoute === 'openai_direct'
    ? process.env.OPENAI_API_KEY?.trim() || ''
    : await gatewayToken();
  if (!token) {
    throw new Error(providerRoute === 'openai_direct'
      ? 'Direct OpenAI authentication is unavailable. OPENAI_API_KEY is required.'
      : 'AI Gateway authentication is unavailable. Vercel OIDC or AI_GATEWAY_API_KEY is required.');
  }
  const requestedModel = args.configuredModel?.trim() || editorialModel();
  const model = providerRoute === 'openai_direct'
    ? requestedModel.replace(/^openai\//, '')
    : requestedModel;
  const evidence = buildEditorialEvidencePackage(args.input, args.manifest, args.plan);
  const snapshotIds = args.input.snapshots.map((snapshot) => snapshot.id);
  const response = await fetch(
    providerRoute === 'openai_direct'
      ? 'https://api.openai.com/v1/chat/completions'
      : AI_GATEWAY_URL,
    {
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
            instruction: 'Author the complete visitor-facing Event Hub manifest from the entire retained dossier. Keep every protected value byte-for-byte equivalent. Use exactly four topics in the required Why Go, Schedule, event-specific, Plan order while making the content hierarchy, schedule organization, third-topic concept, and prose decisions yourself. Read every official and retained reputable-source excerpt before writing, then remove every repeated or lightly rephrased fact.',
            additionalInstructions: args.additionalInstructions ?? [],
            qualityBenchmark: {
              source: 'The checked-in Detroit Jazz Festival Event Hub',
              traits: [
                'event-specific understanding',
                'exactly four concise topics in the required order',
                'visitor-useful hierarchy',
                'complete supported planning guidance',
                'meaningful schedule interpretation and filters',
                'specific Scout questions with direct answers',
                'no generic system language or repeated filler',
                'concise factual writing rather than promotional fluff',
                'one fact in one place with no repetition',
                'brief evergreen Why Go copy',
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
      ...(args.reasoningEffort ? { reasoning_effort: args.reasoningEffort } : {}),
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
    },
  );
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
    provider: providerRoute === 'openai_direct' ? 'openai' : 'vercel-ai-gateway',
    model: payload.model || model,
    requestedModel,
    reasoningEffort: args.reasoningEffort ?? null,
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
