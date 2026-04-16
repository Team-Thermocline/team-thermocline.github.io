<script>
    import { SPHINX_STATIC_PREFIX } from "./lib/docsUrl.js";

    /** Sphinx HTML path relative to /sphinx/, e.g. index.html, starthere.html */
    export let sphinxRelPath = "index.html";

    const pdfUrl = "/sphinx/latest.pdf";

    /** @type {HTMLIFrameElement | null} */
    let iframeEl = null;

    /** Bump so iframe src reacts to top-level #fragment changes (same sphinx page). */
    let hashTick = 0;

    $: iframeSrc = (() => {
        void hashTick;
        return typeof window !== "undefined"
            ? `${SPHINX_STATIC_PREFIX}/${sphinxRelPath}${window.location.search}${window.location.hash}`
            : `${SPHINX_STATIC_PREFIX}/index.html`;
    })();

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
        <iframe
            class="docs-iframe"
            title="Team Thermocline Documentation"
            src={iframeSrc}
            bind:this={iframeEl}
            on:load={syncTopUrlFromIframe}
        />

        <div class="docs-toolbar">
            <a class="nav-btn" href={pdfUrl} download>Download latest PDF</a>
        </div>
    </section>
</div>
