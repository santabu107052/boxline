/**
 * tutorial.test.mjs — kiểm thử nội dung + kịch bản tutorial (docs/30-TUTORIAL.md).
 *
 * Bất biến bắt buộc theo checklist §9 của tài liệu:
 *  (a) mọi cạnh trong allowedEdges/decoyEdges là cạnh TRONG và CHƯA TÔ ở trạng thái seedEdges;
 *  (b) bấm allowedEdges của bước 2 làm kín ĐÚNG 1 ô;
 *  (c) cạnh an toàn ở bước 4 không kín ô và không sinh thêm ô 3 cạnh;
 *  (d) máy ở bước 3 giữ bàn sạch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMove,
  boxMissing,
  boxState,
  boxesClosedBy,
  createGame,
  edgeKey,
  isInteriorEdge,
  isLegal,
  legalEdges,
  restoreGame,
  score,
  serializeGame,
  undoMove,
} from '../src/engine.js';
import {
  GLOSSARY,
  HINT_LINES,
  QUICK_GUIDE,
  RULES_MODAL,
  RULES_SHORT,
  TUTORIAL_LABELS,
  TUTORIAL_STEP5_DONE_HINT,
  TUTORIAL_STEPS,
  describeEdge,
  getStep,
  listHasEdge,
  pickHintLine,
  stepCount,
} from '../src/tutorial.js';

/** Dựng bàn tutorial từ seedEdges: tô lần lượt (người chơi A trước) rồi gán lại lượt = A. */
function boardFromSeed(step) {
  const g = createGame({ n: TUTORIAL_STEPS.boardSize });
  for (const e of step.seedEdges) {
    const r = applyMove(g, e);
    assert.equal(r.ok, true, `seed ${JSON.stringify(e)} phải tô được: ${r.reason}`);
  }
  // Kịch bản giả định NGƯỜI CHƠI đang đi ở đầu mỗi bước (docs/§3: "Người chơi đang giữ lượt").
  g.turn = 'A';
  return g;
}

function countThirds(g) {
  let k = 0;
  for (let br = 0; br < g.n; br++) {
    for (let bc = 0; bc < g.n; bc++) if (boxMissing(g, br, bc) === 1) k++;
  }
  return k;
}

