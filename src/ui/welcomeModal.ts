const WELCOME_STORAGE_KEY = "helseapp-web-welcome-v1";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_STORAGE_KEY, "1");
  } catch {
    // Privat modus / sperret lagring — vis igjen neste gang
  }
}

export function openWelcomeModal(options: { force?: boolean } = {}): void {
  if (!options.force && hasSeenWelcome()) return;
  if (document.querySelector(".welcome-modal-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay welcome-modal-overlay";
  overlay.innerHTML = `
    <div class="modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div class="welcome-modal-body">
        <p class="modal-kicker">Velkommen</p>
        <h2 id="welcome-title">HelseApp Web</h2>
        <p class="welcome-lead">
          En enkel app for å logge helse, symptomer, medisin og blodprøver — direkte i nettleseren.
        </p>

        <ul class="welcome-points">
          <li>
            <strong>Kun lokal lagring.</strong>
            Dataene dine ligger i denne nettleseren (IndexedDB). Ingenting sendes til en server.
          </li>
          <li>
            <strong>Ingen konto.</strong>
            Du logger ikke inn. Bytter du enhet eller sletter nettleserdata, forsvinner loggen
            med mindre du har eksportert en JSON-fil under Data.
          </li>
          <li>
            <strong>Ikke medisinsk råd.</strong>
            Appen er et personlig loggeverktøy, ikke diagnose, behandling eller helsefaglig veiledning.
          </li>
          <li>
            <strong>På eget ansvar.</strong>
            Bruk skjer uten garanti. Ta vare på egne eksporter hvis du vil ha sikkerhetskopi.
          </li>
        </ul>

        <p class="hint welcome-hint">
          Du kan lese mer om personvern og ansvar i prosjektets README på GitHub.
        </p>

        <div class="welcome-actions">
          <button type="button" class="button button-primary" data-action="welcome-accept">
            Jeg forstår — kom i gang
          </button>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    markWelcomeSeen();
    overlay.remove();
  };

  overlay.querySelector('[data-action="welcome-accept"]')?.addEventListener("click", close);

  document.body.appendChild(overlay);
}
