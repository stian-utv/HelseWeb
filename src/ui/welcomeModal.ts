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
          Dette er et hobbyprosjekt laget for egen testing — ikke et produkt eller medisinsk tjeneste.
          Du kan logge helse, symptomer, medisin og blodprøver direkte i nettleseren.
        </p>

        <ul class="welcome-points">
          <li>
            <strong>Hobby / egen testing.</strong>
            Appen er ikke ment som noe annet enn et personlig eksperiment. Den er ikke et
            profesjonelt helseverktøy.
          </li>
          <li>
            <strong>Kun lokal lagring.</strong>
            Dataene dine ligger i denne nettleseren (IndexedDB) og er ikke kryptert. Appen sender
            ingenting selv til en server.
          </li>
          <li>
            <strong>Delt nettleser / synk.</strong>
            Bruker du en delt PC/profil, eller en nettleser som synker data mellom enheter
            (f.eks. Chrome-/Safari-/Firefox-synk), kan loggen synces eller ses av andre med
            tilgang. Det styres av nettleseren — ikke av denne appen.
          </li>
          <li>
            <strong>Ingen konto i appen.</strong>
            Du logger ikke inn her. Bytter du enhet eller sletter nettleserdata, forsvinner
            loggen med mindre du har eksportert en JSON-fil under Data.
          </li>
          <li>
            <strong>Ikke medisinsk råd.</strong>
            Appen er ikke diagnose, behandling eller helsefaglig veiledning.
          </li>
          <li>
            <strong>På eget ansvar.</strong>
            Bruk skjer uten garanti. Utvikleren påtar seg intet ansvar. Ta vare på egne
            eksporter hvis du vil ha sikkerhetskopi.
          </li>
        </ul>

        <p class="hint welcome-hint">
          Du kan lese mer om personvern og ansvar i prosjektets README på GitHub.
        </p>

        <div class="welcome-actions">
          <p class="welcome-scroll-hint" data-welcome-scroll-hint>
            Scroll ned for å lese ferdig
          </p>
          <button
            type="button"
            class="button button-primary"
            data-action="welcome-accept"
            disabled
          >
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

  const body = overlay.querySelector(".welcome-modal-body");
  const acceptBtn = overlay.querySelector<HTMLButtonElement>(
    '[data-action="welcome-accept"]',
  );
  const scrollHint = overlay.querySelector<HTMLElement>("[data-welcome-scroll-hint]");

  const updateAcceptReady = () => {
    if (!(body instanceof HTMLElement) || !acceptBtn) return;
    const remaining = body.scrollHeight - body.clientHeight - body.scrollTop;
    const needsScroll = body.scrollHeight > body.clientHeight + 4;
    const ready = !needsScroll || remaining <= 12;
    acceptBtn.disabled = !ready;
    if (scrollHint) {
      scrollHint.hidden = ready;
    }
  };

  if (body instanceof HTMLElement) {
    body.addEventListener("scroll", updateAcceptReady, { passive: true });
  }
  acceptBtn?.addEventListener("click", () => {
    if (acceptBtn.disabled) return;
    close();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(updateAcceptReady);
  // Fonts / layout kan endre høyde etter første paint
  window.setTimeout(updateAcceptReady, 100);
}
