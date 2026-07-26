import { getStorageSummary } from "../storage/localStore";

const plannedFeatures = [
  {
    title: "Kalender",
    description: "Daglig registrering med fargekodet helsescore.",
    icon: "📅",
  },
  {
    title: "Symptomer",
    description: "Hodepine, utmattelse, nevrologiske tegn m.m.",
    icon: "🩺",
  },
  {
    title: "Medisin og B12",
    description: "Registrer medisinbruk og injeksjoner – også i bulk.",
    icon: "💊",
  },
  {
    title: "Grafer",
    description: "Se utvikling over tid uten at data forlater enheten.",
    icon: "📈",
  },
];

export async function renderWelcomePage(root: HTMLElement): Promise<void> {
  const summary = await getStorageSummary().catch(() => ({
    logCount: 0,
    hasSettings: false,
  }));

  root.innerHTML = `
    <div class="page">
      <header class="hero">
        <div class="hero-badge">Utkast · lokal lagring</div>
        <h1>HelseApp Web</h1>
        <p class="hero-lead">
          En enkel webversjon for daglig helse-logging. Alt lagres lokalt i nettleseren din –
          ingen konto, ingen sky, ingen server.
        </p>
        <div class="hero-actions">
          <button class="button button-primary" type="button" disabled>
            Kommer snart
          </button>
          <span class="button button-secondary" aria-disabled="true">
            Kalender · symptomer · grafer
          </span>
        </div>
      </header>

      <section class="card-grid" aria-label="Planlagte moduler">
        ${plannedFeatures
          .map(
            (feature) => `
          <article class="card">
            <div class="card-icon" aria-hidden="true">${feature.icon}</div>
            <h2>${feature.title}</h2>
            <p>${feature.description}</p>
          </article>
        `,
          )
          .join("")}
      </section>

      <section class="info-panel">
        <div>
          <h2>Lokal status</h2>
          <p>Dette er bare et tidlig utkast, men lagringslaget er allerede klargjort.</p>
        </div>
        <dl class="stats">
          <div>
            <dt>Registrerte dager</dt>
            <dd>${summary.logCount}</dd>
          </div>
          <div>
            <dt>Innstillinger lagret</dt>
            <dd>${summary.hasSettings ? "Ja" : "Nei"}</dd>
          </div>
          <div>
            <dt>Lagring</dt>
            <dd>IndexedDB</dd>
          </div>
        </dl>
      </section>

      <footer class="footer">
        <p>
          <strong>Personvern:</strong> Helseinformasjon lagres kun på denne enheten.
          Ta backup via eksport når den funksjonen kommer.
        </p>
      </footer>
    </div>
  `;
}
