// chrome.js — shared header/footer, injected client-side (no build, same-origin).
// Auto-mounts on DOMContentLoaded; idempotent. Nav links are base-aware so the
// site works under any base path (root domain AND the Pages /llm-arena/ subpath).
(function () {
  // Capture the script element synchronously at the top level — document.currentScript
  // is only valid here (it is null inside the DOMContentLoaded callback). Its .src is
  // "<origin><base>/assets/chrome.js", so resolving relatives against it gives the site base.
  var SCRIPT = document.currentScript;
  function siteUrl(rel) { return new URL(rel, SCRIPT.src).href; } // siteUrl('../') === "<origin><base>/"

  function mountChrome() {
    if (document.querySelector(".site-header")) return; // already mounted
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<a class="brand" href="' + siteUrl("../") + '">' +
      '<span class="brand__mark" aria-hidden="true"></span>llm-arena' +
      "</a>" +
      '<nav class="site-nav">' +
      '<a href="' + siteUrl("../benchmarks/") + '">Benchmarks</a>' +
      '<a href="' + siteUrl("../about.html") + '">About</a>' +
      "</nav>";
    document.body.prepend(header);

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      'Deterministic local-LLM evaluations · ' +
      '<a href="https://github.com/Tivasco/llm-arena">source</a>';
    document.body.append(footer);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChrome);
  } else {
    mountChrome();
  }
})();
