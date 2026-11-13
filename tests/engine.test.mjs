/**
 * engine.test.mjs — kiểm thử luật chơi (node --test, không thư viện ngoài).
 *
 * Quy ước quan trọng của luật (docs/00-BRIEF.md §4): viền ngoài đã tô sẵn nên ô ở GÓC
 * chỉ cần 2 cạnh trong là kín, ô ở MÉP cần 3, ô ở GIỮA cần 4.
 *
 * Bất biến được kiểm: tổng điểm = n², idempotent applyMove, viền ngoài không bao giờ hợp lệ,
 * undo/passTurn, serialize/restore, đếm cạnh đúng, và mô phỏng ngẫu nhiên bất biến.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYERS,
  allInteriorEdges,
  applyMove,
  boxEdges,
  boxMissing,
  boxState,
  boxesClosedBy,
  cloneState,
  createGame,
  createsThirdEdge,
  edgeKey,
  getWinner,
  isInteriorEdge,
  isLegal,
  isOnBoard,
  isOver,
  legalEdges,
  passTurn,
  remainingCount,
  restoreGame,
  score,
  serializeGame,
  simulate,
  statesEqual,
  thirdEdgeBoxes,
  totalInteriorEdges,
  undoMove,
} from '../src/engine.js';

const SIZES = [3, 4, 5, 6, 7, 8];

/** RNG tất định (mulberry32) để test không phụ thuộc Math.random. */
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

function borderEdges(n) {
  const out = [];
  for (let c = 0; c < n; c++) out.push([0, c, 'H'], [n, c, 'H']);
  for (let r = 0; r < n; r++) out.push([r, 0, 'V'], [r, n, 'V']);
  return out;
}

/** Các cạnh TRONG của một ô (đúng phần phải tô để kín ô đó). */
const interiorOf = (br, bc, n) => boxEdges(br, bc).filter((e) => isInteriorEdge(e, n));

/** Tô danh sách cạnh cho trước, trả state đã đi. */
function applyAll(state, edges) {
  for (const e of edges) {
    const r = applyMove(state, e);
    assert.equal(r.ok, true, `phải tô được ${JSON.stringify(e)}: ${r.reason}`);
  }
  return state;
}

/** Điền cả ván theo thứ tự ngẫu nhiên (mỗi nước = 1 cạnh mới). */
function playOut(n, seed) {
  const g = createGame({ n });
  const rand = rng(seed);
  while (!isOver(g)) {
    const legal = legalEdges(g);
    applyMove(g, legal[Math.floor(rand() * legal.length)]);
  }
  return g;
}

test('số cạnh trong = 2n(n-1), viền ngoài = 4n, tổng = 2n(n+1)', () => {
  for (const n of SIZES) {
    assert.equal(totalInteriorEdges(n), 2 * n * (n - 1));
    assert.equal(allInteriorEdges(n).length, 2 * n * (n - 1));
    assert.equal(borderEdges(n).length, 4 * n);
    assert.equal(totalInteriorEdges(n) + 4 * n, 2 * n * (n + 1));
  }
  // Bàn 3×3: 12 cạnh trong (ví dụ được dùng trong docs/30-TUTORIAL.md §7).
  assert.equal(allInteriorEdges(3).length, 12);
});

test('createGame: bàn trống, điểm 0-0, lượt A đi trước (hoặc B nếu yêu cầu)', () => {
  const g = createGame({ n: 5 });
  assert.deepEqual(score(g), { A: 0, B: 0, total: 0 });
  assert.equal(g.turn, 'A');
  assert.equal(legalEdges(g).length, 40);
  assert.equal(isOver(g), false);
  assert.equal(createGame({ n: 4, first: 'B' }).turn, 'B');
  assert.throws(() => createGame({ n: 1 }), /Kích thước bàn không hợp lệ/);
  assert.throws(() => createGame({ n: 3.5 }), /Kích thước bàn không hợp lệ/);
});

