declare module '@foundation/ts-codemods' {
  export type CodemodsModule = {
    addConfigLoader?: (project: unknown) => Promise<Record<string, unknown> | undefined>;
    addDbcGuards?: (project: unknown) => Promise<Record<string, unknown> | undefined>;
    extractFunctionalCore?: (project: unknown) => Promise<Record<string, unknown> | undefined>;
    addStranglerFacade?: (project: unknown) => Promise<Record<string, unknown> | undefined>;
    wrapAdapterResilience?: (project: unknown) => Promise<Record<string, unknown> | undefined>;
  };
  const mod: CodemodsModule;
  export default mod;
}