test('TUTORIAL_STEPS: đúng 5 bước, bàn 3×3, đúng thứ tự id và khóa lưu', () => {
  assert.equal(TUTORIAL_STEPS.boardSize, 3);
  assert.equal(TUTORIAL_STEPS.player, 'player');
  assert.equal(TUTORIAL_STEPS.opponent, 'com');
  assert.equal(TUTORIAL_STEPS.storageKey, 'db_tutorial_done');
  assert.equal(TUTORIAL_STEPS.steps.length, 5);
  assert.equal(stepCount(), 5);
  assert.deepEqual(TUTORIAL_STEPS.steps.map((s) => s.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(TUTORIAL_STEPS.steps.map((s) => s.title), [
    'Bước 1/5', 'Bước 2/5', 'Bước 3/5', 'Bước 4/5', 'Bước 5/5',
  ]);
  assert.deepEqual(TUTORIAL_STEPS.steps.map((s) => s.advanceOn), [
    'randomEdgeChosen', 'boxCaptured', 'turnEnded', 'dangerousEdgeAvoided', 'optionsExplored',
  ]);
});

test('TUTORIAL_STEPS: câu chữ nguyên văn docs/30-TUTORIAL.md §3', () => {
  const expected = {
    1: {
      instruction: 'Bàn chỉ có các chấm tròn. Bấm vào khoảng giữa hai chấm để nối một cạnh.',
      hint: 'Mỗi lần chỉ tô được một cạnh. Cạnh sát mép bàn không tô được.',
      successLine: 'Xong. Lượt chuyển sang máy.',
    },
    2: {
      instruction: 'Ô góc này mới có 2 cạnh, còn thiếu 2 cạnh nữa mới kín. Cả 4 cạnh bạn đều phải tô.',
      hint: 'Kín 4 cạnh là mình được ô.',
      successLine: 'Kín ô rồi! Ô đó là của bạn, và bạn được đi tiếp.',
    },
    3: {
      instruction: 'Bạn vừa kín ô nên vẫn là lượt bạn. Ô đó đủ 4 cạnh đều do bạn tô. Tô thêm một cạnh nữa đi.',
      hint: 'Đây là lần đi thứ hai liên tiếp của bạn.',
      successLine: 'Đó là chơi luân phiên: hết lượt thì đến máy.',
    },
    4: {
      instruction: 'Ô góc dưới-trái đã có 3 cạnh. Đừng tô cạnh cuối của ô đó — tô một cạnh khác an toàn hơn.',
      hint: '3 cạnh = gần như của máy.',
      successLine: 'Tô cạnh thứ 3 là mở ô cho người khác. Gặp ô 3 cạnh thì đi chỗ khác.',
      failLine: 'Cạnh đó mở ô cho máy mất rồi. Thử lại nhé.',
    },
    5: {
      instruction: 'Bàn chỉ có các chấm tròn — bạn nối cạnh giữa chúng. Cạnh sát mép bàn là viền, không tô được.',
      hint: 'Thử bấm vào hàng tùy chọn bên dưới: thời gian, kích thước, độ khó.',
      successLine: 'Hết hướng dẫn. Chơi ván đầu tiên nhé!',
    },
  };
  for (const step of TUTORIAL_STEPS.steps) {
    const exp = expected[step.id];
    for (const key of Object.keys(exp)) {
      assert.equal(step[key], exp[key], `bước ${step.id} trường ${key} lệch nguyên văn`);
    }
  }
});

test('TUTORIAL_STEPS: thời lượng chờ đúng tài liệu (700/1200/900/900/0, aiDelay 600, failUndo 900)', () => {
  const byId = Object.fromEntries(TUTORIAL_STEPS.steps.map((s) => [s.id, s]));
  assert.equal(byId[1].advanceDelayMs, 700);
  assert.equal(byId[2].advanceDelayMs, 1200);
  assert.equal(byId[3].advanceDelayMs, 900);
  assert.equal(byId[3].aiDelayMs, 600);
  assert.equal(byId[4].advanceDelayMs, 900);
  assert.equal(byId[4].failUndoDelayMs, 900);
  assert.equal(byId[5].advanceDelayMs, 0);
  assert.deepEqual(byId[5].controls, ['timeLimit', 'boardSize', 'difficulty']);
  assert.equal(byId[5].seatFromStateOf, 4);
  assert.deepEqual(byId[4].dangerBox, [2, 0]);
});

test('mọi cạnh trong allowedEdges/decoyEdges là cạnh TRONG và CHƯA TÔ ở trạng thái seedEdges', () => {
  for (const step of TUTORIAL_STEPS.steps) {
    const g = boardFromSeed(step);
    const checked = [...step.allowedEdges, ...step.decoyEdges];
    for (const e of checked) {
      assert.ok(isInteriorEdge(e, g.n), `bước ${step.id}: ${JSON.stringify(e)} không phải cạnh trong`);
      assert.equal(isLegal(g, e), true, `bước ${step.id}: ${JSON.stringify(e)} đã bị tô ở seed`);
      assert.equal(g.edges.has(edgeKey(e)), false);
    }
    // Không cạnh nào trong seed trùng nhau, và mọi seed đều là cạnh trong.
    const keys = new Set();
    for (const e of step.seedEdges) {
      assert.ok(isInteriorEdge(e, g.n), `bước ${step.id}: seed ${JSON.stringify(e)} không phải cạnh trong`);
      const k = edgeKey(e);
      assert.equal(keys.has(k), false, `bước ${step.id}: seed trùng ${k}`);
      keys.add(k);
    }
    // allowedEdges không lặp.
    const ak = new Set(step.allowedEdges.map(edgeKey));
    assert.equal(ak.size, step.allowedEdges.length, `bước ${step.id}: allowedEdges bị lặp`);
  }
});

test('bước 1: 6 cạnh ngang của hai hàng giữa, không có cạnh mồi', () => {
  const s1 = getStep(1);
  assert.deepEqual(s1.seedEdges, []);
  assert.equal(s1.allowedEdges.length, 6);
  for (const e of s1.allowedEdges) assert.equal(e[2], 'H', 'bước 1 chỉ cho cạnh ngang');
  assert.deepEqual(s1.decoyEdges, []);
  assert.deepEqual(s1.aiMoves, []);
  const g = boardFromSeed(s1);
  assert.equal(score(g).total, 0);
});

test('bước 2: bấm allowedEdges làm kín ĐÚNG 1 ô (ô góc (0,0)) và giữ lượt', () => {
  const s2 = getStep(2);
  assert.equal(s2.allowedEdges.length, 1);
  const g = boardFromSeed(s2);
  // Trước khi bấm: ô (0,0) còn đúng 1 cạnh.
  assert.equal(boxMissing(g, 0, 0), 1);
  const before = score(g);
  const res = applyMove(g, s2.allowedEdges[0]);
  assert.equal(res.ok, true);
  assert.equal(res.closed.length, 1, 'chỉ được kín đúng 1 ô');
  assert.deepEqual(res.closed, [[0, 0]]);
  assert.equal(score(g).total, before.total + 1);
  assert.equal(res.keepsTurn, true, 'kín ô thì lượt KHÔNG chuyển');
  assert.equal(g.turn, 'A');
  assert.equal(boxState(g, 0, 0).count, 4);
});

test('bước 3: bấm cạnh an toàn → máy đi cạnh còn lại theo aiReply và bàn vẫn SẠCH', () => {
  const s3 = getStep(3);
  assert.equal(s3.allowedEdges.length, 2);
  assert.equal(s3.aiMoves.length, 1);
  for (const pick of s3.allowedEdges) {
    const g = boardFromSeed(s3);
    // Bàn vào bước 3: ô (0,0) đã kín, không ô 3 cạnh nào.
    assert.equal(countThirds(g), 0, 'bàn đầu bước 3 phải sạch');
    assert.equal(boxState(g, 0, 0).count, 4);
    const res = applyMove(g, pick);
    assert.equal(res.ok, true);
    assert.equal(res.keepsTurn, false, 'không kín ô → mất lượt');
    assert.equal(g.turn, 'B');
    // Máy trả lời đúng cặp theo aiReply.
    const key = `[${pick[0]},${pick[1]},${pick[2]}]`;
    const reply = s3.aiReply[key];
    assert.ok(Array.isArray(reply) && reply.length === 1, `aiReply thiếu khóa ${key}`);
    const rcom = applyMove(g, reply[0]);
    assert.equal(rcom.ok, true);
    assert.equal(rcom.player, 'B');
    assert.deepEqual(rcom.closed, [], 'máy ở bước 3 không được ăn ô');
    assert.equal(rcom.keepsTurn, false);
    assert.equal(g.turn, 'A', 'lượt về người chơi');
    assert.equal(countThirds(g), 0, 'bàn vẫn sạch: không ô 3 cạnh nào');
    assert.equal(countThirds(g), 0);
    assert.ok(legalEdges(g).length > 0);
  }
});

test('bước 3: aiReply là ánh xạ 1-1 giữa hai cạnh allowedEdges', () => {
  const s3 = getStep(3);
  const keys = s3.allowedEdges.map((e) => `[${e[0]},${e[1]},${e[2]}]`);
  assert.deepEqual(Object.keys(s3.aiReply).sort(), keys.slice().sort());
  for (const k of keys) {
    const reply = s3.aiReply[k];
    assert.equal(reply.length, 1);
    // Máy phải đi cạnh còn lại trong cặp.
    const other = s3.allowedEdges.find((e) => `[${e[0]},${e[1]},${e[2]}]` !== k);
    assert.equal(edgeKey(reply[0]), edgeKey(other));
  }
});

test('bước 4: cạnh an toàn không kín ô và không sinh thêm ô 3 cạnh', () => {
  const s4 = getStep(4);
  const g0 = boardFromSeed(s4);
  // Bàn vào bước 4 có ĐÚNG một ô 3 cạnh: (2,0).
  const thirds = [];
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) if (boxMissing(g0, br, bc) === 1) thirds.push([br, bc]);
  assert.deepEqual(thirds, [[2, 0]]);
  assert.deepEqual(s4.dangerBox, [2, 0]);
  for (const e of s4.allowedEdges) {
    const g = boardFromSeed(s4);
    const before = countThirds(g);
    const res = applyMove(g, e);
    assert.equal(res.ok, true);
    assert.deepEqual(res.closed, [], `cạnh an toàn ${JSON.stringify(e)} không được kín ô`);
    assert.equal(score(g).total, 0);
    // Bàn vẫn chỉ có đúng ô (2,0) là 3 cạnh (cạnh an toàn không sinh thêm).
    const after = [];
    for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) if (boxMissing(g, br, bc) === 1) after.push([br, bc]);
    assert.deepEqual(after, [[2, 0]], 'không được sinh thêm ô 3 cạnh');
    assert.equal(countThirds(g), before);
  }
});

