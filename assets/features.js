// features.js — カウントダウン・終了のお知らせ・NEW バッジ・絞り込みと検索・読み上げ
(function () {
  var HOUR = 3600 * 1000;

  // ---- 更新の予定（日本時間 10/15・10/16 の 8・11・14・17・20 時） ----
  var SCHEDULE = [];
  [15, 16].forEach(function (day) {
    [8, 11, 14, 17, 20].forEach(function (h) {
      SCHEDULE.push(new Date(Date.UTC(2026, 9, day, h - 9))); // 日本時間 = 世界標準時 + 9時間
    });
  });
  var END = SCHEDULE[SCHEDULE.length - 1];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- 1. 次回更新までのカウントダウン ----
  var countdown = document.getElementById('countdown');
  function tick() {
    var now = new Date();
    var next = null;
    for (var i = 0; i < SCHEDULE.length; i++) {
      if (SCHEDULE[i] > now) { next = SCHEDULE[i]; break; }
    }
    if (!next) {
      countdown.textContent = '更新は終了しました';
      return false;
    }
    var s = Math.floor((next - now) / 1000);
    var jst = new Date(next.getTime() + 9 * HOUR);
    countdown.textContent = '次のレポート予定（' + (jst.getUTCMonth() + 1) + '/' + jst.getUTCDate() + ' ' +
      pad(jst.getUTCHours()) + ':00）まで ' + Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
    return true;
  }
  if (countdown) {
    countdown.hidden = false;
    if (tick()) {
      var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000);
    }
  }

  // ---- 10. 終了のお知らせ ----
  var endNotice = document.getElementById('end-notice');
  if (endNotice && new Date() >= END) endNotice.hidden = false;

  // ---- 2. NEW バッジ（3時間以内のレポート） ----
  var now = Date.now();
  Array.prototype.forEach.call(document.querySelectorAll('.post-item'), function (item) {
    var time = item.querySelector('time');
    var badge = item.querySelector('.new-badge');
    if (!time || !badge) return;
    var t = new Date(time.getAttribute('datetime')).getTime();
    if (now - t < 3 * HOUR && t - now < 0.5 * HOUR) badge.hidden = false;
  });

  // ---- 5・7. テーマで絞り込み・キーワード検索 ----
  var list = document.getElementById('report-list');
  var filter = document.getElementById('topic-filter');
  var search = document.getElementById('report-search');
  var result = document.getElementById('filter-result');
  if (list && filter && search) {
    var items = Array.prototype.slice.call(list.querySelectorAll('.post-item'));
    var chips = Array.prototype.slice.call(filter.querySelectorAll('.chip'));
    var activeTopic = '';

    function topicsOf(item) { return (item.getAttribute('data-topics') || '').split(/\s+/); }

    // そのテーマのレポートが1件もないボタンは隠す
    chips.forEach(function (chip) {
      var key = chip.getAttribute('data-topic');
      if (key && !items.some(function (it) { return topicsOf(it).indexOf(key) !== -1; })) chip.hidden = true;
    });
    // 「すべて」しか残らないときは、絞り込み自体を出さない
    if (chips.every(function (c) { return c.hidden || !c.getAttribute('data-topic'); })) filter.hidden = true;

    function apply() {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var okTopic = !activeTopic || topicsOf(item).indexOf(activeTopic) !== -1;
        var okText = !q || (item.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1;
        item.hidden = !(okTopic && okText);
        if (!item.hidden) shown++;
      });
      if (!activeTopic && !q) { result.hidden = true; return; }
      result.hidden = false;
      result.textContent = shown ? shown + ' 件のレポート' : '該当するレポートはありません';
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeTopic = chip.getAttribute('data-topic');
        chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
        apply();
      });
    });
    search.addEventListener('input', apply);
  }

  // ---- 8. 読み上げ ----
  var speakButton = document.getElementById('speak-button');
  var body = document.getElementById('post-body');
  if (speakButton && body && 'speechSynthesis' in window) {
    var synth = window.speechSynthesis;
    var speaking = false, bgmWasOn = false;
    speakButton.hidden = false;

    function setLabel() { speakButton.textContent = speaking ? '■ 読み上げを止める' : '▶ 読み上げ'; }

    function finish() {
      speaking = false;
      setLabel();
      if (bgmWasOn && window.SiteBGM) { window.SiteBGM.start(); if (window.SiteBGM.onchange) window.SiteBGM.onchange(); }
    }

    // 長い文章は途中で止まることがあるので、文ごとに分けて順番に読む
    function chunks(text) {
      var parts = text.replace(/https?:\/\/\S+/g, '').replace(/([。！？\n])/g, '$1\u0001').split('\u0001');
      var out = [], buf = '';
      parts.forEach(function (p) {
        if ((buf + p).length > 120 && buf) { out.push(buf); buf = ''; }
        buf += p;
      });
      if (buf.trim()) out.push(buf);
      return out.filter(function (s) { return s.trim(); });
    }

    speakButton.addEventListener('click', function () {
      if (speaking) { synth.cancel(); finish(); return; }
      var title = document.querySelector('.post-header h1');
      var texts = chunks((title ? title.textContent + '。\n' : '') + body.innerText);
      var voice = synth.getVoices().filter(function (v) { return /^ja/i.test(v.lang); })[0];
      bgmWasOn = !!(window.SiteBGM && window.SiteBGM.isPlaying());
      if (bgmWasOn) { window.SiteBGM.stop(); if (window.SiteBGM.onchange) window.SiteBGM.onchange(); }
      synth.cancel();
      texts.forEach(function (t, i) {
        var u = new SpeechSynthesisUtterance(t);
        u.lang = 'ja-JP';
        if (voice) u.voice = voice;
        if (i === texts.length - 1) u.onend = function () { if (speaking) finish(); };
        synth.speak(u);
      });
      speaking = true;
      setLabel();
    });
    window.addEventListener('pagehide', function () { synth.cancel(); });
  }
})();