test('mọi cạnh hợp lệ đều là cạnh trong, chưa tô, không trùng', () => {
  for (const n of SIZES) {
    const g = createGame({ n });
    const keys = new Set();
    for (const e of legalEdges(g)) {
      assert.equal(isInteriorEdge(e, n), true, `cạnh ${e} phải là cạnh trong`);
      assert.equal(isOnBoard(e, n), true);
      const k = edgeKey(e);
      assert.equal(keys.has(k), false, `cạnh ${e} bị lặp`);
      keys.add(k);
    }
    assert.equal(keys.size, 2 * n * (n - 1));
  }
});

test('viền ngoài KHÔNG BAO GIỜ hợp lệ: không legal, không apply được, không tính điểm', () => {
  for (const n of SIZES) {
    const g = createGame({ n });
    for (const e of borderEdges(n)) {
      assert.equal(isInteriorEdge(e, n), false, `viền ${e} không phải cạnh trong`);
      assert.equal(isLegal(g, e), false);
      const before = score(g);
      const res = applyMove(g, e);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'border');
      assert.deepEqual(score(g), before);
    }
    assert.equal(g.moveCount, 0);
    assert.equal(g.turn, 'A');
    assert.equal(g.edges.size, 0);
  }
});

test('cạnh sai kiểu / ngoài bàn bị từ chối', () => {
  const g = createGame({ n: 3 });
  for (const bad of [null, undefined, [], [1, 1], [1, 1, 'X'], ['a', 1, 'H'], [9, 9, 'H'], [1.5, 1, 'H']]) {
    assert.equal(isLegal(g, bad), false, `phải từ chối ${JSON.stringify(bad)}`);
    assert.equal(applyMove(g, bad).ok, false);
  }
  assert.equal(isOnBoard([1, 3, 'H'], 3), false); // cạnh ngang cột 3 ngoài bàn 3×3
  assert.equal(isOnBoard([1, 2, 'H'], 3), true);
  assert.equal(isOnBoard([0, 3, 'V'], 3), true); // viền phải vẫn "trên bàn" nhưng không phải cạnh trong
  assert.equal(isInteriorEdge([0, 3, 'V'], 3), false);
});

test('applyMove idempotent: tô lại cùng cạnh không đổi điểm/lượt/moveCount', () => {
  for (const n of SIZES) {
    const g = createGame({ n });
    const rand = rng(n * 977);
    for (let i = 0; i < 5; i++) {
      const legal = legalEdges(g);
      const e = legal[Math.floor(rand() * legal.length)];
      assert.equal(applyMove(g, e).ok, true);
      const snap = { score: score(g), turn: g.turn, moves: g.moveCount, seq: g.turnSeq };
      const again = applyMove(g, [e[0], e[1], e[2]]);
      assert.equal(again.ok, false);
      assert.equal(again.reason, 'taken');
      assert.deepEqual(score(g), snap.score);
      assert.equal(g.turn, snap.turn);
      assert.equal(g.moveCount, snap.moves);
      assert.equal(g.turnSeq, snap.seq);
    }
  }
});

test('ô ở GÓC kín bằng 2 cạnh trong (viền tính sẵn): người tô cạnh cuối được ô và giữ lượt', () => {
  const n = 3;
  const g = createGame({ n });
  const need = interiorOf(0, 0, n); // [[1,0,'H'], [0,1,'V']]
  assert.equal(need.length, 2, 'ô góc chỉ có 2 cạnh trong');
  assert.equal(boxMissing(g, 0, 0), 2);
  // Cạnh thứ nhất chưa kín ô → mất lượt.
  const r1 = applyMove(g, need[0]);
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.closed, []);
  assert.equal(r1.keepsTurn, false);
  assert.equal(g.turn, 'B');
  assert.equal(boxMissing(g, 0, 0), 1, 'còn đúng 1 cạnh là kín');
  // Cạnh thứ hai (cạnh cuối) kín ô → B được ô và GIỮ lượt.
  const r2 = applyMove(g, need[1]);
  assert.equal(r2.ok, true);
  assert.equal(r2.player, 'B');
  assert.deepEqual(r2.closed, [[0, 0]]);
  assert.equal(r2.keepsTurn, true);
  assert.equal(g.turn, 'B', 'kín ô thì người vừa đi GIỮ lượt');
  assert.equal(g.boxes[0], 'B');
  assert.deepEqual(score(g), { A: 0, B: 1, total: 1 });
  assert.equal(getWinner(g), null);
});

