import { renderApp } from "./app";
import { seedDemoB12Year } from "./seed/demoYear";
import "./styles/global.css";
import { openWelcomeModal } from "./ui/welcomeModal";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Fant ikke #app-elementet");
}

async function boot(): Promise<void> {
  app!.innerHTML = `
    <div class="placeholder-page">
      <div class="placeholder-card">
        <h2>HelseApp</h2>
        <p>Klargjør testdata for B12-forløp…</p>
      </div>
    </div>
  `;
  // Erstatter lokal data med realistisk B12-årsforløp (én gang per seed-versjon).
  await seedDemoB12Year();
  await renderApp(app!);
  openWelcomeModal();
}

boot().catch((error) => {
  app.innerHTML = `
    <div class="placeholder-page">
      <div class="placeholder-card">
        <h2>Noe gikk galt</h2>
        <p>Kunne ikke starte HelseApp.</p>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    </div>
  `;
});
