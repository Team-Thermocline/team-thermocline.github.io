<script>
    const sphinxIndexUrl = "/docs/index.html";
    const pdfUrl = "/docs/latest.pdf";
</script>

<div class="docs-page">
    <section class="docs-shell">
        <iframe
            class="docs-iframe"
            title="Team Thermocline Documentation"
            src={sphinxIndexUrl}
        />

        <div class="docs-toolbar">
            <a class="nav-btn" href={pdfUrl} download>Download latest PDF</a>
        </div>
    </section>
</div>
