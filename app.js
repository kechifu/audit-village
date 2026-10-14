"use strict";
(() => {
    const app = document.querySelector('#app');
    const questions = CONTENT.questions;
    const key = 'audit-village-v1';
    let state = { answers: questions.map(() => null), position: 0, started: false };
    let storageAvailable = true;
    // shortcut: progress stays on this browser; add account sync only if learners need it.
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved && typeof saved === 'object') {
            const s = saved;
            if (Array.isArray(s.answers) && s.answers.length === questions.length &&
                s.answers.every(a => a === null || (Number.isInteger(a) && a >= 0 && a < 3)) &&
                Number.isInteger(s.position) && s.position >= 0 && s.position <= questions.length &&
                typeof s.started === 'boolean' &&
                s.answers.every((a, i) => i < s.position ? a !== null : i === s.position || a === null)) {
                state = s;
            }
        }
    }
    catch { /* Ignore an unreadable saved session and start fresh. */ }
    try {
        localStorage.setItem(key, JSON.stringify(state));
    }
    catch {
        storageAvailable = false;
    }
    let mode = 'home';
    let reviewQueue = [];
    let reviewPosition = 0;
    let reviewChoice = null;
    let reviewCorrect = 0;
    const letters = ['A', 'B', 'C'];
    const icons = ['☕', '▣', '◎', '✉', '⚑'];
    const escape = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const score = () => state.answers.reduce((n, a, i) => n + (a === questions[i].answer_index ? 10 : 0), 0);
    const wrong = () => questions.flatMap((q, i) => state.answers[i] !== null && state.answers[i] !== q.answer_index ? [i] : []);
    function save() {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        }
        catch {
            storageAvailable = false;
        }
    }
    function source(q) {
        return `<details class="source"><summary>查閱來源 · 原文第 ${q.source_question_numbers.join('、')} 題</summary><p class="small">民國113年10月7日版 · 提供的原文節錄</p>${q.source_quotes.map(s => `<blockquote>${escape(s)}</blockquote>`).join('')}</details>`;
    }
    function map() {
        return `<nav class="week" aria-label="第一週章節">${CONTENT.days.map(d => {
            const done = questions.filter((q, i) => q.day === d.day && state.answers[i] !== null).length;
            const active = mode === 'play' && questions[state.position]?.day === d.day;
            return `<div class="day ${active ? 'active' : ''} ${done === 2 ? 'done' : ''}" ${active ? 'aria-current="step"' : ''}><span>DAY ${d.day}</span><strong>${icons[d.day - 1]} ${['報到', '金流', '計畫', '交付', '治理'][d.day - 1]}</strong><small>${done}/2 完成</small></div>`;
        }).join('')}</nav>`;
    }
    function render(focus = true) {
        const count = state.answers.filter(a => a !== null).length;
        const status = storageAvailable ? '進度自動保存在這個瀏覽器，下次可接著玩。' : '此瀏覽器無法保存進度；本次仍可完整遊玩，關閉後會重置。';
        let html = '';
        if (mode === 'home') {
            html = `<section class="hero"><div class="hero-copy"><p class="eyebrow">職場生存手帳 / ONBOARDING QUEST</p><h1>菜鳥稽核員的<br><span>第一週。</span></h1><p class="lead">全公司都說「沒問題啦」。<br>你，真的相信嗎？</p><p>${escape(CONTENT.intro.description)}</p><div class="actions"><button class="primary" data-action="start">${state.started ? (state.position === 10 ? '查看我的成果' : '接續挑戰 · 第 ' + (state.position + 1) + ' 關') : '領取識別證，開始上班'} <span aria-hidden="true">→</span></button>${state.started ? '<button class="quiet" data-action="restart">重新開始</button>' : ''}</div><p class="small">5 天 × 每天 2 關 · 三選一 · 首答正確 +10 分</p></div><div class="badge" aria-hidden="true"><div class="badge-hole"></div><p>全都OK股份有限公司</p><div class="avatar">☺</div><h2>新進稽核員</h2><p>任務：守住流程、時間與證據</p><div class="badge-code">AUDIT DEPT. / ROOKIE 001</div><span class="stamp">歡迎報到</span></div></section>${map()}<section class="brief card"><div><p class="eyebrow">你的新手任務</p><h2>${escape(CONTENT.intro.heading)}</h2></div><p>主管想省流程，同事想走捷徑。用你的判斷拆解 10 個職場事件；每次選擇後，都會收到解說與一句記憶重點。</p><p class="small">${escape(CONTENT.intro.scoring)}</p><p class="save-note">${status}</p></section>`;
        }
        else if (mode === 'result') {
            const missed = wrong();
            html = `<section class="result-head"><p class="eyebrow">第一週任務完成 / MISSION COMPLETE</p><h1>咖啡，終於可以<br><span>安心喝了。</span></h1><p>${escape(CONTENT.ending.heading)}</p><div class="score"><strong>${score()}</strong><span>/ 100 分<br>首答正確 ${score() / 10} / 10 關</span></div><p>${escape(CONTENT.ending.message)}</p><p class="small">遊戲成績不代表合格或專業資格。複習不會改寫首答成績。</p><div class="actions">${missed.length ? `<button class="primary" data-action="review">複習 ${missed.length} 道答錯題目 →</button>` : '<span class="all-clear">✓ 首答全部正確，10 個重點都收下了！</span>'}<button class="secondary" data-action="restart">重新挑戰</button></div></section><section class="results card"><p class="eyebrow">你的學習成果</p><h2>第一週觀念手帳</h2><p>展開每關，回顧你的選擇、正解與原因。</p>${CONTENT.days.map(d => `<h3 class="result-day">DAY ${d.day} · ${escape(d.title)} <span>${questions.filter((q, i) => q.day === d.day && state.answers[i] === q.answer_index).length}/2 首答正確</span></h3>${questions.filter(q => q.day === d.day).map(q => { const i = questions.indexOf(q); const ok = state.answers[i] === q.answer_index; return `<details class="result-item"><summary><span class="pill ${ok ? 'good' : 'bad'}">${ok ? '已掌握' : '待複習'}</span> ${q.id} · ${escape(q.title)}</summary><p class="hook">${escape(q.memory_hook)}</p><p>你的首答：${letters[state.answers[i]]} · ${escape(q.options[state.answers[i]] || '')}</p><p><strong>正確答案：${letters[q.answer_index]} · ${escape(q.options[q.answer_index])}</strong></p><p>${escape(q.explanation)}</p>${source(q)}</details>`; }).join('')}`).join('')}</section>`;
        }
        else {
            const reviewing = mode === 'review';
            const index = reviewing ? reviewQueue[reviewPosition] : state.position;
            const q = questions[index];
            const day = CONTENT.days[q.day - 1];
            const choice = reviewing ? reviewChoice : state.answers[index];
            const answered = choice !== null;
            const correct = choice === q.answer_index;
            html = `${reviewing ? '<p class="review-banner">↻ 錯題練習 · 不改變首答成績</p>' : map()}<section class="game-layout"><aside class="mission"><p class="eyebrow">${reviewing ? 'REVIEW / 再練一次' : 'DAY ' + q.day + ' / 任務手帳'}</p><h2>${escape(day.title)}</h2><p>${escape(day.subtitle)}</p><div class="progress-label"><span>${reviewing ? `複習 ${reviewPosition + 1} / ${reviewQueue.length}` : `第 ${index + 1} / 10 關`}</span><strong>${score()} 分</strong></div><progress value="${reviewing ? reviewPosition : count}" max="${reviewing ? reviewQueue.length : 10}" aria-label="${reviewing ? '錯題複習' : '闖關'}進度"></progress><p class="small">${status}</p><button class="quiet" data-action="${reviewing ? 'results' : 'home'}">${reviewing ? '返回學習成果' : '暫停，回到報到處'}</button></aside><article class="question-card card"><p class="eyebrow">CASE ${q.id.slice(1)} <span class="case-label">${reviewing ? '錯題複習' : index === 9 ? '最終魔王' : '職場事件'}</span></p><h1 class="question-title">${escape(q.title)}</h1><p class="tagline">${escape(q.tagline)}</p><div class="scene"><span class="scene-icon" aria-hidden="true">${icons[q.day - 1]}</span><p>${escape(q.scene)}</p></div><h2 class="prompt">${escape(q.question)}</h2><p class="small">${answered ? '已記錄選擇，看看這次事件教會你什麼。' : '選一個處理方式，送出後才會顯示解說。'}</p><div class="options">${q.options.map((o, i) => `<button class="option ${answered && i === q.answer_index ? 'correct' : ''} ${answered && i === choice && !correct ? 'incorrect' : ''}" data-choice="${i}" ${answered ? 'disabled' : ''}><span class="letter">${letters[i]}</span><span>${escape(o)}${answered && i === q.answer_index ? '<small>✓ 正確答案</small>' : answered && i === choice ? '<small>你的選擇 · 再學一個重點</small>' : ''}</span></button>`).join('')}</div>${answered ? `<section class="feedback ${correct ? 'positive' : 'negative'}" id="feedback" tabindex="-1" aria-label="答題回饋"><p class="eyebrow">${correct ? '✓ 判斷正確' : '↗ 沒關係，風險找到了'} · ${reviewing ? '練習不計分' : correct ? '+10 分' : '本關 +0 分'}</p><h2>${escape(q.choice_reactions[choice])}</h2><p><strong>正確答案：${letters[q.answer_index]} · ${escape(q.options[q.answer_index])}</strong></p><p>${escape(q.explanation)}</p><div class="hook"><small>一句記住</small><strong>${escape(q.memory_hook)}</strong></div>${source(q)}</section><div class="next-scene"><small>${reviewing ? '再練一次，讓觀念留下來。' : '下一幕'}</small>${reviewing ? '' : `<p>${escape(q.next_teaser)}</p>`}<button class="primary" data-action="next">${reviewing ? reviewPosition === reviewQueue.length - 1 ? '完成複習 →' : '下一道複習題 →' : index === 9 ? '領取第一週成果 →' : '繼續下一關 →'}</button></div>` : ''}</article></section>`;
        }
        app.innerHTML = html;
        if (focus) {
            app.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
    app.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled)
            return;
        if (button.dataset.choice !== undefined) {
            const choice = Number(button.dataset.choice);
            if (mode === 'play' && state.answers[state.position] === null) {
                state.answers[state.position] = choice;
                save();
            }
            else if (mode === 'review' && reviewChoice === null) {
                reviewChoice = choice;
                if (choice === questions[reviewQueue[reviewPosition]].answer_index)
                    reviewCorrect++;
            }
            else
                return;
            render(false);
            document.getElementById('feedback')?.focus({ preventScroll: true });
            document.getElementById('feedback')?.scrollIntoView({ block: 'start', behavior: 'instant' });
            return;
        }
        switch (button.dataset.action) {
            case 'start':
                state.started = true;
                mode = state.position === 10 ? 'result' : 'play';
                save();
                break;
            case 'home':
                mode = 'home';
                break;
            case 'results':
                mode = 'result';
                break;
            case 'restart':
                if (state.started && !confirm('重新挑戰會清除這個瀏覽器的本次成績與進度。確定重新開始？'))
                    return;
                state = { answers: questions.map(() => null), position: 0, started: true };
                mode = 'play';
                save();
                break;
            case 'review':
                reviewQueue = wrong();
                reviewPosition = 0;
                reviewChoice = null;
                reviewCorrect = 0;
                mode = 'review';
                break;
            case 'next':
                if (mode === 'review') {
                    if (reviewChoice === null)
                        return;
                    reviewPosition++;
                    if (reviewPosition === reviewQueue.length) {
                        mode = 'result';
                        render();
                        const notice = document.createElement('p');
                        notice.className = 'review-banner';
                        notice.setAttribute('role', 'status');
                        notice.textContent = `複習完成！這次答對 ${reviewCorrect} / ${reviewQueue.length} 題。首答成績仍為 ${score()} 分；你可以再次練習或展開手帳回顧。`;
                        app.prepend(notice);
                        return;
                    }
                    reviewChoice = null;
                }
                else if (mode === 'play' && state.answers[state.position] !== null) {
                    state.position++;
                    mode = state.position === 10 ? 'result' : 'play';
                    save();
                }
                break;
            default: return;
        }
        render();
    });
    render(false);
})();