test('ô ở MÉP cần 3 cạnh trong, ô ở GIỮA cần 4 cạnh', () => {
  assert.equal(interiorOf(1, 0, 3).length, 3);
  assert.equal(interiorOf(1, 1, 3).length, 4);
  assert.equal(interiorOf(2, 2, 5).length, 4);
  const g = createGame({ n: 5 });
  const mid = interiorOf(2, 2, 5);
  applyAll(g, mid.slice(0, 3));
  assert.equal(boxMissing(g, 2, 2), 1);
  assert.equal(g.boxes[2 * 5 + 2], null, 'ô chưa đủ 4 cạnh không có chủ');
  applyMove(g, mid[3]);
  assert.equal(boxMissing(g, 2, 2), 0);
  assert.ok(PLAYERS.includes(g.boxes[2 * 5 + 2]));
});

test('một cạnh kín 2 ô cùng lúc: +2 điểm cho người đi, vẫn giữ lượt', () => {
  const n = 5;
  const mid = interiorOf(2, 2, n);
  const right = interiorOf(2, 3, n);
  const shared = [2, 3, 'V']; // cạnh chung của hai ô giữa
  const g = createGame({ n });
  const prep = [...mid, ...right].filter((e) => edgeKey(e) !== edgeKey(shared));
  applyAll(g, prep);
  assert.equal(boxMissing(g, 2, 2), 1);
  assert.equal(boxMissing(g, 2, 3), 1);
  const who = g.turn;
  const res = applyMove(g, shared);
  assert.equal(res.ok, true);
  assert.equal(res.closed.length, 2);
  assert.equal(res.keepsTurn, true);
  const s = score(g);
  assert.equal(who === 'A' ? s.A : s.B, 2);
  assert.equal(s.total, 2);
});

test('mô phỏng ngẫu nhiên: tổng điểm = n², không cạnh tô 2 lần, ván kết thúc đúng', () => {
  for (const n of SIZES) {
    for (let g0 = 0; g0 < 3; g0++) {
      const g = createGame({ n });
      const rand = rng(n * 1000 + g0 * 37 + 1);
      const seen = new Set();
      let guard = 0;
      while (!isOver(g) && guard++ < 500) {
        const legal = legalEdges(g);
        assert.ok(legal.length > 0, 'ván chưa xong thì phải còn cạnh');
        const e = legal[Math.floor(rand() * legal.length)];
        const k = edgeKey(e);
        assert.equal(seen.has(k), false, `cạnh ${k} bị tô 2 lần`);
        seen.add(k);
        const r = applyMove(g, e);
        assert.equal(r.ok, true);
        const s = score(g);
        assert.equal(s.total, s.A + s.B);
        assert.ok(s.A + s.B <= n * n);
      }
      assert.equal(isOver(g), true);
      assert.equal(score(g).total, n * n);
      assert.equal(g.edges.size, 2 * n * (n - 1));
      assert.equal(legalEdges(g).length, 0);
      assert.equal(remainingCount(g), 0);
      assert.ok(['A', 'B', 'draw'].includes(getWinner(g)));
      assert.equal(g.moveCount, 2 * n * (n - 1));
    }
  }
});

