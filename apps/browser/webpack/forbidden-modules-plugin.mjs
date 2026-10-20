// Equivalent of Bitwarden's AngularCheckPlugin: fails the build when a module
// that must stay out of a bundle ends up in it (React in the service worker, the
// popup in a content script), or when a classic-script entry (background,
// content scripts) grows an async chunk it could never load.

const PLUGIN = "ForbiddenModulesPlugin";

export class ForbiddenModulesPlugin {
  /**
   * @param {{ rules: { chunks: RegExp, forbid: RegExp[], reason: string }[], asyncChunksAllowed: RegExp }} options
   */
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN, (compilation) => {
      compilation.hooks.afterSeal.tap(PLUGIN, () => {
        const { WebpackError } = compiler.webpack;
        for (const chunk of compilation.chunks) {
          const name = chunk.name ?? String(chunk.id);
          if (!this.options.asyncChunksAllowed.test(name) && chunk.getAllAsyncChunks().size > 0) {
            compilation.errors.push(
              new WebpackError(
                `${PLUGIN}: "${name}" must be a single classic script, but it has async chunks (dynamic import()).`,
              ),
            );
          }
          for (const rule of this.options.rules) {
            if (!rule.chunks.test(name)) {
              continue;
            }
            for (const resource of chunkResources(compilation, chunk)) {
              const hit = rule.forbid.find((pattern) => pattern.test(resource));
              if (hit !== undefined) {
                compilation.errors.push(
                  new WebpackError(
                    `${PLUGIN}: "${name}" includes ${resource} (${rule.reason}; matched ${hit}).`,
                  ),
                );
              }
            }
          }
        }
      });
    });
  }
}

/** Every module path in a chunk, looking inside concatenated (scope-hoisted) modules. */
function chunkResources(compilation, chunk) {
  const resources = [];
  const visit = (module) => {
    if (Array.isArray(module.modules)) {
      module.modules.forEach(visit);
    } else if (module.rootModule !== undefined) {
      visit(module.rootModule);
    }
    const name = module.nameForCondition?.() ?? module.resource ?? module.identifier();
    if (typeof name === "string") {
      resources.push(name.replaceAll("\\", "/"));
    }
  };
  for (const module of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
    visit(module);
  }
  return resources;
}
