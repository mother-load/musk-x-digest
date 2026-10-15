// site.js — 年齢確認と BGM ボタンの動き
(function () {
  // 「いいえ」を選んだときの行き先（日本語版 Wikipedia のイーロン・マスクの記事）
  var NO_URL = 'https://ja.wikipedia.org/wiki/%E3%82%A4%E3%83%BC%E3%83%AD%E3%83%B3%E3%83%BB%E3%83%9E%E3%82%B9%E3%82%AF';

  // ブラウザに記録する（記録できない環境でもエラーにしない）
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  var root = document.documentElement;
  var bgmButton = document.getElementById('bgm-toggle');

  function updateButton() {
    var on = window.SiteBGM.isPlaying();
    bgmButton.textContent = 'BGM：' + (on ? 'オン' : 'オフ');
    bgmButton.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  window.SiteBGM.onchange = updateButton; // 曲を読み込めなかったときにボタンの表示を戻す

  function startBgm() { window.SiteBGM.start(); save('bgm', 'on'); updateButton(); }
  function stopBgm() { window.SiteBGM.stop(); save('bgm', 'off'); updateButton(); }

  bgmButton.addEventListener('click', function () {
    if (window.SiteBGM.isPlaying()) stopBgm(); else startBgm();
  });

  // ブラウザの決まりで、音はページを触るまで鳴らせない。
  // BGM をオンにしていた人は、ページのどこかを最初に触ったときに再開する
  function resumeOnFirstTouch(e) {
    document.removeEventListener('pointerdown', resumeOnFirstTouch);
    document.removeEventListener('keydown', resumeOnFirstTouch);
    if (bgmButton.contains(e.target)) return; // ボタン自体はクリックの処理に任せる
    if (load('bgm') === 'on') startBgm();
  }

  // ---- 年齢確認 ----
  if (root.classList.contains('age-pending')) {
    document.getElementById('age-yes').addEventListener('click', function () {
      save('ageConfirmed', 'yes');
      root.classList.remove('age-pending');
      startBgm(); // 「はい」のクリックをきっかけに BGM を流す
    });
    document.getElementById('age-no').addEventListener('click', function () {
      window.location.replace(NO_URL);
    });
    document.getElementById('age-yes').focus();
  } else if (load('bgm') === 'on') {
    document.addEventListener('pointerdown', resumeOnFirstTouch);
    document.addEventListener('keydown', resumeOnFirstTouch);
  }
})();
