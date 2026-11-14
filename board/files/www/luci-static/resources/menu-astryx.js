"use strict";
"require baseclass";
"require ui";
"require rpc";

var readBoard = rpc.declare({ object: "system", method: "board" });
var readInfo = rpc.declare({ object: "system", method: "info" });
var readInterfaces = rpc.declare({
  object: "network.interface",
  method: "dump",
});

/* Keep LuCI's filtered menu, route resolution and nested tabs. React owns only
 * the surrounding shell: form lifecycles, ACLs and apply/rollback stay intact. */
return baseclass.extend({
  __init__: function () {
    window.nradioReadStatus = function () {
      return Promise.allSettled([
        readBoard(),
        readInfo(),
        readInterfaces(),
      ]).then(function (results) {
        return {
          board: results[0].status === "fulfilled" ? results[0].value : null,
          info: results[1].status === "fulfilled" ? results[1].value : null,
          interfaces:
            results[2].status === "fulfilled"
              ? results[2].value?.interface || null
              : null,
        };
      });
    };
    return ui.menu
      .load()
      .then(L.bind(this.render, this))
      .catch(function (error) {
        window.nradioMenu = {
          menu: [],
          title: "",
          breadcrumb: [],
          error: _("Unable to load navigation") + ": " + error.message,
        };
        window.dispatchEvent(new Event("nradio-menu"));
      });
  },

  render: function (tree) {
    var path = L.env.dispatchpath || [],
      roots = ui.menu.getChildren(tree),
      self = this;
    function convert(node, parent) {
      var parts = parent.concat(node.name),
        key = parts.join("/");
      return {
        key: key,
        title: _(node.title),
        url: L.url.apply(L, parts),
        active: parts.every(function (part, i) {
          return path[i] === part;
        }),
        children: ui.menu.getChildren(node).map(function (child) {
          return convert(child, parts);
        }),
      };
    }
    var activeRoot =
      roots.filter(function (node) {
        return node.name === ((L.env.requestpath || path)[0] || "admin");
      })[0] || roots[0];
    var menu = activeRoot
      ? ui.menu
          .getChildren(activeRoot)
          .filter(function (node) {
            return node.name !== "astryx";
          })
          .map(function (node) {
            return convert(node, [activeRoot.name]);
          })
      : [];
    // Include additional controller roots exposed to this user.
    roots.forEach(function (node) {
      if (node !== activeRoot) menu.push(convert(node, []));
    });
    var breadcrumb = [],
      node = tree;
    for (var i = 0; i < path.length; i++) {
      node = node.children && node.children[path[i]];
      if (!node) break;
      if (i > 0 && node.title) breadcrumb.push(_(node.title));
      if (i === 2) self.renderTabs(node, path.slice(0, 3), 3);
    }
    window.nradioMenu = {
      menu: menu,
      title: breadcrumb[breadcrumb.length - 1] || "",
      breadcrumb: breadcrumb,
    };
    window.dispatchEvent(new Event("nradio-menu"));
  },

  renderTabs: function (node, path, level) {
    var container = document.getElementById("tabmenu"),
      children = ui.menu.getChildren(node),
      self = this;
    if (!container || !children.length) return;
    var tabs = E("ul", { class: "tabs" });
    children.forEach(function (child) {
      var active = L.env.dispatchpath[level] === child.name;
      tabs.appendChild(
        E("li", { class: active ? "active" : "" }, [
          E(
            "a",
            { href: L.url.apply(L, path.concat(child.name)) },
            _(child.title),
          ),
        ]),
      );
    });
    container.appendChild(tabs);
    container.style.display = "";
    children.forEach(function (child) {
      if (L.env.dispatchpath[level] === child.name)
        self.renderTabs(child, path.concat(child.name), level + 1);
    });
  },
});
