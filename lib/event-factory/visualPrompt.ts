import type { EventVisualGenerationBrief } from "./types";

function uniqueMotifs(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const motif = value.trim();
    const key = motif.toLowerCase();
    if (!motif || seen.has(key) || seen.size >= 5) return [];
    seen.add(key);
    return [motif];
  });
}

export function buildEventVisualGenerationBrief(args: {
  eventName: string;
  locationLabel: string;
  motifs: string[];
  heroMoment: string;
}): EventVisualGenerationBrief {
  const motifs = uniqueMotifs(args.motifs);
  const heroMoment = args.heroMoment.trim();
  const prompt = heroMoment && motifs.length
    ? [
        `Create a text-free cinematic Celebration Atlas hero image for ${args.eventName} in ${args.locationLabel}.`,
        `Defining moment: ${heroMoment}`,
        `Recurring visual signature: ${motifs.join("; ")}.`,
        "Keep the defining moment dominant and use the other motifs only as supporting context.",
        "Use a vertical 2:3 composition with one legible focal point that survives a compact mobile hero crop.",
        "Create an original composition rather than reproducing any one reference photograph.",
        "Do not add event titles, dates, captions, sponsor marks, or invented lettering. Render unavoidable real-world insignia only when accurate and readable; otherwise omit it.",
        "Style: cinematic Celebration Atlas realism, richly detailed, warm, celebratory, and grounded in the verified place and event.",
      ].join("\n")
    : "";
  return {
    prompt,
    aspectRatio: "2:3",
    textPolicy: "no_generated_text",
    style: "Cinematic Celebration Atlas realism",
  };
}
