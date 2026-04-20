// Path prefix for sphinx html files
export const SPHINX_STATIC_PREFIX = "/sphinx";

/** Sphinx `_sources/*.rst.txt` paths (no traversal). */
const SOURCE_REL_RE = /^_sources\/[a-zA-Z0-9._-]+\.rst\.txt$/;

/**
 * @param {string} rel Path under /sphinx/, e.g. `_sources/index.rst.txt`
 * @returns {boolean}
 */
export function isSphinxCopySourceRel(rel) {
  return SOURCE_REL_RE.test(rel);
}

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
