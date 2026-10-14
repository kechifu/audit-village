const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const data = vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8') + '\nCONTENT;');
assert.equal(data.questions.length, 10);
for (const q of data.questions) {
  assert.equal(q.options.length, 3);
  assert.equal(q.choice_reactions.length, 3);
  assert.ok(q.answer_index >= 0 && q.answer_index < 3);
  assert.ok(q.source_question_numbers.length && q.source_quotes.length);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const url = process.env.TEST_URL || pathToFileURL(path.join(root, 'index.html')).href;
  const action = name => page.locator(`[data-action="${name}"]`).click();
  const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile horizontal overflow');
  try {
    await page.goto(url);
    await noOverflow();
    await page.screenshot({ path: path.join(root, 'preview-mobile.png'), fullPage: true });
    await action('start');
    for (let i = 0; i < 10; i++) {
      const q = data.questions[i];
      assert.equal(await page.locator('#feedback').count(), 0, 'answers hidden before selection');
      assert.equal(await page.locator('.source').count(), 0, 'quotes withheld until answered');
      assert.ok(await page.locator('.question-title').textContent().then(t => t.includes(q.title)));
      const selected = i % 2 === 0 ? q.answer_index : (q.answer_index + 1) % 3;
      await page.locator(`[data-choice="${selected}"]`).click();
      assert.equal(await page.locator('.option:disabled').count(), 3);
      assert.ok((await page.locator('#feedback').textContent()).includes(q.choice_reactions[selected]));
      assert.ok((await page.locator('.option.correct').textContent()).includes(q.options[q.answer_index]));
      assert.equal(await page.locator('.source').getAttribute('open'), null);
      await page.locator('.source summary').click();
      assert.ok((await page.locator('.source').textContent()).includes(q.source_quotes[0]));
      await noOverflow();
      if (i === 0) {
        await page.reload(); await action('start');
        assert.equal(await page.locator('.option:disabled').count(), 3, 'saved answer cannot rescore');
        await page.screenshot({ path: path.join(root, 'preview-feedback.png'), fullPage: true });
      }
      if (i === 1) {
        await action('home'); await page.reload(); await action('start');
        assert.equal(await page.locator('.option:disabled').count(), 3, 'resume keeps current feedback');
      }
      await action('next');
    }
    assert.equal(await page.locator('.score strong').textContent(), '50');
    assert.equal(await page.locator('.pill.bad').count(), 5);
    assert.equal(await page.locator('.result-item').count(), 10);
    await noOverflow();
    await page.screenshot({ path: path.join(root, 'preview-results.png'), fullPage: true });
    await page.reload(); await action('start');
    assert.equal(await page.locator('.score strong').textContent(), '50', 'results resume');
    await action('review');
    for (const i of [1, 3, 5, 7, 9]) {
      assert.ok((await page.locator('.question-title').textContent()).includes(data.questions[i].title));
      await page.locator(`[data-choice="${data.questions[i].answer_index}"]`).click();
      await action('next');
    }
    assert.ok((await page.locator('.review-banner').textContent()).includes('5 / 5'));
    assert.equal(await page.locator('.score strong').textContent(), '50', 'review must not rewrite first score');
    page.once('dialog', dialog => dialog.dismiss());
    await action('restart');
    assert.equal(await page.locator('.score strong').textContent(), '50', 'cancel reset preserves score');
    page.once('dialog', dialog => dialog.accept());
    await action('restart');
    for (let i = 0; i < 10; i++) {
      await page.locator(`[data-choice="${data.questions[i].answer_index}"]`).click();
      await action('next');
    }
    assert.equal(await page.locator('.score strong').textContent(), '100');
    assert.equal(await page.locator('[data-action="review"]').count(), 0);
    await page.evaluate(() => localStorage.setItem('audit-village-v1', '{bad-json'));
    await page.reload(); assert.ok((await page.locator('[data-action="start"]').textContent()).includes('領取'));
    assert.ok((await page.locator('.save-note').textContent()).includes('自動保存'), 'corrupt save must not disable working storage');
    await page.setViewportSize({ width: 320, height: 680 });
    await action('start'); await noOverflow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await action('home'); await noOverflow();
    await page.screenshot({ path: path.join(root, 'preview-desktop.png'), fullPage: true });
    const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    const privatePage = await blocked.newPage();
    await privatePage.goto(url);
    assert.ok((await privatePage.locator('.save-note').textContent()).includes('無法保存'));
    await privatePage.locator('[data-action="start"]').click();
    await privatePage.locator('[data-choice="1"]').click();
    assert.equal(await privatePage.locator('#feedback').count(), 1);
    await blocked.close();
    assert.deepEqual(errors, []);
    console.log('PASS: 10-level mixed run, 50/100 scores, source panels, persistence, review, restart, corrupt/blocked storage, 320/390/1440px layouts; no browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
