import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { encipher, parsePlugboard, type MachineSettings } from '../../src/enigma';

const tape = (page: Page) => page.getByTestId('tape');
const expectOutput = (page: Page, text: string) => expect(tape(page)).toHaveAttribute('data-output', text);
const expectInput = (page: Page, text: string) => expect(tape(page)).toHaveAttribute('data-input', text);
const rotors = async (page: Page) =>
  Promise.all([0, 1, 2].map((i) => page.getByTestId(`rotor-${i}`).getAttribute('data-letter'))).then((l) => l.join(''));
/** Move focus out of any text field so the physical keyboard drives the machine. */
const focusMachine = (page: Page) => page.locator('h1').click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tape')).toBeVisible();
});

test('physical keyboard: a key lights its lamp while held and steps the rotors first', async ({ page }) => {
  await page.keyboard.down('a');
  await expect(page.getByTestId('lamp-B')).toHaveClass(/is-lit/);
  await expect(page.getByTestId('key-A')).toHaveClass(/is-down/);
  await expect(page.getByTestId('rotor-2')).toHaveAttribute('data-letter', 'B');
  await page.keyboard.up('a');
  await expect(page.getByTestId('lamp-B')).not.toHaveClass(/is-lit/);
  await expect(page.getByTestId('key-A')).not.toHaveClass(/is-down/);

  await page.keyboard.type('aaaa');
  await expectOutput(page, 'BDZGO');
  expect(await rotors(page)).toBe('AAF');
  await expect(page.getByTestId('announcer')).toHaveText('A, lamp O');
});

test('spaces and punctuation are skipped and do not step the rotors', async ({ page }) => {
  await page.keyboard.type('a a,a!');
  await expectInput(page, 'AAA');
  await expectOutput(page, 'BDZ');
  expect(await rotors(page)).toBe('AAD');
  await expect(page.getByText('skipped: the machine has only the letters A–Z')).toBeVisible();

  await page.getByTestId('feed-input').fill('a-a 1a');
  await expect(page.getByText('3 letters will be typed, 3 characters skipped.')).toBeVisible();
  await page.getByTestId('feed-submit').click();
  await expectOutput(page, 'BDZGOW');
});

test('done criterion: configure, encrypt, restore the start, type the ciphertext, recover the letters', async ({ page }) => {
  await page.getByTestId('ukw-C').check();
  await page.getByTestId('rotor-select-0').selectOption('IV');
  await page.getByTestId('rotor-select-1').selectOption('V');
  await page.getByTestId('rotor-select-2').selectOption('II');
  await page.getByTestId('ring-select-0').selectOption('4'); // 05
  await page.getByTestId('ring-select-1').selectOption('12'); // 13
  await page.getByTestId('ring-select-2').selectOption('25'); // 26
  await page.getByTestId('position-select-0').selectOption('16'); // Q
  await page.getByTestId('position-select-1').selectOption('4'); // E
  await page.getByTestId('position-select-2').selectOption('21'); // V
  await page.getByTestId('plugboard-input').fill('AZ BY CX DW');
  await expect(page.getByTestId('key-line')).toHaveText(
    'Enigma I · UKW C · Walzen IV V II · Ringe 05 13 26 · Grund QEV · Stecker AZ BY CX DW',
  );
  expect(await rotors(page)).toBe('QEV');

  await focusMachine(page);
  await page.keyboard.type('Meet at the bridge, 6 pm.');
  const plain = 'MEETATTHEBRIDGEPM';
  await expectInput(page, plain);
  const cipher = (await tape(page).getAttribute('data-output')) as string;
  expect(cipher).toHaveLength(plain.length);

  // The interface agrees with the cipher core used by the unit tests.
  const settings: MachineSettings = {
    reflector: 'C',
    rotors: ['IV', 'V', 'II'],
    rings: [4, 12, 25],
    positions: [16, 4, 21],
    plugboard: parsePlugboard('AZ BY CX DW').pairs,
  };
  expect(cipher).toBe(encipher(settings, plain));

  await page.getByTestId('restore').click();
  expect(await rotors(page)).toBe('QEV');
  await expectInput(page, '');
  await expect(page.getByTestId('log-output').first()).toHaveText(cipher.replace(/(.{5})(?=.)/g, '$1 '));

  await focusMachine(page);
  await page.keyboard.type(cipher);
  await expectOutput(page, plain);
});

test('on-screen keys, keyboard navigation and undo', async ({ page }, info) => {
  const key = page.getByTestId('key-Q');
  if (info.project.name === 'mobile') await key.tap();
  else await key.click();
  await expectInput(page, 'Q');

  // Keyboard-only: arrow along the keys and press Enter.
  await page.getByTestId('key-Q').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('key-W')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectInput(page, 'QW');

  await focusMachine(page);
  await page.keyboard.press('Backspace');
  await expectInput(page, 'Q');
  expect(await rotors(page)).toBe('AAB');
  await page.getByTestId('undo').click();
  await expectInput(page, '');
  expect(await rotors(page)).toBe('AAA');
});

