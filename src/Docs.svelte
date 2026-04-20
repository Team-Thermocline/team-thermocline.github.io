<script>
    import { SPHINX_STATIC_PREFIX, isSphinxCopySourceRel } from "./lib/docsUrl.js";

    /** Sphinx HTML path relative to /sphinx/, e.g. index.html, starthere.html */
    export let sphinxRelPath = "index.html";

    const pdfUrl = "/sphinx/latest.pdf";

    /** @type {HTMLIFrameElement | null} */
    let iframeEl = null;

    /** Bump so iframe src reacts to top-level #fragment changes (same sphinx page). */
    let hashTick = 0;

    /** @type {string} */
    let sourceText = "";
    /** @type {string | null} */
    let sourceError = null;
    let sourceLoading = false;
    let sourceFetchGen = 0;

    $: showCopySource = isSphinxCopySourceRel(sphinxRelPath);

    $: iframeSrc = (() => {
        void hashTick;
        return typeof window !== "undefined"
            ? `${SPHINX_STATIC_PREFIX}/${sphinxRelPath}${window.location.search}${window.location.hash}`
            : `${SPHINX_STATIC_PREFIX}/index.html`;
    })();

    /** Avoid refetching the same `_sources/…` file on unrelated reactive updates. */
    let lastCopySourceRel = "";

    async function loadCopySource(rel) {
        const gen = ++sourceFetchGen;
        const url = `${SPHINX_STATIC_PREFIX}/${rel}`;
        sourceLoading = true;
        sourceError = null;
        sourceText = "";
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Could not load source (${res.status})`);
            }
            const text = await res.text();
            if (gen !== sourceFetchGen) return;
            sourceText = text;
        } catch (e) {
            if (gen !== sourceFetchGen) return;
            sourceError =
                e instanceof Error ? e.message : "Could not load source";
        } finally {
            if (gen === sourceFetchGen) sourceLoading = false;
        }
    }

    $: if (typeof window !== "undefined") {
        if (showCopySource) {
            if (sphinxRelPath !== lastCopySourceRel) {
                lastCopySourceRel = sphinxRelPath;
                loadCopySource(sphinxRelPath);
            }
        } else if (lastCopySourceRel !== "") {
            lastCopySourceRel = "";
            sourceFetchGen++;
            sourceText = "";
            sourceError = null;
            sourceLoading = false;
        }
    }

    function syncTopUrlFromIframe() {
        try {
            const win = iframeEl?.contentWindow;
            if (!win?.location?.pathname?.startsWith(`${SPHINX_STATIC_PREFIX}/`)) return;

            let rel =
                win.location.pathname.slice(SPHINX_STATIC_PREFIX.length + 1) ||
                "index.html";
            if (rel.endsWith("/")) rel = `${rel}index.html`;

            const frag = win.location.hash || "";
            const search = win.location.search || "";
            const docsPath = rel === "index.html" ? "/docs/" : `/docs/${rel}`;
            const next = `${docsPath}${search}${frag}`;
            const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (cur === next) return;

            history.pushState({ spaDocs: true }, "", next);
            window.dispatchEvent(new Event("thermo-docs-url"));
        } catch {
            // Cross-origin or blocked iframe access
        }
    }
</script>

<svelte:window on:hashchange={() => (hashTick += 1)} />

<div class="docs-page">
    <section class="docs-shell">
        {#if showCopySource}
            <div class="docs-source-view" role="region" aria-label="ReStructuredText source">
                {#if sourceLoading}
                    <p class="docs-source-status">Loading source…</p>
                {:else if sourceError}
                    <p class="docs-source-status docs-source-error">{sourceError}</p>
                {:else}
                    <pre class="docs-source-pre">{sourceText}</pre>
                {/if}
            </div>
        {:else}
            <iframe
                class="docs-iframe"
                title="Team Thermocline Documentation"
                src={iframeSrc}
                bind:this={iframeEl}
                on:load={syncTopUrlFromIframe}
            />
        {/if}

        <div class="docs-toolbar">
            {#if showCopySource}
                <a class="nav-btn" href="/docs/">Back to docs</a>
            {/if}
            <a class="nav-btn" href={pdfUrl} download>Download latest PDF</a>
        </div>
    </section>
</div>
