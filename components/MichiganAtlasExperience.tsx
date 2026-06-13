import HomeAtlasExperience from './HomeAtlasExperience';

// Safe Michigan atlas alias/wrapper.
//
// HomeAtlasExperience currently functions as the Michigan state atlas boundary.
// This component gives that boundary its future canonical name without changing
// HomeAtlasExperience itself and without changing app/page.tsx to use it yet.
// Rendering this wrapper manually should produce the same behavior as rendering
// HomeAtlasExperience directly.

export default function MichiganAtlasExperience() {
  return <HomeAtlasExperience />;
}

export { MichiganAtlasExperience };
