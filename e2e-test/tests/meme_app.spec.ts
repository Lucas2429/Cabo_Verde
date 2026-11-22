import { test, expect } from '@playwright/test';
import {
  login,
  logout,
  memeCard,
  reactToMeme,
  registerUser,
  uniqueUsername,
  uploadMeme,
} from './helper';

test('meme app title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('HIJOS DE LA (PUNTO).FOO');
});

test.describe('flujos E2E', () => {
  test('registrar un usuario e iniciar sesión', async ({ page }) => {
    const username = uniqueUsername();
    await registerUser(page, username);
    await logout(page);
    await login(page, username);
  });

  test('iniciar y cerrar sesión', async ({ page }) => {
    const username = uniqueUsername();
    await registerUser(page, username);
    await logout(page);
    await login(page, username);
    await logout(page);
  });

  test('publicar un meme, ver comentarios y escribir un comentario', async ({ page }) => {
    const username = uniqueUsername();
    const content = `E2E comentario ${uniqueUsername()}`;
    const comment = `Comentario ${uniqueUsername()}`;
    await registerUser(page, username);
    await uploadMeme(page, content);
    await memeCard(page, content).getByRole('img', { name: content }).click();
    await expect(page.getByRole('heading', { name: /Comentarios/ })).toBeVisible();
    await page.getByLabel('Escribe un comentario').fill(comment);
    await page.getByRole('button', { name: 'Enviar comentario' }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
  });

  test('editar la descripción del perfil', async ({ page }) => {
    const username = uniqueUsername();
    const description = `Descripción actualizada ${uniqueUsername()}`;
    await registerUser(page, username);
    await page.getByRole('link', { name: username, exact: true }).click();
    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.getByLabel('Descripción').fill(description);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
  });

  test('dar like y dislike y comprobar que cambian los contadores', async ({ page }) => {
    const author = uniqueUsername();
    const liker = uniqueUsername();
    const likeContent = `E2E like ${uniqueUsername()}`;
    const dislikeContent = `E2E dislike ${uniqueUsername()}`;

    await registerUser(page, author);
    await uploadMeme(page, likeContent);
    await uploadMeme(page, dislikeContent);
    await logout(page);

    await registerUser(page, liker);
    await reactToMeme(page, likeContent, 'Me gusta');
    await reactToMeme(page, dislikeContent, 'No me gusta');
  });

  test('mostrar el podio y dar like a una publicación del primer lugar', async ({ page }) => {
    const author = uniqueUsername();
    const seedLiker = uniqueUsername();
    const podiumLiker = uniqueUsername();
    const content = `E2E podio ${uniqueUsername()}`;

    await registerUser(page, author);
    await uploadMeme(page, content);
    await logout(page);

    await registerUser(page, seedLiker);
    await reactToMeme(page, content, 'Me gusta');
    await logout(page);

    await registerUser(page, podiumLiker);
    await page.getByRole('link', { name: 'Podio de la semana' }).click();
    await expect(page.getByRole('heading', { name: 'Podio de la Semana' })).toBeVisible();
    const firstPlace = page.getByRole('button', { name: /^Primer lugar:/ });
    await expect(firstPlace).toBeVisible();
    await firstPlace.click();

    const tiedMemes = page.getByRole('dialog');
    if (await tiedMemes.count()) {
      await tiedMemes.getByRole('img').first().click();
    }

    const likeButton = page.getByRole('button', { name: /^Me gusta/ }).last();
    const count = likeButton.locator('span').last();
    const before = Number(await count.innerText());
    await likeButton.click();
    await expect(count).toHaveText(String(before + 1));
  });

  test('abrir comentarios y responder a un comentario', async ({ page }) => {
    const author = uniqueUsername();
    const commenter = uniqueUsername();
    const content = `E2E respuesta ${uniqueUsername()}`;
    const comment = `Comentario raíz ${uniqueUsername()}`;
    const reply = `Respuesta ${uniqueUsername()}`;

    await registerUser(page, author);
    await uploadMeme(page, content);
    await logout(page);

    await registerUser(page, commenter);
    await memeCard(page, content).getByRole('img', { name: content }).click();
    await page.getByLabel('Escribe un comentario').fill(comment);
    await page.getByRole('button', { name: 'Enviar comentario' }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Responder', exact: true }).click();
    await page.getByLabel(`Responder a ${commenter}`).fill(reply);
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect(page.getByText(reply, { exact: true })).toBeVisible();
  });

  test('publicar, editar y borrar un meme desde el perfil', async ({ page }) => {
    const username = uniqueUsername();
    const content = `E2E meme original ${uniqueUsername()}`;
    const editedContent = `E2E meme editado ${uniqueUsername()}`;
    await registerUser(page, username);
    await uploadMeme(page, content);
    await page.getByRole('link', { name: username, exact: true }).click();

    const card = memeCard(page, content);
    await card.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByLabel('Descripción').fill(editedContent);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(memeCard(page, editedContent)).toHaveCount(1);

    await memeCard(page, editedContent)
      .getByRole('button', { name: 'Eliminar publicación' })
      .click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(memeCard(page, editedContent)).toHaveCount(0);
  });

  test('filtrar Astronomía y comprobar que publicar aumenta el resultado en uno', async ({
    page,
  }) => {
    const username = uniqueUsername();
    const content = `E2E Astronomía ${uniqueUsername()}`;
    await registerUser(page, username, 'Astronomía');

    const astronomyFilter = page.getByRole('button', { name: 'ASTRO', exact: true });
    const filteredResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/memes' &&
        url.searchParams.get('department') === 'Astronomía'
      );
    });
    await astronomyFilter.click();
    const response = await filteredResponse;
    const filteredMemes: unknown = await response.json();
    if (!Array.isArray(filteredMemes)) {
      throw new Error('El filtro de memes debe responder una lista.');
    }
    const before = filteredMemes.length;
    await expect(astronomyFilter).toHaveAttribute('aria-pressed', 'true');
    const cards = page.locator('main .columns-2xs > div');
    await expect(cards).toHaveCount(before);

    await uploadMeme(page, content);
    await expect.poll(() => cards.count()).toBe(before + 1);
  });
});