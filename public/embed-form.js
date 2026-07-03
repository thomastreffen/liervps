(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;

  var formSlug = script.getAttribute("data-form");
  if (!formSlug) {
    console.error("[Lier VPS Embed] Missing data-form attribute");
    return;
  }

  var container = script.previousElementSibling;
  if (!container || container.id !== "mcs-order-form") {
    container = document.getElementById("mcs-order-form");
  }
  if (!container) {
    console.error("[Lier VPS Embed] No container element found (#mcs-order-form)");
    return;
  }

  var origin = script.src.replace(/\/embed-form\.js.*$/, "");
  var src = origin + "/bestilling/" + formSlug + "?embed=1";

  var iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.style.cssText =
    "width:100%;border:0;border-radius:8px;overflow:hidden;display:block;";
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allow", "clipboard-write");
  iframe.title = "Lier VPS Bestillingsskjema";

  // Auto-resize via postMessage – no internal scroll
  window.addEventListener("message", function (e) {
    if (e.source !== iframe.contentWindow) return;
    try {
      var data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (data.type === "mcs-form-resize" && data.height) {
        iframe.style.height = data.height + "px";
      }
    } catch (_) {}
  });

  container.innerHTML = "";
  container.appendChild(iframe);
})();