test('bước 4: cạnh mồi [2,1,V] mở ô (2,0) — bấm là sai, hoàn tác phải sạch', () => {
  const s4 = getStep(4);
  assert.deepEqual(s4.decoyEdges, [[2, 1, 'V']]);
  const g = boardFromSeed(s4);
  const snap = { data: serializeGame(g), score: score(g), turn: g.turn };
  const res = applyMove(g, s4.decoyEdges[0]);
  assert.equal(res.ok, true);
  assert.deepEqual(res.closed, [[2, 0]], 'cạnh mồi phải kín ô nguy hiểm');
  assert.equal(score(g).total, 1);
  // Hoàn tác → trạng thái quay lại đúng như trước khi bấm (không trừ điểm, không đếm lỗi).
  assert.equal(undoMove(g).ok, true);
  // turnSeq tăng (mỗi thay đổi đều tăng để vô hiệu timer cũ) nhưng cạnh/ô/điểm phải y nguyên.
  assert.equal(JSON.stringify(serializeGame(g).edges), JSON.stringify(snap.data.edges));
  assert.equal(JSON.stringify(serializeGame(g).boxes), JSON.stringify(snap.data.boxes));
  assert.deepEqual(score(g), snap.score);
  assert.equal(g.turn, snap.turn);
  assert.ok(serializeGame(g).turnSeq > snap.data.turnSeq);
  assert.deepEqual(score(g), { A: 0, B: 0, total: 0 });
  assert.equal(g.turn, 'A');
});

