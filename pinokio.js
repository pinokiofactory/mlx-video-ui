module.exports = {
  version: "5.0",
  title: "MLX Video UI",
  description: "Local UI for MLX Video (Next.js frontend + FastAPI backend).",
  icon: "icon.png",
  menu: async (kernel, info) => {
    let installed = info.exists("app/frontend/node_modules")
    let running = {
      install: info.running("install.js"),
      backend: info.running("backend.js"),
      frontend: info.running("frontend.js"),
      update: info.running("update.js"),
      reset: info.running("reset.js")
    }
    if (running.install) {
      return [{
        default: true,
        icon: "fa-solid fa-plug",
        text: "Installing",
        href: "install.js",
      }]
    } else if (installed) {
      if (running.update) {
        return [{
          default: true,
          icon: "fa-solid fa-terminal",
          text: "Updating",
          href: "update.js",
        }, {
          icon: "fa-solid fa-key",
          text: "API Keys",
          href: "keys.js",
        }]
      } else if (running.reset) {
        return [{
          default: true,
          icon: "fa-solid fa-terminal",
          text: "Resetting",
          href: "reset.js",
        }, {
          icon: "fa-solid fa-key",
          text: "API Keys",
          href: "keys.js",
        }]
      } else if (running.backend || running.frontend) {
        let frontendLocal = running.frontend ? info.local("frontend.js") : null
        let uiUrl = (frontendLocal && frontendLocal.url) ? frontendLocal.url : null
        let items = []
        if (uiUrl) {
          items.push({
            default: true,
            icon: "fa-solid fa-rocket",
            text: "Open Web UI",
            href: uiUrl,
          })
        }
        if (running.frontend) {
          items.push({
            icon: "fa-solid fa-terminal",
            text: "Frontend Terminal",
            href: "frontend.js",
          })
        } else {
          items.push({
            icon: "fa-solid fa-power-off",
            text: "Start Frontend",
            href: "frontend.js",
          })
        }
        if (running.backend) {
          items.push({
            icon: "fa-solid fa-terminal",
            text: "Backend Terminal",
            href: "backend.js",
          })
        } else {
          items.push({
            icon: "fa-solid fa-power-off",
            text: "Start Backend",
            href: "backend.js",
          })
        }
        items.push({
          icon: "fa-solid fa-rotate",
          text: "Restart (Start All)",
          href: "start.js",
        })
        items.push({
          icon: "fa-solid fa-key",
          text: "API Keys",
          href: "keys.js",
        })
        return items
      } else {
        return [{
          default: true,
          icon: "fa-solid fa-power-off",
          text: "Start All",
          href: "start.js",
        }, {
          icon: "fa-solid fa-power-off",
          text: "Start Backend",
          href: "backend.js",
        }, {
          icon: "fa-solid fa-power-off",
          text: "Start Frontend",
          href: "frontend.js",
        }, {
          icon: "fa-solid fa-plug",
          text: "Update",
          href: "update.js",
        }, {
          icon: "fa-solid fa-plug",
          text: "Install",
          href: "install.js",
        }, {
          icon: "fa-solid fa-key",
          text: "API Keys",
          href: "keys.js",
        }, {
          icon: "fa-regular fa-circle-xmark",
          text: "Reset",
          href: "reset.js",
        }]
      }
    } else {
      return [{
        default: true,
        icon: "fa-solid fa-plug",
        text: "Install",
        href: "install.js",
      }, {
        icon: "fa-solid fa-key",
        text: "API Keys",
        href: "keys.js",
      }]
    }
  }
}
