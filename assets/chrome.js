// chrome.js — shared header/footer, injected client-side (no build, same-origin).
// Auto-mounts on DOMContentLoaded; idempotent.
(function () {
  function mountChrome() {
    if (document.querySelector(".site-header")) return; // already mounted
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<a class="brand" href="/">' +
      '<span class="brand__mark" aria-hidden="true"></span>llm-arena' +
      "</a>" +
      '<nav class="site-nav">' +
      '<a href="/benchmarks/">Benchmarks</a>' +
      '<a href="/arena/">Arena</a>' +
      '<a href="/about.html">About</a>' +
      "</nav>";
    document.body.prepend(header);

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      'Deterministic local-LLM evaluations &amp; visual challenges · ' +
      '<a href="https://github.com/Tivasco/llm-arena">source</a>';
    document.body.append(footer);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChrome);
  } else {
    mountChrome();
  }
})();
