<script>
    import { loadDocs } from "./lib/docs.js";

    let docs = [];
    let selectedDoc = null;
    let docContent = "";

    // Load docs on component mount
    docs = loadDocs();

    function selectDoc(doc) {
        selectedDoc = doc;
        docContent = doc.content;
    }

    // Auto-select first doc if available
    $: if (docs.length > 0 && !selectedDoc) {
        selectDoc(docs[0]);
    }
</script>

<main class="container">
    <section class="content-block">
        <h2>Documentation</h2>
        <p>
            Technical documentation for the Team Thermocline thermal testing
            chamber project.
        </p>

        {#if docs.length === 0}
            <p class="docs-empty">No documentation available yet.</p>
        {:else}
            <div class="docs-layout">
                <nav class="docs-nav">
                    <h3>Contents</h3>
                    <ul class="docs-toc">
                        {#each docs as doc}
                            <li>
                                <a
                                    class="docs-nav-link"
                                    class:active={selectedDoc?.slug ===
                                        doc.slug}
                                    on:click={() => selectDoc(doc)}
                                >
                                    {doc.title}
                                </a>
                            </li>
                        {/each}
                    </ul>
                </nav>

                <div class="docs-content">
                    {#if selectedDoc}
                        <div class="docs-header">
                            <h1>{selectedDoc.title}</h1>
                        </div>
                        <div class="docs-body rst-content">
                            {@html docContent}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </section>
</main>
