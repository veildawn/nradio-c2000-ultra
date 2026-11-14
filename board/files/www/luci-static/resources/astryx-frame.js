/* Same-origin LuCI page lifecycle bridge for the persistent Astryx SPA shell. */
(function () {
  "use strict";
  if (window.parent === window) return;
  var shell = document.getElementById("astryx-chrome");
  var reconnecting = false;
  if (!shell) return;
  function send(type, value) {
    parent.postMessage(
      Object.assign({ type: "nradio:" + type }, value),
      location.origin,
    );
  }
  if (shell.dataset.authenticated !== "1") {
    send("auth", { url: location.pathname + location.search });
    return;
  }
  // Reconnect may change LAN address or HTTP/HTTPS origin after an upgrade.
  // Hand off to the top-level document; a cross-origin router cannot remain
  // inside this same-origin management frame (X-Frame-Options: SAMEORIGIN).
  if (window.L && typeof L.require === "function")
    L.require("ui")
      .then(function (ui) {
        ui.awaitReconnect = function () {
          reconnecting = true;
          var hosts = arguments.length
            ? Array.from(arguments)
            : [location.host];
          send("state", { dirty: false, busy: true });
          function probe() {
            var tasks = [],
              reachable = null;
            ["http", "https"].forEach(function (protocol) {
              hosts.forEach(function (host) {
                tasks.push(
                  ui.pingDevice(protocol, host).then(
                    function (event) {
                      var target = new URL(event.target.src);
                      if (
                        target.protocol === "http:" ||
                        target.protocol === "https:"
                      )
                        reachable = target.origin + "/";
                    },
                    function () {},
                  ),
                );
              });
            });
            Promise.all(tasks).then(function () {
              if (reachable) send("reconnect", { url: reachable });
              else window.setTimeout(probe, 1000);
            });
          }
          window.setTimeout(probe, 5000);
        };
      })
      .catch(function () {});
  var baseline = new WeakMap(),
    lastState = "",
    restoreY = null,
    scheduled = false;
  var selector =
    "#maincontent input:not([type=hidden]):not([type=button]):not([type=submit]), #maincontent textarea, #maincontent select";
  function value(el) {
    if (el.type === "checkbox" || el.type === "radio")
      return String(el.checked);
    if (el.multiple && el.options)
      return JSON.stringify(
        Array.from(el.selectedOptions).map(function (option) {
          return option.value;
        }),
      );
    return el.value;
  }
  function state() {
    var dirty = false;
    document.querySelectorAll(selector).forEach(function (el) {
      if (!baseline.has(el)) baseline.set(el, value(el));
      if (baseline.get(el) !== value(el)) dirty = true;
    });
    // Widget edits without native inputs, including dynamic-list removals.
    if (document.querySelector('#maincontent [data-changed="true"]'))
      dirty = true;
    var busy =
      reconnecting || document.body.classList.contains("modal-overlay-active");
    var result = JSON.stringify({ dirty: dirty, busy: busy });
    if (result !== lastState) {
      lastState = result;
      send("state", { dirty: dirty, busy: busy });
    }
    if (
      restoreY != null &&
      (restoreY === 0 ||
        document.documentElement.scrollHeight - innerHeight >= restoreY)
    ) {
      window.scrollTo(0, restoreY);
      restoreY = null;
    }
  }
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        state();
      });
    }
  }
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "data-changed"],
  });
  document.addEventListener("input", schedule);
  document.addEventListener("change", schedule);
  document.addEventListener("reset", schedule);
  document.addEventListener("uci-applied", function () {
    baseline = new WeakMap();
    state();
  });
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    var url = new URL(link.href, location.href),
      base = shell.dataset.base || "/cgi-bin/luci";
    var previewPage =
      shell.dataset.preview === "1" &&
      url.pathname === "/ui/astryx/preview-page.html";
    if (
      url.origin !== location.origin ||
      (!previewPage && !url.pathname.startsWith(base + "/"))
    )
      return;
    if (
      url.pathname === location.pathname &&
      url.search === location.search &&
      url.hash
    )
      return;
    event.preventDefault();
    state();
    send("navigate", { url: url.pathname + url.search + url.hash });
  });
  window.addEventListener("message", function (event) {
    if (event.source !== parent || event.origin !== location.origin) return;
    if (
      event.data &&
      event.data.type === "nradio:restore" &&
      Number.isFinite(event.data.y)
    ) {
      restoreY = Math.max(0, event.data.y);
      state();
    }
    if (event.data && event.data.type === "nradio:theme") {
      document.documentElement.dataset.theme = event.data.dark
        ? "dark"
        : "light";
      document.documentElement.dataset.darkmode = String(!!event.data.dark);
    }
    if (event.data && event.data.type === "nradio:hello") ready();
  });
  var scrollPending = false;
  window.addEventListener(
    "scroll",
    function () {
      if (scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(function () {
        scrollPending = false;
        send("scroll", { y: scrollY });
      });
    },
    { passive: true },
  );
  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      send("search", {});
    }
  });
  function ready() {
    state();
    send("ready", {
      url: location.pathname + location.search + location.hash,
      title:
        document.querySelector("#maincontent h2")?.textContent ||
        document.title,
    });
  }
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
  // A new frame document owns its own LuCI timers and listeners; replacing the
  // frame destroys them. No hidden, polling view cache is retained by the host.
})();
