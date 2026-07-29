import type { EventPageManifest } from "./eventPageManifestTypes.ts";

export const EVENT_PAGE_EDITORIAL_QUALITY_VERSION =
  "event-page-editorial-quality-v1";

export type EventPageEditorialRepetition = {
  left: string;
  right: string;
  sharedTerms: string[];
};

export type EventPageEditorialQualityResult = {
  ok: boolean;
  errors: string[];
  repetitionPairs: EventPageEditorialRepetition[];
  genericHighlightCount: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
  "your",
]);

const FACTORY_PHRASES = [
  /\bbuild your visit around\b/i,
  /\bcenters (?:the day|a visit) on\b/i,
  /\buse the confirmed hours\b.{0,80}\bshape (?:the|your) visit\b/i,
  /\bthe people and experiences that shape\b/i,
  /\bexplore the creative program\b.{0,80}\bdefining experiences\b/i,
];

const GENERIC_HIGHLIGHT_COPY = [
  /^\s*the event includes\b/i,
  /^\s*the fair brings together\b/i,
  /\badd(?:s)? to the event experience\b/i,
];

function words(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function significantTerms(value: string, identityTerms: Set<string>) {
  return new Set(
    words(value).filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word) &&
        !identityTerms.has(word),
    ),
  );
}

function repetition(
  left: { label: string; text: string },
  right: { label: string; text: string },
  identityTerms: Set<string>,
): EventPageEditorialRepetition | null {
  const leftTerms = significantTerms(left.text, identityTerms);
  const rightTerms = significantTerms(right.text, identityTerms);
  const sharedTerms = [...leftTerms]
    .filter((term) => rightTerms.has(term))
    .sort();
  const smallerSetSize = Math.min(leftTerms.size, rightTerms.size);
  if (
    smallerSetSize < 4 ||
    sharedTerms.length < 4 ||
    sharedTerms.length / smallerSetSize < 0.6
  ) {
    return null;
  }
  return {
    left: left.label,
    right: right.label,
    sharedTerms,
  };
}

function exactRepeatedSentences(fields: Array<{ label: string; text: string }>) {
  const owners = new Map<string, Set<string>>();
  for (const field of fields) {
    const sentences = field.text
      .split(/[.!?]+/)
      .map((sentence) => words(sentence).join(" "))
      .filter((sentence) => sentence.split(" ").length >= 6);
    for (const sentence of sentences) {
      const labels = owners.get(sentence) ?? new Set<string>();
      labels.add(field.label);
      owners.set(sentence, labels);
    }
  }
  return [...owners.values()].some((labels) => labels.size > 1);
}

export function evaluateEventPageEditorialQuality(
  manifest: EventPageManifest,
): EventPageEditorialQualityResult {
  const errors: string[] = [];
  const whyGo = manifest.modules.find((module) => module.type === "whyGo");
  const experience = manifest.modules.find(
    (module) => module.type === "highlights" || module.type === "traditions",
  );
  const identityTerms = new Set(
    words(
      [
        manifest.identity.name,
        manifest.identity.shortName,
        manifest.identity.location,
        manifest.identity.venue,
      ].join(" "),
    ),
  );
  const coreFields = [
    { label: "Hero summary", text: manifest.hero.tagline },
    ...(whyGo?.type === "whyGo"
      ? [
          { label: "Why Go headline", text: whyGo.headline },
          { label: "Why Go summary", text: whyGo.summary },
        ]
      : []),
  ];
  const repetitionPairs: EventPageEditorialRepetition[] = [];
  for (let leftIndex = 0; leftIndex < coreFields.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < coreFields.length;
      rightIndex += 1
    ) {
      const repeated = repetition(
        coreFields[leftIndex],
        coreFields[rightIndex],
        identityTerms,
      );
      if (repeated) repetitionPairs.push(repeated);
    }
  }

  if (repetitionPairs.length || exactRepeatedSentences(coreFields)) {
    errors.push(
      "Hero, Why Go headline, and Why Go summary must do different jobs instead of repeating the same experience list.",
    );
  }

  if (whyGo?.type === "whyGo") {
    const audienceCopy = whyGo.audienceGroups
      .flatMap((group) => group.items)
      .join(" ");
    if (
      audienceCopy &&
      repetition(
        { label: "Why Go headline", text: whyGo.headline },
        { label: "Why Go visitor insights", text: audienceCopy },
        identityTerms,
      )
    ) {
      errors.push(
        "Why Go headline must introduce a useful angle instead of repeating its visitor-insight list.",
      );
    }
  }

  const visitorCopy = [
    ...coreFields.map((field) => field.text),
    ...(experience?.type === "highlights" ||
    experience?.type === "traditions"
      ? [
          experience.headline,
          experience.summary,
          ...experience.items.map((item) => item.summary),
        ]
      : []),
  ].join(" ");
  if (FACTORY_PHRASES.some((pattern) => pattern.test(visitorCopy))) {
    errors.push(
      "Visitor copy still contains a factory-style phrase instead of concrete event guidance.",
    );
  }

  const genericHighlightCount =
    experience?.type === "highlights"
      ? experience.items.filter((item) =>
          GENERIC_HIGHLIGHT_COPY.some((pattern) =>
            pattern.test(item.summary),
          ),
        ).length
      : 0;
  if (genericHighlightCount >= 2) {
    errors.push(
      "Highlights need concrete, distinct visitor value; multiple summaries still use generic event filler.",
    );
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    repetitionPairs,
    genericHighlightCount,
  };
}
