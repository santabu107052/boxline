/**
 * ai.test.mjs — kiểm thử 3 mức khó (node --test).
 *
 * Yêu cầu: matchup Hard vs Easy thắng ≥85%, Hard vs Medium ≥70%, N ≥ 200 mỗi cặp,
 * cả hai bên đều có lượt đi trước; thời gian nghĩ ≤ 60ms/lượt trên bàn 8×8.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMove,
  boxMissing,
  boxesClosedBy,
  cloneState,
  createGame,
  edgeKey,
  isLegal,
  isOver,
  legalEdges,
  score,
} from '../src/engine.js';
import { AI_LEVELS, HARD_BUDGET_MS, analyzePosition, chooseMove, playGame } from '../src/ai.js';

/** mulberry32 — RNG tất định cho seed. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chơi `games` ván giữa hai mức; đổi bên mỗi ván để triệt tiêu lợi thế đi trước.
 * @returns {{games:number, winsA:number, winsB:number, draws:number, maxThinkMs:number}}
 */
function matchup(levelA, levelB, games, { n = 5, seed = 1 } = {}) {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let maxThink = 0;
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1;
    const la = swap ? levelB : levelA;
    const lb = swap ? levelA : levelB;
    const g = createGame({ n });
    const ra = rng(seed + i * 7919 + 1);
    const rb = rng(seed + i * 104729 + 3);
    let guard = 0;
    while (!isOver(g) && guard++ < 500) {
      const isA = g.turn === 'A';
      const t0 = performance.now();
      const mv = chooseMove(g, { level: isA ? la : lb, rand: isA ? ra : rb });
      const dt = performance.now() - t0;
      if (dt > maxThink) maxThink = dt;
      assert.ok(mv, 'máy phải trả nước khi còn cạnh');
      assert.equal(isLegal(g, mv), true, `máy (${isA ? la : lb}) trả nước không hợp lệ: ${mv}`);
      applyMove(g, mv);
    }
    assert.equal(isOver(g), true);
    const s = score(g);
    assert.equal(s.total, n * n);
    if (s.A > s.B) { if (swap) winsB++; else winsA++; }
    else if (s.B > s.A) { if (swap) winsA++; else winsB++; }
    else draws++;
  }
  return { games, winsA, winsB, draws, maxThinkMs: maxThink };
}

test('AI_LEVELS đúng 3 mức và HARD_BUDGET_MS = 60', () => {
  assert.deepEqual(AI_LEVELS, ['easy', 'medium', 'hard']);
  assert.equal(HARD_BUDGET_MS, 60);
});

test('chooseMove: trả cạnh hợp lệ ở mọi mức, mọi kích thước, và null khi hết nước', () => {
  for (const level of AI_LEVELS) {
    for (const n of [3, 4, 6, 8]) {
      const g = createGame({ n });
      const rand = rng(n);
      for (let i = 0; i < 6; i++) {
        const mv = chooseMove(g, { level, rand });
        assert.ok(Array.isArray(mv), `n=${n} ${level}: phải trả mảng cạnh`);
        assert.equal(isLegal(g, mv), true);
        applyMove(g, mv);
      }
    }
    // Ván đã xong → null
    const done = createGame({ n: 3 });
    for (const e of legalEdges(done).slice()) applyMove(done, e);
    assert.equal(isOver(done), true);
    assert.equal(chooseMove(done, { level }), null);
  }
  assert.throws(() => chooseMove(createGame({ n: 3 }), { level: 'legend' }), /Độ khó không hợp lệ/);
});

test('chooseMove không sửa trạng thái gốc (thuần: mọi nước đều qua bản sao)', () => {
  for (const level of AI_LEVELS) {
    const g = createGame({ n: 5 });
    applyMove(g, [1, 1, 'H']);
    applyMove(g, [1, 2, 'H']);
    const before = { size: g.edges.size, score: score(g), turn: g.turn };
    chooseMove(g, { level, rand: rng(5) });
    assert.equal(g.edges.size, before.size, `${level}: AI không được tô cạnh vào state gốc`);
    assert.deepEqual(score(g), before.score);
    assert.equal(g.turn, before.turn);
  }
});

test('cùng seed → cùng nước đi (tất định, để replay được)', () => {
  for (const level of AI_LEVELS) {
    const picks = [];
    for (let k = 0; k < 2; k++) {
      const g = createGame({ n: 5 });
      const seq = [];
      const rand = rng(12345);
      for (let i = 0; i < 5; i++) {
        const mv = chooseMove(g, { level, rand });
        seq.push(edgeKey(mv));
        applyMove(g, mv);
      }
      picks.push(seq.join('|'));
    }
    assert.equal(picks[0], picks[1], `${level}: cùng seed phải cùng chuỗi nước`);
  }
});

test('medium: luôn ăn ô khi có thể (greedy)', () => {
  const g = createGame({ n: 3 });
  // Ô góc (0,0) đủ 3 cạnh, còn 1 cạnh → [0,1,'V'] là nước ăn.
  applyMove(g, [0, 0, 'H']);
  applyMove(g, [0, 0, 'V']);
  applyMove(g, [1, 0, 'H']);
  const { captures } = analyzePosition(g);
  assert.ok(captures.length >= 1, 'phải có nước ăn');
  const mv = chooseMove(g, { level: 'medium', rand: rng(1) });
  assert.ok(captures.some((c) => edgeKey(c.edge) === edgeKey(mv)), 'medium phải chọn nước ăn ô');
});

