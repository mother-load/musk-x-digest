// bgm.js — 音声ファイルを使わず、ブラウザの音の機能（Web Audio API）でその場で BGM を作って鳴らす
// 曲：テンポ124のシンセウェーブ風ループ（Am → F → C → G）
//   キック・クラップ・ハイハット、うねるベース、きらきらしたアルペジオ（こだま付き）、厚みのあるパッド
(function () {
  var BPM = 124;
  var S16 = 60 / BPM / 4; // 16分音符1つの長さ（秒）
  var VOLUME = 0.5;       // 全体の音量

  // 1小節ごとのコード（数字は音の高さ。60 = 真ん中のド）
  var BASS = [33, 29, 36, 31];        // ベースの根音：A F C G
  var PAD = [                         // パッドの和音
    [57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]
  ];
  var LEAD = [                        // アルペジオに使う音
    [69, 72, 76, 81], [65, 69, 72, 77], [67, 72, 76, 79], [67, 71, 74, 79]
  ];
  var ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];
  var BASS_OCT = [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 12, 0]; // ベースのオクターブ跳躍

  var ctx = null, master, duck, delayIn, noise, timer = null, nextTime = 0, step = 0, playing = false;

  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function envGain(t, peak, attack, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  function osc(type, n, t, dur, detune) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq(n);
    if (detune) o.detune.value = detune;
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  // ---- ドラム ----
  function kick(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.4);
    // キックに合わせてベースとパッドを一瞬小さくし、「ズン、ズン」と脈打つ感じを出す
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.3, t);
    duck.gain.linearRampToValueAtTime(1, t + 0.2);
  }

  function noiseHit(t, type, cutoff, peak, dur) {
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    src.buffer = noise;
    f.type = type;
    f.frequency.value = cutoff;
    var g = envGain(t, peak, 0.002, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // ---- 楽器 ----
  function bass(n, t) {
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 8;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(180, t + S16 * 0.9);
    var g = envGain(t, 0.22, 0.005, S16 * 0.95);
    osc('sawtooth', n, t, S16).connect(f);
    f.connect(g); g.connect(duck);
  }

  function pad(notes, t, dur) {
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1600;
    var g = envGain(t, 0.035, 0.4, dur);
    notes.forEach(function (n) {
      osc('sawtooth', n, t, dur, -8).connect(f);
      osc('sawtooth', n, t, dur, 8).connect(f);
    });
    f.connect(g); g.connect(duck);
  }

  function lead(n, t, bright) {
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = bright;
    var g = envGain(t, 0.06, 0.004, S16 * 1.6);
    osc('square', n, t, S16 * 1.6).connect(f);
    f.connect(g); g.connect(master); g.connect(delayIn);
  }

  // ---- 1拍（16分音符）ごとの処理 ----
  function playStep(s, t) {
    var intro = s < 32;                 // 最初の2小節は助走（キックなし）
    var loopStep = intro ? s : s - 32;
    var bar = Math.floor(loopStep / 16) % 4;
    var section = Math.floor(loopStep / 64) % 2; // 4小節ごとに前半・後半を切り替える
    var pos = s % 16;

    if (pos === 0) pad(PAD[bar], t, S16 * 16);

    if (!intro) {
      if (pos % 4 === 0) kick(t);
      if (pos === 4 || pos === 12) noiseHit(t, 'bandpass', 1800, 0.35, 0.18); // クラップ
      bass(BASS[bar] + BASS_OCT[pos], t);
    }
    // ハイハット：裏拍は強め、16分は弱め
    if (pos % 4 === 2) noiseHit(t, 'highpass', 7000, 0.12, 0.09);
    else if (!intro) noiseHit(t, 'highpass', 9000, 0.04, 0.03);

    // アルペジオ：助走中は8分、後半は1オクターブ上で明るく
    if (intro && pos % 2 === 1) return;
    var n = LEAD[bar][ARP_ORDER[pos]] + (section === 1 ? 12 : 0);
    var bright = intro ? 900 + s * 60 : (section === 1 ? 5000 : 2600);
    lead(n, t, bright);
  }

  // 少し先までの音を予約しておく（音が途切れないようにするため）
  function schedule() {
    while (nextTime < ctx.currentTime + 0.2) {
      playStep(step, nextTime);
      nextTime += S16;
      step++;
    }
  }

  function setup() {
    var comp = ctx.createDynamicsCompressor(); // 音量の暴れを抑えて、音圧をそろえる
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.connect(comp);

    duck = ctx.createGain();
    duck.connect(master);

    // こだま（ディレイ）：付点8分音符ぶん遅れて音が返ってくる
    delayIn = ctx.createGain();
    delayIn.gain.value = 0.35;
    var delay = ctx.createDelay(1);
    delay.delayTime.value = S16 * 3;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    delayIn.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(master);

    // ドラム用のノイズ（ザーッという音）を1秒分作っておく
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noise.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function start() {
    if (playing) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) { ctx = new AC(); setup(); }
    ctx.resume();
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(VOLUME, now + 0.8);
    nextTime = now + 0.1;
    step = 0;
    timer = setInterval(schedule, 25);
    playing = true;
  }

  function stop() {
    if (!playing) return;
    clearInterval(timer);
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.4);
    playing = false;
  }

  window.SiteBGM = { start: start, stop: stop, isPlaying: function () { return playing; } };
})();
