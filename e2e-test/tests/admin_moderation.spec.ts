import { test, expect } from '@playwright/test';
import {
  logout,
  memeCard,
  registerAdmin,
  registerUser,
  reportComment,
  reportMeme,
  uniqueUsername,
  uploadMeme,
} from './helper';

test.describe('flujos E2E de administración', () => {
  test('revisar reportes de memes, limitar comentarios y resolver reportes', async ({
    page,
  }) => {
    const author = uniqueUsername('e2e_user_1');
    const reporter = uniqueUsername('e2e_user_2');
    const limitedContent = `E2E limitar comentarios ${uniqueUsername()}`;
    const removedContent = `E2E eliminar publicación ${uniqueUsername()}`;
    const removalReason = `Incumple las normas ${uniqueUsername()}`;

    await registerUser(page, author);
    await uploadMeme(page, limitedContent);
    await uploadMeme(page, removedContent);
    await logout(page);

    await registerUser(page, reporter);
    await reportMeme(page, limitedContent);
    await reportMeme(page, removedContent);
    await logout(page);

    await registerAdmin(page);
    await page.getByRole('link', { name: 'Reportes' }).click();
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();

    await page.getByRole('tab', { name: 'Posts' }).click();

    const limitedReport = page.getByRole('article').filter({ hasText: limitedContent });
    const removedReport = page.getByRole('article').filter({ hasText: removedContent });
    await expect(limitedReport).toBeVisible();
    await expect(removedReport).toBeVisible();
    await limitedReport.getByText('Ver 1 reporte').click();
    await expect(limitedReport.getByText(`@${reporter}`, { exact: true })).toBeVisible();

    await limitedReport.getByRole('button', { name: 'Limitar comentarios' }).click();
    await expect(limitedReport.getByText('Comentarios limitados')).toBeVisible();
    await expect(
      limitedReport.getByRole('button', { name: 'Permitir comentarios' }),
    ).toBeVisible();

    await page.goto('/');
    await expect(memeCard(page, limitedContent)).toHaveCount(1);
    await memeCard(page, limitedContent).getByRole('img').click();
    await expect(
      page.getByText('Los comentarios están limitados en esta publicación.'),
    ).toBeVisible();
    await expect(page.getByLabel('Escribe un comentario')).toHaveCount(0);

    await page.goto('/admin/reportes');
    const pendingLimitedReport = page
      .getByRole('article')
      .filter({ hasText: limitedContent });
    await pendingLimitedReport.getByRole('button', { name: 'Descartar reportes' }).click();
    await expect(pendingLimitedReport).toHaveCount(0);

    await page.getByRole('button', { name: 'Resueltos' }).click();
    const resolvedLimitedReport = page
      .getByRole('article')
      .filter({ hasText: limitedContent });
    await expect(resolvedLimitedReport).toBeVisible();
    await resolvedLimitedReport.getByText('Ver 1 reporte').click();
    await expect(resolvedLimitedReport.getByText('Descartado')).toBeVisible();

    await page.getByRole('button', { name: 'Pendientes' }).click();
    const pendingRemovedReport = page
      .getByRole('article')
      .filter({ hasText: removedContent });
    await pendingRemovedReport.getByRole('button', { name: 'Eliminar publicación' }).click();

    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    await confirmation.getByLabel('Motivo').fill(removalReason);
    await confirmation.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(pendingRemovedReport).toHaveCount(0);

    await page.goto('/');
    await expect(memeCard(page, removedContent)).toHaveCount(0);
    await page.goto('/admin/reportes');
    await page.getByRole('button', { name: 'Resueltos' }).click();
    const resolvedRemovedReport = page
      .getByRole('article')
      .filter({ hasText: removedContent });
    await expect(resolvedRemovedReport).toBeVisible();
    const removalNotice = resolvedRemovedReport.locator('p').filter({
      hasText: 'Motivo:',
    });
    await expect(removalNotice).toBeVisible();
    await expect(removalNotice).toContainText(removalReason);
  });

  test('revisar y resolver el reporte de un comentario', async ({ page }) => {
    const author = uniqueUsername('e2e_comment_author');
    const reporter = uniqueUsername('e2e_comment_reporter');
    const memeContent = `E2E meme con comentario reportado ${uniqueUsername()}`;
    const commentContent = `Comentario reportado ${uniqueUsername()}`;
    const removalReason = `Comentario fuera de norma ${uniqueUsername()}`;

    await registerUser(page, author);
    await uploadMeme(page, memeContent);
    await memeCard(page, memeContent).getByRole('img').click();
    await page.getByLabel('Escribe un comentario').fill(commentContent);
    await page.getByRole('button', { name: 'Enviar comentario' }).click();
    await expect(page.getByText(commentContent, { exact: true })).toBeVisible();
    await page.goto('/');
    await logout(page);

    await registerUser(page, reporter);
    await memeCard(page, memeContent).getByRole('img').click();
    await reportComment(page, commentContent);
    await page.goto('/');
    await logout(page);

    await registerAdmin(page);
    await page.goto('/admin/reportes');
    await page.getByRole('tab', { name: 'Comentarios' }).click();

    const pendingReport = page
      .getByRole('article')
      .filter({ hasText: commentContent });
    await expect(pendingReport).toBeVisible();
    await pendingReport.getByText('Ver 1 reporte').click();
    await expect(pendingReport.getByText(`@${reporter}`, { exact: true })).toBeVisible();
    await expect(pendingReport.locator('li')).toContainText('Pendiente');

    await pendingReport.getByRole('button', { name: 'Eliminar comentario' }).click();
    const confirmation = page.getByRole('alertdialog');
    await confirmation.getByLabel('Motivo').fill(removalReason);
    await confirmation.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(pendingReport).toHaveCount(0);

    await page.getByRole('button', { name: 'Resueltos' }).click();
    const resolvedReport = page
      .getByRole('article')
      .filter({ hasText: commentContent });
    await expect(resolvedReport).toBeVisible();
    await resolvedReport.getByText('Ver 1 reporte').click();
    await expect(resolvedReport.locator('li')).toContainText('Aceptado');
    const removalNotice = resolvedReport.locator('p').filter({
      hasText: 'Motivo:',
    });
    await expect(removalNotice).toContainText(removalReason);
  });

  test('moderar un comentario y publicaciones desde el botón de moderación', async ({
    page,
  }) => {
    const author = uniqueUsername('e2e_direct_author');
    const lockedContent = `E2E publicación para limitar ${uniqueUsername()}`;
    const removedContent = `E2E publicación para eliminar ${uniqueUsername()}`;
    const commentContent = `Comentario para moderar ${uniqueUsername()}`;
    const commentRemovalReason = `Comentario moderado ${uniqueUsername()}`;
    const memeRemovalReason = `Publicación moderada ${uniqueUsername()}`;

    await registerUser(page, author);
    await uploadMeme(page, lockedContent);
    await uploadMeme(page, removedContent);
    await memeCard(page, lockedContent).getByRole('img').click();
    await page.getByLabel('Escribe un comentario').fill(commentContent);
    await page.getByRole('button', { name: 'Enviar comentario' }).click();
    await expect(page.getByText(commentContent, { exact: true })).toBeVisible();
    await page.goto('/');
    await logout(page);

    await registerAdmin(page);
    await page.goto('/');

    const lockedCard = memeCard(page, lockedContent);
    await lockedCard.getByRole('button', { name: 'Moderar publicación' }).click();
    await lockedCard.getByRole('menuitem', { name: 'Limitar comentarios' }).click();
    await lockedCard.getByRole('button', { name: 'Moderar publicación' }).click();
    await expect(
      lockedCard.getByRole('menuitem', { name: 'Permitir comentarios' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await lockedCard.getByRole('img', { name: lockedContent, exact: true }).click();
    await expect(page.getByText(commentContent, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Moderar comentario' }).click();
    const commentConfirmation = page.getByRole('alertdialog');
    await commentConfirmation.getByLabel('Motivo').fill(commentRemovalReason);
    await commentConfirmation
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();
    await expect(commentConfirmation).toBeHidden();
    await expect(page.getByText('Comentario eliminado', { exact: true })).toBeVisible();

    await page.goto('/');
    const removedCard = memeCard(page, removedContent);
    await removedCard.getByRole('button', { name: 'Moderar publicación' }).click();
    await removedCard.getByRole('menuitem', { name: 'Eliminar publicación' }).click();
    const memeConfirmation = page.getByRole('alertdialog');
    await memeConfirmation.getByLabel('Motivo').fill(memeRemovalReason);
    await memeConfirmation
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();
    await expect(memeConfirmation).toBeHidden();
    await expect(removedCard).toHaveCount(0);
  });
});
