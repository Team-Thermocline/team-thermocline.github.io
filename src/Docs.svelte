<script>
    const sphinxIndexUrl = "/docs/index.html";
    const pdfUrl = "/docs/latest.pdf";

    /** @type {HTMLIFrameElement | null} */
    let iframeEl = null;

    function forceDocsLinksTop() {
        // The docs are same-origin, so we can inject a <base target="_top">.
        // This makes Sphinx internal links and "View page source" navigate the top window,
        // so the browser URL bar updates as expected.
        try {
            const doc = iframeEl?.contentDocument;
            if (!doc) return;
            const head = doc.head;
            if (!head) return;
            const existing = head.querySelector('base[data-injected="docs-top"]');
            if (existing) return;
            const base = doc.createElement("base");
            base.setAttribute("target", "_top");
            base.setAttribute("data-injected", "docs-top");
            head.prepend(base);
        } catch {
            // Ignore: if browser blocks access for any reason, we just keep iframe behavior.
        }
    }
</script>

<div class="docs-page">
    <section class="docs-shell">
        <iframe
            class="docs-iframe"
            title="Team Thermocline Documentation"
            src={sphinxIndexUrl}
            bind:this={iframeEl}
            on:load={forceDocsLinksTop}
        />

        <div class="docs-toolbar">
            <a class="nav-btn" href={pdfUrl} download>Download latest PDF</a>
        </div>
    </section>
</div>