test('bước 4: decoyEdges tạo đúng ô 3 cạnh → cạnh kín (kiểm bằng boxesClosedBy)', () => {
  const s4 = getStep(4);
  const g = boardFromSeed(s4);
  for (const d of s4.decoyEdges) {
    assert.deepEqual(boxesClosedBy(g, d), [[2, 0]]);
  }
  for (const e of s4.allowedEdges) {
    assert.deepEqual(boxesClosedBy(g, e), []);
  }
});

test('bước 5: bàn bê từ bước 4, không cho bấm cạnh nào, có 3 control', () => {
  const s5 = getStep(5);
  assert.deepEqual(s5.seedEdges, []);
  assert.equal(s5.seatFromStateOf, 4);
  assert.deepEqual(s5.allowedEdges, []);
  assert.deepEqual(s5.aiMoves, []);
  assert.deepEqual(s5.controls, ['timeLimit', 'boardSize', 'difficulty']);
  assert.equal(TUTORIAL_STEP5_DONE_HINT, 'Bấm Xong khi bạn đã xem.');
});

test('dữ liệu mặc định không kết thúc ván và "máy" không tự đi ngoài kịch bản', () => {
  for (const step of TUTORIAL_STEPS.steps) {
    const g = boardFromSeed(step);
    // Bàn tutorial không bao giờ ở trạng thái hết ván khi bắt đầu bước.
    assert.ok(legalEdges(g).length > 0, `bước ${step.id} không được bắt đầu ở thế hết nước`);
    // aiMoves ở bước khác rỗng chỉ xuất hiện ở bước 3.
    if (step.id !== 3) assert.deepEqual(step.aiMoves, [], `bước ${step.id} không được có aiMoves`);
  }
});