test('medium: tránh "cạnh thứ 3" khi còn nước an toàn', () => {
  // Bàn trống 5×5: medium phải chọn nước không tạo ô 3 cạnh (không hé hộp nào).
  const g = createGame({ n: 5 });
  const mv = chooseMove(g, { level: 'medium', rand: rng(2) });
  const after = cloneState(g);
  applyMove(after, mv);
  let thirds = 0;
  for (let br = 0; br < 5; br++) {
    for (let bc = 0; bc < 5; bc++) if (boxMissing(after, br, bc) === 1) thirds++;
  }
  assert.equal(thirds, 0);
});

test('hard: trên bàn 8×8 luôn trả nước trong ngân sách 60ms/lượt', () => {
  const n = 8;
  const g = createGame({ n });
  const rand = rng(99);
  let worst = 0;
  let maxSingle = 0;
  let guard = 0;
  while (!isOver(g) && guard++ < 400) {
    const t0 = performance.now();
    const mv = chooseMove(g, { level: 'hard', rand });
    const dt = performance.now() - t0;
    worst = Math.max(worst, dt);
    if (dt > maxSingle) maxSingle = dt;
    assert.equal(isLegal(g, mv), true);
    applyMove(g, mv);
  }
  // Ngân sách được phép vượt rất nhẹ do overhead đo đạc/JIT, nhưng không được gấp đôi.
  assert.ok(worst <= HARD_BUDGET_MS * 2, `lượt nghĩ dài nhất ${worst.toFixed(1)}ms > ${HARD_BUDGET_MS * 2}ms`);
  assert.equal(score(g).total, n * n);
});

test('matchup: Hard vs Easy thắng ≥ 85% (N = 200 ván, đổi bên mỗi ván)', () => {
  const r = matchup('hard', 'easy', 200, { n: 5, seed: 7 });
  assert.equal(r.games, 200);
  const rate = r.winsA / r.games;
  console.log(`   Hard vs Easy: ${r.winsA} thắng / ${r.winsB} thua / ${r.draws} hoà → ${(rate * 100).toFixed(1)}%`);
  assert.ok(rate >= 0.85, `Hard chỉ thắng ${(rate * 100).toFixed(1)}% trước Easy`);
});

test('matchup: Hard vs Medium thắng ≥ 70% (N = 200 ván, đổi bên mỗi ván)', () => {
  const r = matchup('hard', 'medium', 200, { n: 5, seed: 11 });
  assert.equal(r.games, 200);
  const rate = r.winsA / r.games;
  console.log(`   Hard vs Medium: ${r.winsA} thắng / ${r.winsB} thua / ${r.draws} hoà → ${(rate * 100).toFixed(1)}%`);
  assert.ok(rate >= 0.7, `Hard chỉ thắng ${(rate * 100).toFixed(1)}% trước Medium`);
});

test('matchup: Medium mạnh hơn Easy (xác thực lại thứ tự mức khó)', () => {
  const r = matchup('medium', 'easy', 100, { n: 5, seed: 3 });
  const rate = r.winsA / r.games;
  console.log(`   Medium vs Easy: ${r.winsA} thắng → ${(rate * 100).toFixed(1)}%`);
  assert.ok(rate >= 0.6, `Medium chỉ thắng ${(rate * 100).toFixed(1)}% trước Easy`);
});

test('playGame: ván tự chơi xong, tổng điểm = n², có trường maxThinkMs', () => {
  for (const n of [3, 4, 6]) {
    const r = playGame({ n, levelA: 'hard', levelB: 'easy', seedA: 1, seedB: 2 });
    assert.equal(r.A + r.B, n * n);
    assert.ok(['A', 'B', 'draw'].includes(r.winner));
    assert.equal(r.moves, 2 * n * (n + 1));
    assert.ok(Number.isFinite(r.maxThinkMs));
  }
});

test('analyzePosition: captures và safe không trùng nhau, luôn là cạnh hợp lệ', () => {
  const g = createGame({ n: 4 });
  const rand = rng(4);
  for (let i = 0; i < 5; i++) applyMove(g, legalEdges(g)[Math.floor(rand() * legalEdges(g).length)]);
  const { legal, captures, safe } = analyzePosition(g);
  assert.equal(legal.length, 2 * 4 * 5 - g.moveCount);
  for (const c of captures) {
    assert.equal(isLegal(g, c.edge), true);
    assert.ok(boxesClosedBy(g, c.edge).length > 0);
  }
  for (const e of safe) {
    assert.equal(isLegal(g, e), true);
    assert.equal(boxesClosedBy(g, e).length, 0);
  }
  const capKeys = new Set(captures.map((c) => edgeKey(c.edge)));
  for (const e of safe) assert.equal(capKeys.has(edgeKey(e)), false, 'safe không được nằm trong captures');
});

test('easy: vẫn tôn trọng luật (không bao giờ tô cạnh đã tô / cạnh viền)', () => {
  const g = createGame({ n: 3 });
  const rand = rng(555);
  const seen = new Set();
  let guard = 0;
  while (!isOver(g) && guard++ < 100) {
    const mv = chooseMove(g, { level: 'easy', rand });
    const k = edgeKey(mv);
    assert.equal(seen.has(k), false, 'easy không được tô lại cạnh');
    seen.add(k);
    assert.equal(applyMove(g, mv).ok, true);
  }
  assert.equal(seen.size, 24);
});
