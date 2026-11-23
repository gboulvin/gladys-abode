// -----------------------------------------------------------------------------
// User-facing texts, in the four languages the integration speaks: English
// (mandatory, the fallback Gladys uses), French, German and Spanish.
//
// Every message the code sends to Gladys (action messages, connection status,
// widget labels, toasts...) is a multi-language object built from this table,
// so a missing translation is caught in one place (see test/i18n.test.js).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const MESSAGES = {
  // Alarm modes
  mode_standby: { en: 'Disarmed', fr: 'Désarmée', de: 'Unscharf', es: 'Desarmada' },
  mode_home: { en: 'Home', fr: 'Partielle', de: 'Zuhause', es: 'En casa' },
  mode_away: { en: 'Away', fr: 'Totale', de: 'Abwesend', es: 'Ausente' },
  mode_unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },

  // Connection status
  status_auth_failed: {
    en: 'Abode sign-in failed: check the email and password.',
    fr: 'Connexion à Abode refusée : vérifiez l’e-mail et le mot de passe.',
    de: 'Abode-Anmeldung fehlgeschlagen: E-Mail und Passwort prüfen.',
    es: 'Error al iniciar sesión en Abode: revise el correo y la contraseña.',
  },
  status_mfa_required: {
    en: 'This Abode account uses two-factor authentication: use an account without it.',
    fr: 'Ce compte Abode utilise la double authentification : utilisez un compte sans.',
    de: 'Dieses Abode-Konto nutzt Zwei-Faktor-Authentifizierung: Konto ohne 2FA verwenden.',
    es: 'Esta cuenta de Abode usa verificación en dos pasos: use una cuenta sin ella.',
  },
  status_not_configured: {
    en: 'Enter your Abode email and password in the configuration.',
    fr: 'Saisissez l’e-mail et le mot de passe Abode dans la configuration.',
    de: 'Abode-E-Mail und Passwort in der Konfiguration eingeben.',
    es: 'Introduzca el correo y la contraseña de Abode en la configuración.',
  },
  status_unreachable: {
    en: 'The Abode cloud cannot be reached, retrying.',
    fr: 'Le cloud Abode est injoignable, nouvelle tentative en cours.',
    de: 'Die Abode-Cloud ist nicht erreichbar, neuer Versuch läuft.',
    es: 'No se puede acceder a la nube de Abode, reintentando.',
  },

  // Widgets
  widget_mode: { en: 'Alarm', fr: 'Alarme', de: 'Alarm', es: 'Alarma' },
  widget_connection: { en: 'Abode cloud', fr: 'Cloud Abode', de: 'Abode-Cloud', es: 'Nube Abode' },
  widget_online: { en: 'Connected', fr: 'Connecté', de: 'Verbunden', es: 'Conectado' },
  widget_offline: { en: 'Disconnected', fr: 'Déconnecté', de: 'Getrennt', es: 'Desconectado' },
  widget_openings: { en: 'Open', fr: 'Ouverts', de: 'Offen', es: 'Abiertos' },
  widget_faults: { en: 'Faults', fr: 'Défauts', de: 'Störungen', es: 'Fallos' },
  widget_last_alarm: {
    en: 'Last alarm',
    fr: 'Dernière alarme',
    de: 'Letzter Alarm',
    es: 'Última alarma',
  },
  widget_none: { en: 'None', fr: 'Aucune', de: 'Keiner', es: 'Ninguna' },
  widget_arm_away: {
    en: 'Arm away',
    fr: 'Armer total',
    de: 'Abwesend scharf',
    es: 'Armar ausente',
  },
  widget_arm_home: {
    en: 'Arm home',
    fr: 'Armer partiel',
    de: 'Zuhause scharf',
    es: 'Armar en casa',
  },
  widget_disarm: { en: 'Disarm', fr: 'Désarmer', de: 'Unscharf', es: 'Desarmar' },
  widget_no_openings: {
    en: 'No door or window sensor.',
    fr: 'Aucun capteur de porte ou fenêtre.',
    de: 'Kein Tür- oder Fenstersensor.',
    es: 'Ningún sensor de puerta o ventana.',
  },
  widget_no_events: {
    en: 'No recent event.',
    fr: 'Aucun événement récent.',
    de: 'Kein aktuelles Ereignis.',
    es: 'Ningún evento reciente.',
  },
  widget_not_connected: {
    en: 'Not connected to Abode yet.',
    fr: 'Pas encore connecté à Abode.',
    de: 'Noch nicht mit Abode verbunden.',
    es: 'Aún no conectado a Abode.',
  },
  widget_disarm_disabled: {
    en: 'Disarming from the dashboard is disabled.',
    fr: 'Le désarmement depuis le tableau de bord est désactivé.',
    de: 'Unscharfschalten über das Dashboard ist deaktiviert.',
    es: 'Desarmar desde el panel está desactivado.',
  },
  state_open: { en: 'Open', fr: 'Ouvert', de: 'Offen', es: 'Abierto' },
  state_closed: { en: 'Closed', fr: 'Fermé', de: 'Geschlossen', es: 'Cerrado' },
  badge_alarm: { en: 'Alarm', fr: 'Alarme', de: 'Alarm', es: 'Alarma' },

  // Action results
  mode_set: {
    en: 'Alarm mode set to: {mode}.',
    fr: 'Mode de l’alarme : {mode}.',
    de: 'Alarmmodus gesetzt: {mode}.',
    es: 'Modo de alarma: {mode}.',
  },
  connection_ok: {
    en: 'Connected to Abode: {devices} device(s), alarm mode {mode}.',
    fr: 'Connecté à Abode : {devices} appareil(s), mode {mode}.',
    de: 'Mit Abode verbunden: {devices} Gerät(e), Modus {mode}.',
    es: 'Conectado a Abode: {devices} dispositivo(s), modo {mode}.',
  },
  automations_list: {
    en: 'Automations: {list}',
    fr: 'Automatisations : {list}',
    de: 'Automationen: {list}',
    es: 'Automatizaciones: {list}',
  },
  automations_none: {
    en: 'No automation in this Abode account.',
    fr: 'Aucune automatisation dans ce compte Abode.',
    de: 'Keine Automation in diesem Abode-Konto.',
    es: 'Ninguna automatización en esta cuenta de Abode.',
  },
  automation_triggered: {
    en: 'Automation “{name}” triggered.',
    fr: 'Automatisation « {name} » déclenchée.',
    de: 'Automation „{name}“ ausgelöst.',
    es: 'Automatización «{name}» ejecutada.',
  },
};

/**
 * Multi-language object of a message, `{placeholders}` substituted. A
 * placeholder value may itself be a multi-language object (a mode label...):
 * each language then gets its own translation.
 * @param {keyof MESSAGES} key - Message key.
 * @param {Record<string, unknown>} [params] - Placeholder values.
 * @returns {{en: string, fr: string, de: string, es: string}}
 */
export function t(key, params = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message: ${key}`);
  }
  const result = {};
  for (const language of LANGUAGES) {
    result[language] = message[language].replace(/\{(\w+)\}/g, (match, name) => {
      const value = params[name];
      if (value === undefined || value === null) {
        return match;
      }
      return typeof value === 'object' ? (value[language] ?? value.en) : String(value);
    });
  }
  return result;
}
