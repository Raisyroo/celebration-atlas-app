export type EventFactoryIdentity = {
  candidateId?: string | null;
  eventId?: string | null;
  eventKey?: string | null;
};

function samePresentValue(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left === right);
}

export function sharesEventFactoryIdentity(
  left: EventFactoryIdentity,
  right: EventFactoryIdentity,
) {
  return samePresentValue(left.candidateId, right.candidateId)
    || samePresentValue(left.eventId, right.eventId)
    || samePresentValue(left.eventKey, right.eventKey);
}
