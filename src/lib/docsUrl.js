// Path prefix for sphinx html files
export const SPHINX_STATIC_PREFIX = "/sphinx";

/**
 * Map browser pathname (/docs/...) to a Sphinx HTML file under /sphinx/.
 * @param {string} pathname
 * @returns {string}
 */
export function docsPathnameToSphinxRel(pathname) {
  if (pathname === "/docs" || pathname === "/docs/") return "index.html";
  if (!pathname.startsWith("/docs/")) return "index.html";
  const rest = pathname.slice("/docs/".length);
  if (!rest || rest === "index.html") return "index.html";
  return rest;
}
