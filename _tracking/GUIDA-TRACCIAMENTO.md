# Tracciamento – Al Villaggio dei Bambini

GA4 + Meta Pixel + Meta Conversions API, gestiti da Google Tag Manager, con Consent Mode v2.

## Come funziona
1. Il sito mostra il **banner cookie**. La scelta viene salvata per 6 mesi e inviata a Google tramite Consent Mode v2.
2. Il sito invia gli **eventi** al `dataLayer`. GTM li legge e li manda a GA4 e a Meta.
3. Gli eventi Meta partono **due volte con lo stesso `event_id`**: dal browser (Pixel) e dal server (Conversions API, tramite la funzione Netlify `netlify/functions/meta-capi.mjs`). Meta li deduplica.
4. I tag Meta partono **solo se l'utente accetta i cookie di marketing**. I tag GA4 rispettano Consent Mode: senza consenso Google riceve solo segnali anonimi, senza cookie.

## Eventi tracciati

| Evento (dataLayer / GA4) | Quando | Parametri | Meta |
|---|---|---|---|
| `generate_lead` | invio riuscito del modulo preventivo | form_name, event_date, time_slot, guests_children, guests_adults | **Lead** (Pixel + CAPI, con telefono/email/nome hashati lato server) |
| `whatsapp_click` | clic su qualsiasi pulsante WhatsApp | click_location, link_text | **Contact** (Pixel + CAPI) |
| `directions_click` | clic sull'indirizzo (Google Maps) | click_location | **FindLocation** (Pixel + CAPI) |
| `cta_click` | clic sui pulsanti che portano al modulo | cta_text, cta_location | – |
| `form_start` | primo utilizzo del modulo | form_name | – |
| `select_event_date` | scelta della data nel calendario | event_date, days_in_advance | – |
| `form_error` | invio con campi mancanti | form_name, error_fields | – |
| `faq_open` | apertura di una FAQ | faq_question | – |
| `consent_update` | scelta nel banner cookie | consent_analytics, consent_marketing | (attiva il Pixel) |

`page_view` e scroll vengono raccolti da GA4 con la misurazione avanzata. `PageView` di Meta parte dal tag base del Pixel.

## Configurazione

### 1. Google Tag Manager
1. Su tagmanager.google.com crea un contenitore **Web** e copia l'ID `GTM-XXXXXXX`.
2. Nel sito l'ID va sostituito in **due punti** di `index.html`: `var GTM_ID = 'GTM-XXXXXXX'` e l'iframe `<noscript>`.
3. Vai su **Amministrazione → Importa contenitore**, scegli `gtm-container-alvillaggiodeibambini.json`, area di lavoro **Esistente**, opzione **Unisci → Rinomina tag, trigger e variabili in conflitto**.
4. In **Variabili** compila:
   - `CONST - GA4 Measurement ID` → `G-…`
   - `CONST - Meta Pixel ID` → l'ID numerico del pixel/dataset

### 2. Google Analytics 4
1. Crea una proprietà e uno stream web per `https://www.alvillaggiodeibambini.it`, con **misurazione avanzata** attiva.
2. In **Amministrazione → Eventi chiave** segna come chiave `generate_lead` e `whatsapp_click`. Gli eventi compaiono in elenco dopo il primo invio.
3. In **Amministrazione → Definizioni personalizzate** crea:
   - le dimensioni (ambito evento) `click_location`, `cta_location`, `cta_text`, `event_date`, `time_slot`, `error_fields`, `faq_question`;
   - le metriche `guests_children`, `guests_adults`, `days_in_advance`.

### 3. Meta Conversions API (Netlify)
1. In **Events Manager → il tuo dataset → Impostazioni → Conversions API** premi **Genera token di accesso**.
2. Su Netlify vai in **Project configuration → Environment variables** e aggiungi:
   - `META_PIXEL_ID` = ID del pixel
   - `META_CAPI_TOKEN` = il token (non va mai messo nel codice o su GitHub)
   - `META_TEST_EVENT_CODE` = codice della scheda "Eventi di test" (solo durante le prove, poi eliminalo)
3. Rifai il deploy da **Deploys → Trigger deploy**.

La funzione si attiva solo se Netlify pubblica il sito dal repository GitHub.

### 4. Test prima di pubblicare
1. In GTM premi **Anteprima** e apri il sito. Accetta i cookie e prova: pulsante WhatsApp, scelta data, invio del modulo.
2. In GA4 controlla **Amministrazione → DebugView**.
3. In Meta controlla **Events Manager → Eventi di test**: ogni Lead/Contact deve risultare ricevuto da **Browser e Server** e **deduplicato**.
4. Se è tutto ok: in GTM premi **Invia → Pubblica**, poi togli `META_TEST_EVENT_CODE` da Netlify e rifai il deploy.

## Note privacy
- Con il tracciamento attivo servono una **privacy policy** e una **cookie policy** (es. Iubenda), collegate al link "Privacy e cookie policy" del footer.
- I dati personali del lead (telefono, email, nome) passano al `dataLayer` solo per la Conversions API. Vengono hashati SHA-256 lato server e **non** vengono inviati a GA4.
