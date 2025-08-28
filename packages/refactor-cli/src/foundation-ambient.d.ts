declare module '@foundation/ts-codemods' {
  export type CodemodsModule = {
    addConfigLoader?: (project: any) => Promise<Record<string, unknown> | undefined>;
    addDbcGuards?: (project: any) => Promise<Record<string, unknown> | undefined>;
    extractFunctionalCore?: (project: any) => Promise<Record<string, unknown> | undefined>;
    addStranglerFacade?: (project: any) => Promise<Record<string, unknown> | undefined>;
    wrapAdapterResilience?: (project: any) => Promise<Record<string, unknown> | undefined>;
  };
  const mod: CodemodsModule;
  export default mod;
}
