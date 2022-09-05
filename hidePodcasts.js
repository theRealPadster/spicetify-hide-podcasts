var hidePodcasts = (() => {
  // src/app.tsx
  async function main() {
    while (!(Spicetify == null ? void 0 : Spicetify.showNotification)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    Spicetify.showNotification("Hello!");
  }
  var app_default = main;

  // node_modules/spicetify-creator/dist/temp/index.jsx
  (async () => {
    await app_default();
  })();
})();
