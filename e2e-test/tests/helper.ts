import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

const ADMIN_PASSWORD = 'e2e-password';
const execAsync = promisify(exec);
const TEST_IMAGE = {
  name: 'e2e.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
    'base64',
  ),
};

export function uniqueUsername(prefix = 'e2e') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function registerUser(
  page: Page,
  username: string,
  department = 'DCC',
) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Correo').fill(`${username}@example.com`);
  await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: department, exact: true }).click();
  await page.getByTestId('login-button').click();
  await expect(page.getByRole('link', { name: username, exact: true })).toBeVisible();
}

export async function registerAdmin(page: Page) {
  const username = uniqueUsername('e2e_admin');
  await registerUser(page, username);
  await execAsync(`npm run set-role -- ${username} admin`, {
    cwd: resolve(__dirname, '..', '..', 'backend'),
    env: { ...process.env, NODE_ENV: 'test' },
  });
  await logout(page);
  await login(page, username);
}

export async function login(
  page: Page,
  username: string,
  password = ADMIN_PASSWORD,
) {
  await page.goto('/login');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-button').click();
  await expect(page.getByRole('link', { name: username, exact: true })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByTestId('login-link')).toBeVisible();
}

export async function uploadMeme(page: Page, content: string) {
  await page.getByTestId('addIcon').click();
  await expect(page.getByRole('heading', { name: 'Añada su meme' })).toBeVisible();
  await page.locator('#meme-image').setInputFiles(TEST_IMAGE);
  await page.getByLabel('Descripción').fill(content);
  await page.getByRole('button', { name: 'Add Meme' }).click();
  await expect(page.getByRole('heading', { name: 'Añada su meme' })).toBeHidden();
  await expect(memeCard(page, content)).toHaveCount(1);
}

export function memeCard(page: Page, content: string) {
  return page
    .locator('main .columns-2xs > div')
    .filter({ has: page.getByRole('img', { name: content, exact: true }) });
}

export async function reactToMeme(
  page: Page,
  content: string,
  reaction: 'Me gusta' | 'No me gusta',
) {
  const card = memeCard(page, content);
  await expect(card).toHaveCount(1);
  await card.hover();
  const button = card.getByRole('button', { name: new RegExp(`^${reaction}`) });
  const count = button.locator('span').last();
  const before = Number(await count.innerText());
  await button.click();
  await expect(count).toHaveText(String(before + 1));
}

export async function reportMeme(page: Page, content: string) {
  const card = memeCard(page, content);
  await expect(card).toHaveCount(1);
  await card.hover();
  await card.getByRole('button', { name: 'Reportar' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Violencia o discurso de odio.' }).check();
  await dialog.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(dialog.getByRole('heading', { name: 'Reporte enviado' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
}

export async function reportComment(page: Page, content: string) {
  await expect(page.getByText(content, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reportar comentario' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Violencia o discurso de odio.' }).check();
  await dialog.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(dialog.getByRole('heading', { name: 'Reporte enviado' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
}
