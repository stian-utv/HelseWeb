import { renderApp } from "./app";
import "./styles/global.css";
import { openWelcomeModal } from "./ui/welcomeModal";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Fant ikke #app-elementet");
}

renderApp(app)
  .then(() => {
    openWelcomeModal();
  })
  .catch((error) => {
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
