import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, MESSAGES, t } from '../src/i18n.js';

test('every message is translated in the four languages', () => {
  assert.deepEqual(LANGUAGES, ['en', 'fr', 'de', 'es']);
  for (const [key, message] of Object.entries(MESSAGES)) {
    assert.deepEqual(Object.keys(message).sort(), [...LANGUAGES].sort(), `message ${key}`);
    for (const language of LANGUAGES) {
      assert.ok(message[language].length > 0, `${key}.${language} is empty`);
      // Same placeholders in every language.
      const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join();
      assert.equal(placeholders(message[language]), placeholders(message.en), `${key}.${language}`);
    }
  }
});

test('t substitutes plain and multi-language placeholders', () => {
  const message = t('mode_set', { mode: t('mode_away') });
  assert.equal(message.en, 'Alarm mode set to: Away.');
  assert.equal(message.fr, 'Mode de l’alarme : Totale.');
  assert.equal(message.de, 'Alarmmodus gesetzt: Abwesend.');
  assert.equal(message.es, 'Modo de alarma: Ausente.');
  assert.equal(t('connection_ok', { devices: 3, mode: 'x' }).en.includes('3 device'), true);
  assert.throws(() => t('nope'), /Unknown message/);
});