test('plugboard text is validated and the machine keeps the last valid board', async ({ page }) => {
  const input = page.getByTestId('plugboard-input');
  const errors = page.getByTestId('plugboard-errors');

  await input.fill('AB CD');
  await expect(page.getByTestId('key-line')).toContainText('Stecker AB CD');
  await expect(page.getByTestId('socket-A')).toHaveAttribute('aria-label', 'Socket A, cabled to B');

  await input.fill('AB CD AE');
  await input.blur();
  await expect(errors).toContainText('A is already used by AB');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(errors).toContainText('keeps the last valid board: AB CD');
  await expect(page.getByTestId('key-line')).toContainText('Stecker AB CD');

  await input.fill('QQ');
  await expect(errors).toContainText('cannot be plugged to itself');
  await input.fill('XYZ');
  await expect(errors).toContainText('is not a pair');
  await input.fill('A1');
  await expect(errors).toContainText('other than the letters A–Z');

  await input.fill('');
  await expect(errors).toHaveCount(0);
  await expect(page.getByTestId('key-line')).toContainText('Stecker —');
});

test('plugboard sockets can be cabled and uncabled by clicking', async ({ page }) => {
  await page.getByTestId('socket-A').click();
  await expect(page.getByTestId('socket-A')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('socket-V').click();
  await expect(page.getByTestId('plugboard-input')).toHaveValue('AV');
  await expect(page.getByTestId('socket-V')).toHaveAttribute('aria-label', 'Socket V, cabled to A');

  // Re-plugging A elsewhere moves the cable.
  await page.getByTestId('socket-Q').click();
  await page.getByTestId('socket-A').click();
  await expect(page.getByTestId('plugboard-input')).toHaveValue('AQ');

  await page.getByTestId('socket-Q').click();
  await expect(page.getByTestId('plugboard-input')).toHaveValue('');
});

test('rotors can be turned by hand; mid-message that files the message and starts afresh', async ({ page }) => {
  await page.getByRole('button', { name: 'Turn Right rotor forward' }).click();
  expect(await rotors(page)).toBe('AAB');
  await expect(page.getByTestId('position-select-2')).toHaveValue('1');

  const left = page.getByTestId('rotor-0');
  await left.focus();
  await page.keyboard.press('ArrowDown');
  expect(await rotors(page)).toBe('ZAB');
  await page.keyboard.press('q'); // typing a letter on a focused rotor sets it
  expect(await rotors(page)).toBe('QAB');
  await expectInput(page, '');

  await focusMachine(page);
  await page.keyboard.type('xy');
  await page.getByRole('button', { name: 'Turn Middle rotor forward' }).click();
  await expectInput(page, '');
  await expect(page.getByTestId('log-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('key-line')).toContainText('Grund QBD');
});

test('the 7 July 1941 message decrypts exactly as published', async ({ page }) => {
  await page.getByTestId('barbarossa-key').click();
  expect(await rotors(page)).toBe('WXC');
  // Focus moved to the machine: Space is reported as skipped rather than scrolling or pressing anything.
  await expect(page.locator('#machine')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByText('Space skipped')).toBeVisible();
  await page.keyboard.type('KCH');
  await expectOutput(page, 'BLA');

  await page.getByTestId('barbarossa-type').click();
  expect(await rotors(page)).not.toBe('BLA');
  await expectOutput(
    page,
    'AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLXSEBEZXSEBEZXUAFFLIEGERSTRASZERIQTUNGXDUBROWKIXDUBROWKIXOPOTSCHKAXOPOTSCHKAXUMXEINSAQTDREINULLXUHRANGETRETENXANGRIFFXINFXRGTX',
  );
  await expect(page.getByTestId('step-summary')).toBeVisible();
  await expect(page.getByTestId('signal-list').locator('li')).toHaveCount(13);
});

test('copy output puts the five-letter groups on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.keyboard.type('aaaaaaa');
  await page.getByTestId('copy-output').click();
  await expect(page.getByTestId('copy-output')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('BDZGO WC');
});

test('settings persist across reloads and share links reproduce a key', async ({ page }) => {
  await page.getByTestId('ukw-C').check();
  await page.reload();
  await expect(page.getByTestId('key-line')).toContainText('UKW C');

  await page.goto('/#ukw=B&walzen=II-IV-V&ringe=02-21-12&grund=BLA&stecker=AV-BS-CG-DL-FU-HZ-IN-KM-OW-RX');
  await expect(page.getByTestId('key-line')).toHaveText(
    'Enigma I · UKW B · Walzen II IV V · Ringe 02 21 12 · Grund BLA · Stecker AV BS CG DL FU HZ IN KM OW RX',
  );
  await expect(page.getByText('Key loaded from the link.')).toBeVisible();
  await page.keyboard.type('EDPUDNRGYS');
  await expectOutput(page, 'AUFKLXABTE');

  await page.goto('/#ukw=Q');
  await expect(page.getByText('could not be used')).toBeVisible();
});

test('fits the viewport without horizontal scrolling', async ({ page }) => {
  await page.keyboard.type('hello');
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test('has no serious accessibility violations (axe, WCAG 2.1 AA)', async ({ page }) => {
  await page.keyboard.type('hello');
  await page.getByTestId('restore').click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`);
  expect(serious).toEqual([]);
});
