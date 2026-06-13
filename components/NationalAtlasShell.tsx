// Future national atlas boundary.
//
// This component is intentionally not imported by app/page.tsx yet, so it does
// not affect the current Michigan-first homepage runtime.
//
// Future role:
// - host the national U.S. map gateway
// - route Celebration Search commands across national, state, and event scopes
// - transition users from national discovery into state atlases
//
// Coverage rule:
// - this shell must never claim national completeness while Atlas coverage is
//   still partial or uneven.

export default function NationalAtlasShell() {
  return (
    <section aria-label="Future national Celebration Atlas gateway">
      <p>Development Preview — National Atlas shell.</p>
      <p>Coverage is partial; this is not a complete U.S. event index.</p>
    </section>
  );
}

export { NationalAtlasShell };