test('getStep/listHasEdge/describeEdge hoạt động đúng', () => {
  assert.equal(getStep(1).id, 1);
  assert.equal(getStep(9), null);
  assert.equal(listHasEdge(TUTORIAL_STEPS.steps[0].allowedEdges, [1, 0, 'H']), true);
  assert.equal(listHasEdge(TUTORIAL_STEPS.steps[0].allowedEdges, [1, 0, 'V']), false);
  assert.equal(describeEdge([1, 0, 'H']), 'Cạnh ngang hàng 2 cột 1');
  assert.equal(describeEdge([2, 1, 'V']), 'Cạnh dọc hàng 3 cột 2');
});

test('Màn "Hướng dẫn nhanh": 3 thẻ, đủ tiêu đề + câu nguyên văn, minh hoạ hợp lệ', () => {
  assert.equal(QUICK_GUIDE.cards.length, 3);
  assert.equal(QUICK_GUIDE.cta, 'Chơi thử Tutorial');
  assert.equal(QUICK_GUIDE.skip, 'Bỏ qua');
  const expected = [
    'Mỗi lượt, bạn tô một đoạn thẳng còn trống.',
    'Ô đủ 4 cạnh thì thuộc về người tô cạnh cuối, và người đó đi tiếp.',
    'Để ô thiếu đúng 1 cạnh là dâng ô cho đối thủ.',
  ];
  assert.deepEqual(QUICK_GUIDE.cards.map((c) => c.text), expected);
  assert.deepEqual(QUICK_GUIDE.cards.map((c) => c.title), [
    'Tô một đoạn thẳng', 'Kín 4 cạnh được một ô', 'Thấy ô 3 cạnh thì tránh',
  ]);
  // Mỗi minh hoạ phải dựng được trên bàn 3×3 và các cạnh seed là cạnh trong.
  for (const card of QUICK_GUIDE.cards) {
    for (const e of card.seedEdges) assert.ok(isInteriorEdge(e, TUTORIAL_STEPS.boardSize));
    for (const e of card.warnEdges || []) assert.ok(isInteriorEdge(e, TUTORIAL_STEPS.boardSize));
  }
});

test('Màn "Hướng dẫn nhanh": minh hoạ khớp lời (thẻ 2 kín ô góc, thẻ 3 có ô 3 cạnh)', () => {
  const g = (card) => {
    const board = createGame({ n: 3 });
    for (const e of card.seedEdges) applyMove(board, e);
    return board;
  };
  const card2 = g(QUICK_GUIDE.cards[1]);
  assert.deepEqual(QUICK_GUIDE.cards[1].highlightBox, [0, 0]);
  assert.equal(boxState(card2, 0, 0).count, 4, 'thẻ 2: ô góc phải kín');
  assert.equal(QUICK_GUIDE.cards[1].showTick, true);

  const card3 = g(QUICK_GUIDE.cards[2]);
  const [br, bc] = QUICK_GUIDE.cards[2].highlightBox;
  assert.equal(boxMissing(card3, br, bc), 1, 'thẻ 3: ô được chọn phải thiếu đúng 1 cạnh');
  assert.deepEqual(boxesClosedBy(card3, QUICK_GUIDE.cards[2].warnEdges[0]), [[br, bc]]);
});

test('Luật ngắn: đúng 4 dòng nguyên văn §5.2', () => {
  assert.deepEqual(RULES_SHORT, [
    'Mỗi lượt: tô một cạnh còn trống.',
    'Ô đủ 4 cạnh: ô đó là của người tô cạnh cuối.',
    'Kín ô thì được đi tiếp.',
    'Nhiều ô hơn thì thắng.',
  ]);
  assert.equal(RULES_MODAL.openGlossary, 'Đọc bảng từ ngữ');
  assert.equal(RULES_MODAL.close, 'Đóng');
});

