// Uzantısız göreli içe aktarmaları (./appLanguages) .js ile çözen küçük Node yükleyicisi.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) {
      return nextResolve(specifier + ".js", context);
    }
    throw err;
  }
}