test('hết ván: không tô thêm, không pass lượt, reason đúng', () => {
  const g = playOut(3, 11);
  assert.equal(isOver(g), true);
  const r = applyMove(g, allInteriorEdges(3)[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'taken');
  assert.equal(passTurn(g).ok, false);

  const g2 = createGame({ n: 3 });
  applyAll(g2, allInteriorEdges(3).slice(0, 11));
  assert.equal(remainingCount(g2), 1);
  const last = legalEdges(g2)[0];
  const res = applyMove(g2, last);
  assert.equal(res.gameOver, true);
  assert.notEqual(res.winner, null);
});

test('getWinner: đúng theo điểm, null khi ván chưa xong', () => {
  for (const n of [3, 4, 6]) {
    const g = playOut(n, n * 13 + 5);
    const s = score(g);
    assert.equal(getWinner(g), s.A > s.B ? 'A' : s.B > s.A ? 'B' : 'draw');
  }
  assert.equal(getWinner(createGame({ n: 4 })), null);
});

test('boxState/boxMissing/boxesClosedBy nhất quán với bảng cạnh', () => {
  for (const n of SIZES) {
    const g = createGame({ n });
    const rand = rng(n + 77);
    for (let i = 0; i < 8; i++) {
      const legal = legalEdges(g);
      if (!legal.length) break;
      applyMove(g, legal[Math.floor(rand() * legal.length)]);
    }
    for (let br = 0; br < n; br++) {
      for (let bc = 0; bc < n; bc++) {
        const st = boxState(g, br, bc);
        assert.equal(st.count, 4 - boxMissing(g, br, bc));
        assert.equal(st.vs, interiorOf(br, bc, n).length ? 4 - interiorOf(br, bc, n).length : 4);
        if (st.count === 4) assert.ok(PLAYERS.includes(st.owner), 'ô kín phải có chủ');
        else assert.equal(g.boxes[br * n + bc], null, 'ô chưa kín không có chủ');
      }
    }
    for (const e of legalEdges(g)) {
      for (const [br, bc] of boxesClosedBy(g, e)) {
        assert.equal(boxMissing(g, br, bc), 1);
      }
    }
  }
});

test('createsThirdEdge + thirdEdgeBoxes khớp quét tay', () => {
  const n = 3;
  // Ô giữa (1,1) có 4 cạnh: tô 2 cạnh → 2 cạnh còn lại là "cạnh thứ 3" (hộp hé nắp).
  const g = createGame({ n });
  const mid = interiorOf(1, 1, n);
  applyMove(g, mid[0]);
  applyMove(g, mid[1]);
  assert.equal(boxMissing(g, 1, 1), 2, 'ô giữa cần 4 cạnh → còn thiếu 2');
  assert.equal(createsThirdEdge(g, mid[2]), true);
  assert.equal(createsThirdEdge(g, mid[3]), true);
  // Tô cạnh thứ 3 của ô giữa → ô đó thành "ô 3 cạnh" (hé nắp hộp).
  applyMove(g, mid[2]);
  assert.equal(boxMissing(g, 1, 1), 1);
  const third = thirdEdgeBoxes(g);
  const midBox = third.find((b) => b.br === 1 && b.bc === 1);
  assert.ok(midBox, 'ô giữa (1,1) phải nằm trong thirdEdgeBoxes');
  assert.equal(isLegal(g, midBox.edge), true);
  assert.equal(boxMissing(g, midBox.br, midBox.bc), 1);
  // Ô góc mới có 1 cạnh trong → tô cạnh còn lại là KÍN ô, không phải "hé".
  const g2 = createGame({ n });
  applyMove(g2, [1, 0, 'H']);
  assert.equal(boxMissing(g2, 0, 0), 1);
  assert.equal(createsThirdEdge(g2, [0, 1, 'V']), false);
  // Cạnh đã tô / cạnh viền thì không bao giờ "tạo cạnh thứ 3".
  assert.equal(createsThirdEdge(g2, [1, 0, 'H']), false);
  assert.equal(createsThirdEdge(g2, [0, 0, 'H']), false);
});

test('passTurn: đổi lượt, tăng turnSeq, đếm passedTurns, không đổi điểm', () => {
  const g = createGame({ n: 4 });
  applyMove(g, [1, 0, 'H']);
  const before = { turn: g.turn, seq: g.turnSeq, score: score(g) };
  const r = passTurn(g);
  assert.equal(r.ok, true);
  assert.equal(g.turn, before.turn === 'A' ? 'B' : 'A');
  assert.equal(g.turnSeq, before.seq + 1);
  assert.equal(g.passedTurns, 1);
  assert.deepEqual(score(g), before.score);
  passTurn(g);
  assert.equal(g.turn, before.turn);
  assert.equal(g.passedTurns, 2);
});

test('undoMove: trả cạnh, trả ô và trả lượt; hết lịch sử thì báo lỗi', () => {
  const g = createGame({ n: 3 });
  applyMove(g, [2, 1, 'H']); // nước "làm nền", không kín ô
  applyMove(g, [1, 0, 'H']); // ô góc (0,0) còn 1 cạnh
  const r = applyMove(g, [0, 1, 'V']); // kín ô góc (0,0)
  assert.deepEqual(r.closed, [[0, 0]]);
  assert.equal(undoMove(g).ok, true);
  assert.equal(g.edges.size, 2);
  assert.equal(g.boxes[0], null);
  assert.deepEqual(score(g), { A: 0, B: 0, total: 0 });
  assert.equal(g.turn, 'A', 'người vừa đi (A) lấy lại lượt');
  // Hệ thống chỉ ghi nhớ NƯỚC CUỐI (lastMove) → hoàn tác lần 2 báo "empty".
  assert.equal(undoMove(g).ok, false);
});

test('serialize/restore: giữ cạnh, điểm, lượt; chơi tiếp cho cùng kết quả', () => {
  for (const n of [3, 5, 8]) {
    const g = createGame({ n });
    const rand = rng(n * 31 + 7);
    for (let i = 0; i < Math.min(9, 2 * n * (n - 1) - 1); i++) {
      const legal = legalEdges(g);
      applyMove(g, legal[Math.floor(rand() * legal.length)]);
    }
    const back = restoreGame(JSON.parse(JSON.stringify(serializeGame(g))));
    assert.deepEqual(score(back), score(g), `n=${n}: khôi phục phải giữ điểm số`);
    assert.equal(back.turn, g.turn);
    assert.equal(back.n, n);
    assert.equal(back.edges.size, g.edges.size);
    const rand2 = rng(999);
    const a = cloneState(g);
    const b = cloneState(back);
    while (!isOver(a)) {
      const legal = legalEdges(a);
      const e = legal[Math.floor(rand2() * legal.length)];
      const ra = applyMove(a, e);
      const rb = applyMove(b, e);
      assert.deepEqual(rb.closed, ra.closed);
      assert.equal(rb.player, ra.player);
    }
    assert.deepEqual(score(a), score(b));
    assert.equal(score(a).total, n * n);
  }
});

test('simulate không sửa state gốc; cloneState tạo bản độc lập', () => {
  const g = createGame({ n: 4 });
  applyMove(g, [1, 1, 'H']);
  const snapshot = serializeGame(g);
  const { state: next, res } = simulate(g, [1, 2, 'H']);
  assert.equal(res.ok, true);
  assert.equal(next.edges.size, g.edges.size + 1);
  assert.deepEqual(serializeGame(g), snapshot);
  const c = cloneState(g);
  applyMove(c, [2, 2, 'V']);
  assert.notEqual(c.edges.size, g.edges.size);
  assert.equal(statesEqual(c, g), false);
  assert.equal(statesEqual(g, cloneState(g)), true);
});

test('hai đường đi khác thứ tự tới cùng tập cạnh → cùng điểm (đối xứng)', () => {
  const n = 4;
  const order = allInteriorEdges(n).slice(0, 8);
  const g1 = createGame({ n });
  applyAll(g1, order);
  const g2 = createGame({ n });
  applyAll(g2, order.slice().reverse());
  assert.deepEqual(score(g1), score(g2));
  assert.equal(g1.edges.size, 8);
  assert.equal(g2.edges.size, 8);
});
