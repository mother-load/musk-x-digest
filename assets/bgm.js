// bgm.js — BGM（フリー素材の曲）をつなぎ目なくくり返し再生する
// 曲：「Synthwave House Loop」Fupi 作（CC0）https://opengameart.org/content/synthwave-house-loop
(function () {
  var VOLUME = 0.5; // 全体の音量

  // ogg を鳴らせないブラウザ（古い iPhone など）では wav を使う
  var FILES = ['audio/synthwave-house-loop.ogg', 'audio/synthwave-house-loop.wav'];
  var base = document.currentScript.src; // このファイルの場所を基準に曲の場所を決める

  var ctx = null, gain = null, source = null, loading = null, playing = false;
  var api = { start: start, stop: stop, isPlaying: function () { return playing; }, onchange: null };

  function decode(data) {
    return new Promise(function (resolve, reject) { ctx.decodeAudioData(data, resolve, reject); });
  }

  function load(i) {
    return fetch(new URL(FILES[i], base))
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.arrayBuffer();
      })
      .then(decode)
      .catch(function (err) {
        if (i + 1 < FILES.length) return load(i + 1);
        throw err;
      });
  }

  function start() {
    if (playing) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      gain = ctx.createGain();
      gain.connect(ctx.destination);
    }
    ctx.resume(); // クリックなどの操作の直後に呼ぶ必要がある
    playing = true;
    if (!loading) loading = load(0);
    loading.then(function (buffer) {
      if (!playing || source) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      var now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(VOLUME, now + 0.8); // ふわっと始める
      source.start(now);
    }).catch(function () {
      // 曲を読み込めなかったときは、オフに戻す
      loading = null;
      playing = false;
      if (api.onchange) api.onchange();
    });
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (!source) return;
    var s = source, now = ctx.currentTime;
    source = null;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    s.stop(now + 0.45);
  }

  window.SiteBGM = api;
})();
