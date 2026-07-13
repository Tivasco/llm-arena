// chrome.js — shared header/footer, injected client-side (no build, same-origin).
// Auto-mounts on DOMContentLoaded; idempotent. Nav links are base-aware so the
// site works under any base path (root domain AND the Pages /llm-arena/ subpath).
(function () {
  // Capture the script element synchronously at the top level — document.currentScript
  // is only valid here (it is null inside the DOMContentLoaded callback). Its .src is
  // "<origin><base>/assets/chrome.js", so resolving relatives against it gives the site base.
  var SCRIPT = document.currentScript;
  function siteUrl(rel) { return new URL(rel, SCRIPT.src).href; } // siteUrl('../') === "<origin><base>/"

  // ── Cloudflare Web Analytics ────────────────────────────────────────────────
  // The site's ONE sanctioned external request: a privacy-first, cookieless page-view
  // beacon. Everything else stays same-origin/offline (enforced by tools/check_shell.py,
  // which whitelists exactly this host). Paste your beacon token below — Cloudflare
  // dashboard → Analytics & Logs → Web Analytics → (add site) tivasco.github.io → token.
  // Until a real 32-hex token is set, this stays a no-op (nothing loads).
  var CF_WA_TOKEN = "REPLACE_WITH_BEACON_TOKEN";
  if (/^[a-f0-9]{32,}$/i.test(CF_WA_TOKEN)) {
    var beacon = document.createElement("script");
    beacon.defer = true;
    beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
    beacon.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_WA_TOKEN }));
    (document.head || document.documentElement).appendChild(beacon);
  }

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
