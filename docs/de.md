# Abode

Steuern Sie Ihr [Abode](https://goabode.com)-Sicherheitssystem aus Gladys
Assistant: Alarmanlage scharf und unscharf schalten, Türen, Fenster und
Sensoren verfolgen, Schlösser, Lichter, Schalter und Garagentore bedienen,
Kamerabilder aufnehmen und in Szenen auf Alarme reagieren.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer.
- Ein Abode-Konto (Abode Iota, Abode Security Kit / Gateway).
- **Zwei-Faktor-Authentifizierung ausgeschaltet für das Konto, das Gladys
  nutzt.** Die Integration meldet sich selbstständig an, ohne dass jemand
  einen Code eingibt. Nutzt Ihr Hauptkonto 2FA, laden Sie in der Abode-App
  einen zweiten Benutzer ein (Konto → Benutzer) und geben Sie dessen
  Zugangsdaten in Gladys ein.

Abode bietet nur eine **Cloud**-API: Gladys spricht mit `my.goabode.com`,
die Integration braucht also Internetzugang. Jedes Gerät zeigt das
**Cloud**-Symbol.

## Konfiguration

1. Öffnen Sie den Reiter **Konfiguration** der Integration.
2. Geben Sie **E-Mail** und **Passwort** des Abode-Kontos ein.
3. Ändern Sie bei Bedarf das **Aktualisierungsintervall** (standardmäßig 15
   Sekunden, 10 bis 300): wie oft Gladys Alarmmodus, Sensoren und Alarme
   liest.
4. Speichern Sie und klicken Sie auf **Verbindung testen**: Anzahl der
   gefundenen Geräte und aktueller Alarmmodus werden angezeigt.
5. Öffnen Sie den Reiter **Erkennung** und fügen Sie die gewünschten Geräte
   hinzu.

## Geräte

| Abode-Gerät                     | In Gladys                                   |
| ------------------------------- | ------------------------------------------- |
| Zentrale / Gateway              | Auswahl **Alarmmodus**: Standby, Home, Away |
| Tür- / Fensterkontakt           | Öffnungssensor (geschlossen / offen)        |
| Bewegungsmelder                 | Bewegungsmelder                             |
| Wassermelder                    | Lecksensor                                  |
| Rauch- / CO-Melder              | Rauch- oder Kohlenmonoxidsensor             |
| Multisensor                     | Temperatur, Luftfeuchtigkeit und Helligkeit |
| Türschloss                      | Schloss (verriegeln / entriegeln)           |
| Schalter, Zwischenstecker       | Schalter                                    |
| Dimmer, Lampe                   | Licht (an / aus + Helligkeit)               |
| Wasserventil                    | Schalter (Ventil offen)                     |
| Garagentor (Secure Barrier)     | Öffnen / Schließen + Öffnungssensor         |
| Kameras                         | Kamera (Bild auf Abruf)                     |
| Batterie- und Sabotagestörungen | Sensoren „Batterie schwach“ und „Sabotage“  |

Ein in der Abode-App hinzugefügtes Gerät erscheint bei der nächsten
Aktualisierung im Reiter Erkennung.

## Aktionen (Konfigurationsseite)

- **Verbindung testen** — liest Abode sofort und zeigt das Ergebnis.
- **Automationen auflisten** — die Namen Ihrer Abode-Automationen, für die
  Szenenaktion „Abode-Automation ausführen“.
- **Alarmmodus ändern** — scharf oder unscharf schalten aus der
  Konfigurationsseite.

## Szenen

Auslöser:

- **Abode-Alarmmodus geändert** — die Anlage wurde scharf oder unscharf
  geschaltet (Gladys, Tastatur, Fernbedienung oder Abode-App). Filter auf
  den neuen Modus; Variablen `{{triggerEvent.data.mode}}` und
  `{{triggerEvent.data.previous_mode}}` (`standby`, `home`, `away`).
- **Abode-Alarm ausgelöst** — Abode hat Alarm ausgelöst. Filter auf den Typ
  (Einbruch, Feuer / Rauch, Kohlenmonoxid, Wasserleck, Panik, medizinisch,
  andere) und das Gerät; Variablen `alarm_type`, `device_name` und
  `event_name`.
- **Störung eines Abode-Geräts** — schwache Batterie, Sabotage, Blockierung
  oder Verbindungsverlust. Variablen `fault` und `device_name`.

Aktionen:

- **Abode-Alarmmodus setzen** — gibt den von Abode bestätigten Modus zurück.
- **Abode-Automation ausführen** — nach Name (ohne Groß-/Kleinschreibung)
  oder Kennung; gibt zurück, ob sie gefunden und ausgeführt wurde.
- **Abode-Kamerabild aufnehmen** — danach mit der Aktion „Kamerabild
  senden“ verschicken.

## Dashboard

Drei Widgets stehen bereit (Gladys 5.1 oder neuer):

- **Abode-Alarm** — Alarmmodus, offene Türen und Fenster, gestörte Geräte,
  letzter Alarm und die Tasten **Abwesend scharf** / **Zuhause scharf** (mit
  Bestätigung). Die Taste **Unscharf** ist standardmäßig ausgeblendet:
  aktivieren Sie _Taste zum Unscharfschalten zeigen_ nur, wenn das Dashboard
  für niemanden sichtbar ist, der die Anlage nicht unscharf schalten darf.
- **Abode-Türen und -Fenster** — offen / geschlossen für jeden
  Öffnungssensor, offene zuerst.
- **Abode-Verlauf** — die neuesten Ereignisse, Alarme hervorgehoben.

## Fehlerbehebung

- **„Abode-Anmeldung fehlgeschlagen“** — E-Mail und Passwort in der
  Abode-App prüfen. Nach einer Ablehnung wartet die Integration 30 Minuten
  (wiederholte Fehlversuche können das Konto sperren); Speichern der
  Konfiguration versucht es sofort erneut.
- **„Zwei-Faktor-Authentifizierung“** — einen Abode-Benutzer ohne 2FA
  verwenden (siehe Voraussetzungen).
- **Cloud nicht erreichbar** — die Geräte zeigen _Nicht erreichbar_ bis zum
  nächsten erfolgreichen Lesen.

Die Integration protokolliert jede Anfrage (nie Passwort oder Tokens):
siehe die Integrationsprotokolle in Gladys, mit `LOG_LEVEL=debug` für alle
Details.

Abode ist eine Marke ihres Inhabers; diese Integration ist ein
Community-Projekt ohne Verbindung zu Abode Systems.