test('Gợi ý §5.3: đúng thứ tự ưu tiên và câu nguyên văn', () => {
  assert.deepEqual(HINT_LINES.map((h) => h.priority), [1, 2, 3, 4]);
  const texts = {
    1: 'Có một ô đang thiếu đúng một cạnh. Tô nốt cạnh đó đi.',
    2: 'Có ô đã 3 cạnh. Cẩn thận, đừng tô cạnh cuối của ô đó.',
    3: 'Tô ở giữa bàn trước, tránh tạo ô đủ 3 cạnh.',
    4: 'Sắp hết rồi. Đếm số ô hai bên để biết mình đang hơn hay kém.',
  };
  for (const h of HINT_LINES) assert.equal(h.text, texts[h.priority]);
  // Ưu tiên 1 thắng mọi trường hợp khác.
  assert.equal(pickHintLine({ myCapturable: 1, opponentThird: 2, anyThird: 3, remaining: 20, total: 40 }).priority, 1);
  // Không ăn được nhưng có ô 3 cạnh → ưu tiên 2.
  assert.equal(pickHintLine({ myCapturable: 0, opponentThird: 1, anyThird: 1, remaining: 20, total: 40 }).priority, 2);
  // Không có ô 3 cạnh → ưu tiên 3.
  assert.equal(pickHintLine({ myCapturable: 0, opponentThird: 0, anyThird: 0, remaining: 20, total: 40 }).priority, 3);
  // Không còn ô 3 cạnh và còn rất ít cạnh → ưu tiên 4.
  assert.equal(pickHintLine({ myCapturable: 0, opponentThird: 0, anyThird: 0, remaining: 1, total: 40 }).priority, 4);
});

test('Gợi ý: dựng từ bàn thật cho ra câu đúng tình huống', () => {
  // Bàn có nước ăn ngay → câu 1.
  const g1 = createGame({ n: 3 });
  applyMove(g1, [1, 0, 'H']);
  assert.equal(pickHintLine({ myCapturable: 1, opponentThird: 0, anyThird: 1, remaining: 11, total: 12 }).text, HINT_LINES[0].text);
});

test('Bảng thuật ngữ §6: đủ 6 mục nguyên văn và ẩn dụ xuyên suốt', () => {
  assert.equal(GLOSSARY.heading, 'Từ ngữ trong game');
  assert.equal(
    GLOSSARY.metaphor,
    'Mỗi ô là một cái hộp, cạnh là thanh ghép của nắp hộp. Ghép đủ 4 thanh thì hộp đóng lại và phần thưởng là của mình.',
  );
  assert.equal(GLOSSARY.entries.length, 6);
  assert.deepEqual(GLOSSARY.entries.map((e) => e.term), [
    'Cạnh', 'Ô', 'Mép bàn', 'Giữ lượt', 'Cạnh thứ 3 (cạnh xấu)', 'Chuỗi',
  ]);
  assert.equal(GLOSSARY.entries[2].plain, 'Cạnh nằm sát mép ngoài cùng của bàn. Không tô được, không tính điểm — bàn chỉ có các chấm để nối.');
  for (const e of GLOSSARY.entries) {
    assert.ok(e.term && e.plain && e.metaphor, 'mỗi mục cần term/plain/metaphor');
  }
});

test('Chuỗi UI tutorial tiếng Việt có dấu, không emoji, gọi máy là "máy"', () => {
  const strings = [
    TUTORIAL_LABELS.skip,
    TUTORIAL_LABELS.finish,
    TUTORIAL_LABELS.finishCta,
    TUTORIAL_LABELS.comThinking,
    TUTORIAL_LABELS.comDone,
    ...QUICK_GUIDE.cards.map((c) => c.text),
    ...RULES_SHORT,
    ...HINT_LINES.map((h) => h.text),
  ];
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const str of strings) {
    assert.equal(emoji.test(str), false, `chuỗi có emoji: ${str}`);
    assert.ok(str.length > 0);
  }
  // Không được gọi "AI" trong UI (Zero-Assumption §8 của tài liệu).
  for (const str of strings) assert.equal(/\bAI\b/.test(str), false, `lộ thuật ngữ "AI": ${str}`);
  assert.equal(TUTORIAL_LABELS.com, 'máy');
});

test('restoreGame giữ được bàn tutorial dở (dùng cho khôi phục giữa chừng)', () => {
  const s2 = getStep(2);
  const g = boardFromSeed(s2);
  const back = restoreGame(JSON.parse(JSON.stringify(serializeGame(g))));
  assert.deepEqual(score(back), score(g));
  assert.equal(boxMissing(back, 0, 0), boxMissing(g, 0, 0));
  assert.equal(back.turn, g.turn);
});
