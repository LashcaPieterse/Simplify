const NEXT_PHASE_PRODUCTION_BUILD = "phase-production-build";

export function isProductionBuildPhase(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NEXT_PHASE === NEXT_PHASE_PRODUCTION_BUILD ||
    env.npm_lifecycle_event === "build"
  );
}
