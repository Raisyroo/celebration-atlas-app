export type EventAISectionType = 'answer' | 'checklist' | 'itinerary' | 'mapPreview' | 'sourceConfidence';

export type EventAIResponse = {
  question: string;
  sections: { type: EventAISectionType; lines: string[] }[];
};

const defaultResponse = (question: string): EventAIResponse => ({
  question,
  sections: [
    { type: 'answer', lines: ['This is a mock response for the selected question.', 'We keep answers on-page so chips act like quick asks, not navigation.'] },
    { type: 'checklist', lines: ['• Pick one anchor activity.', '• Check timing, parking, and weather.', '• Save this question to revisit later.'] },
    { type: 'itinerary', lines: ['Arrival window — 20 min buffer', 'Prime experience block — 60 to 90 min', 'Wrap-up window — food, photos, and departures'] },
    { type: 'mapPreview', lines: ['Future map/image preview appears in this panel.', 'If needed, this card can expand to an overlay without routing away.'] },
    { type: 'sourceConfidence', lines: ['Mock source note: static placeholder content only.', 'Confidence: medium (designed for layout testing).'] },
  ],
});

export function getMockEventAIResponse(eventId: string, question: string): EventAIResponse {
  if (eventId === 'goodells-fair') {
    return {
      question,
      sections: [
        { type: 'answer', lines: ['For evening events, use the north and west lots first for faster exit flow.', 'Families usually prefer early entry before midway lines peak.'] },
        { type: 'checklist', lines: ['• Arrive before grandstand rush.', '• Keep cash/card ready for small vendors.', '• Set a meetup landmark near the midway lights.'] },
        { type: 'itinerary', lines: ['5:30 PM — Park + enter', '6:00 PM — Livestock and family loop', '7:30 PM — Grandstand or midway rides'] },
        { type: 'mapPreview', lines: ['Mock map preview: parking lots, gate, midway core.', 'Expandable overlay card reserved for future high-detail map views.'] },
        { type: 'sourceConfidence', lines: ['Mock source note: fair pattern assumptions + placeholder editorial guidance.', 'Confidence: medium-high for UI demo only.'] },
      ],
    };
  }

  return defaultResponse(question);
}
