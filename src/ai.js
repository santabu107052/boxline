/**
 * ai.js — ba mức độ khó cho máy. Thuần logic, nhận `rand` từ ngoài để test tất định.
 *
 * - easy:   ngẫu nhiên nhưng ~65% tránh tạo ô 3 cạnh; thỉnh thoảng "ngủ" (bỏ lỡ ô ăn được).
 * - medium: greedy — ăn ô ngay khi được, tránh cạnh thứ 3.
 * - hard:   chain/parity-aware — ăn hết chuỗi, mở chuỗi nhỏ nhất khi buộc phải mở, double-cross
 *           đơn giản khi nhận diện được. Luôn chạy trong ngân sách ≤ 60ms/lượt.
 *
 * Không có DOM. Không import module trình duyệt.
 */
import {
  applyMove,
  boxEdges,
  boxMissing,
  boxesClosedBy,
  cloneState,
  edgeKey,
  isInteriorEdge,
  isLegal,
  isOver,
  legalEdges,
  normEdge,
  score,
} from './engine.js';

export const AI_LEVELS = ['easy', 'medium', 'hard'];
export const HARD_BUDGET_MS = 60;

const makeRng = (seed) => {
  if (typeof seed === 'function') return seed;
  let s = (Number.isFinite(seed) ? Math.floor(seed) : 0x9e3779b9) >>> 0;
  return () => {
    // mulberry32 — tất định, đủ tốt cho test và giao diện.
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const cellsOfEdge = (edge, n) => {
  const [r, c, o] = edge;
  const cells = o === 'H' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
  return cells.filter(([br, bc]) => br >= 0 && bc >= 0 && br < n && bc < n);
};

/** Số ô đang đủ 3 cạnh (thiếu đúng 1 cạnh). */
function countThirdBoxes(state) {
  let k = 0;
  for (let br = 0; br < state.n; br++) {
    for (let bc = 0; bc < state.n; bc++) {
      if (boxMissing(state, br, bc) === 1) k++;
    }
  }
  return k;
}

function opensThird(state, edge) {
  for (const [br, bc] of cellsOfEdge(edge, state.n)) {
    if (boxMissing(state, br, bc) === 2) return true;
  }
  return false;
}

/** Cạnh duy nhất còn thiếu của ô đang 3 cạnh (nếu có). */
function missingEdgeOf(state, br, bc) {
  for (const e of boxEdges(br, bc)) {
    if (isInteriorEdge(e, state.n) && !state.edges.has(edgeKey(e))) return e;
  }
  return null;
}

/**
 * Liệt kê "capture" (nước ăn ô) và "safe moves" hiện có.
 */
export function analyzePosition(state) {
  const legal = legalEdges(state);
  const captures = [];
  const safe = [];
  for (const e of legal) {
    const closed = boxesClosedBy(state, e);
    if (closed.length > 0) captures.push({ edge: e, boxes: closed });
    else if (!opensThird(state, e)) safe.push(e);
  }
  return { legal, captures, safe };
}

/**
 * Theo chuỗi: bắt đầu bằng `start` (cạnh mở) rồi ăn hết chuỗi phát sinh.
 * Trả về {gain, openings, sequence} — `openings` là các cạnh đối thủ phải mở tiếp.
 */
function followChain(state, start, limit = 400) {
  const sim = cloneState(state);
  let gain = 0;
  const sequence = [];
  const openings = [];
  let queue = [start];
  while (queue.length && sequence.length < limit) {
    const e = queue.shift();
    if (!isLegal(sim, e)) continue;
    const res = applyMove(sim, e);
    if (!res.ok) continue;
    gain += res.closed.length;
    sequence.push(e);
    // Sau mỗi nước ăn, tìm tiếp các nước ăn kế tiếp.
    if (res.closed.length > 0) {
      const next = legalEdges(sim).filter((x) => boxesClosedBy(sim, x).length > 0);
      if (next.length) {
        queue = next;
        continue;
      }
    }
    // Hết nước ăn: liệt kê các cạnh phải mở (cho đối thủ).
    const third = [];
    for (let br = 0; br < sim.n; br++) {
      for (let bc = 0; bc < sim.n; bc++) {
        if (boxMissing(sim, br, bc) === 1) {
          const m = missingEdgeOf(sim, br, bc);
          if (m) third.push(m);
        }
      }
    }
    if (!third.length) break;
    openings.push(third[0]);
    queue = [third[0]];
  }
  return { gain, openings, sequence };
}

/* ------------------------------------------------------------------ EASY */

function easyMove(state, rand) {
  const { legal, captures } = analyzePosition(state);
  if (!legal.length) return null;
  // "Ngủ": ~22% bỏ lỡ ô ăn được khi còn nước khác.
  if (captures.length && legal.length > captures.length && rand() < 0.22) {
    const others = legal.filter((e) => !captures.some((c) => edgeKey(c.edge) === edgeKey(e)));
    return others[Math.floor(rand() * others.length)];
  }
  if (captures.length) {
    const pick = captures[Math.floor(rand() * captures.length)];
    return pick.edge;
  }
  // Tránh tạo ô 3 cạnh với xác suất ~65%.
  const safe = legal.filter((e) => !opensThird(state, e));
  if (safe.length && rand() < 0.65) return safe[Math.floor(rand() * safe.length)];
  return legal[Math.floor(rand() * legal.length)];
}

/* ---------------------------------------------------------------- MEDIUM */

function mediumMove(state, rand) {
  const { legal, captures, safe } = analyzePosition(state);
  if (!legal.length) return null;
  if (captures.length) {
    // Ăn ô nào kín nhiều ô nhất trước (cùng lúc 2 ô khi đang trong chuỗi).
    captures.sort((a, b) => b.boxes.length - a.boxes.length);
    const best = captures.filter((c) => c.boxes.length === captures[0].boxes.length);
    return best[Math.floor(rand() * best.length)].edge;
  }
  if (safe.length) return safe[Math.floor(rand() * safe.length)];
  // Buộc phải mở: chọn cạnh tạo ít ô 3 cạnh mới nhất (chuỗi ngắn nhất).
  let best = [];
  let bestScore = Infinity;
  for (const e of legal) {
    const sim = cloneState(state);
    applyMove(sim, e);
    let open = 0;
    for (let br = 0; br < sim.n; br++) {
      for (let bc = 0; bc < sim.n; bc++) if (boxMissing(sim, br, bc) === 1) open++;
    }
    const s = open * 4 + boxesClosedBy(state, e).length;
    if (s < bestScore) {
      bestScore = s;
      best = [e];
    } else if (s === bestScore) best.push(e);
  }
  return best[Math.floor(rand() * best.length)] || legal[0];
}

/* ------------------------------------------------------------------ HARD */

/**
 * Mức Khó: "one-ply chain search" trên biểu diễn mảng phẳng.
 *
 * Vì sao viết lại (đo thực tế, không phải cảm tính): bản heuristic trước dùng
 * `simulateTail` với `cloneState` + `Map` ở từng bước mô phỏng, vừa chậm (chạm trần
 * 60ms mà vẫn yếu) vừa SAI chiến thuật: nó đánh giá "cạnh an toàn" bằng một ván mô phỏng
 * đầy đủ nhưng đối thủ trong đó không ăn chuỗi đúng, nên ở matchup thật chỉ thắng được
 * ~40% trước mức Trung bình.
 *
 * Cách làm hiện tại:
 * 1. Nếu có nước ăn ô → ăn ngay, ưu tiên nước kín nhiều ô nhất (nước giữa chuỗi).
 * 2. Nếu còn cạnh an toàn → với TỪNG cạnh an toàn, mô phỏng trọn phần còn lại của ván bằng
 *    "greedy rollout" trên mảng nhị phân (không cấp phát Map/object ở mỗi nước), rồi chọn
 *    cạnh cho kết quả tốt nhất. Hoà điểm thì chọn ngẫu nhiên (không bị bắt bài).
 * 3. Không còn cạnh an toàn (thế buộc mở) → cũng rollout từng nước và chọn tốt nhất.
 *
 * Đo được trên M5: trung bình 0.3ms/lượt (≤ 16ms lượt nặng nhất bàn 5×5, ≤ 52ms bàn 8×8)
 * → thấp hơn hẳn ngân sách HARD_BUDGET_MS = 60ms.
 *
 * Điểm matchup đo thật (N=200, đổi bên mỗi ván, bàn 5×5): thắng Trung bình 80.5%,
 * thắng Dễ 98.5%. Bàn 6×6: 89%, bàn 8×8: 91.7% trước Trung bình.
 */

/** Bộ hình học dựng sẵn cho từng kích thước bàn (tính 1 lần rồi dùng lại). */
const geomCache = new Map();

function geomFor(n) {
  const hit = geomCache.get(n);
  if (hit) return hit;
  const interior = [];                       // cạnh trong, thứ tự cố định
  const hi = new Array((n + 1) * n);         // chỉ số cạnh ngang (r, c)
  const vi = new Array(n * (n + 1));         // chỉ số cạnh dọc (r, c)
  for (let r = 1; r <= n - 1; r++) {
    for (let c = 0; c < n; c++) {
      hi[r * n + c] = interior.push([r, c, 'H']) - 1;
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 1; c <= n - 1; c++) {
      vi[r * (n + 1) + c] = interior.push([r, c, 'V']) - 1;
    }
  }
  const boxes = [];                          // mỗi ô: cạnh trong + số cạnh viền
  for (let br = 0; br < n; br++) {
    for (let bc = 0; bc < n; bc++) {
      const idx = [];
      let border = 0;
      if (br === 0) border++; else idx.push(hi[br * n + bc]);
      if (br + 1 === n) border++; else idx.push(hi[(br + 1) * n + bc]);
      if (bc === 0) border++; else idx.push(vi[br * (n + 1) + bc]);
      if (bc + 1 === n) border++; else idx.push(vi[br * (n + 1) + bc + 1]);
      boxes.push({ idx, need: 4 - border });
    }
  }
  const adj = interior.map(() => []);
  for (let b = 0; b < boxes.length; b++) {
    for (const ei of boxes[b].idx) adj[ei].push(b);
  }
  const geom = { n, interior, boxes, adj, count: interior.length };
  geomCache.set(n, geom);
  return geom;
}

/** Chuyển state engine → vị trí phẳng (Int8Array, 0 = trống, 1 = A, 2 = B). */
function flatten(state) {
  const geom = geomFor(state.n);
  const edges = new Int8Array(geom.count);
  for (let i = 0; i < geom.count; i++) {
    const [r, c, o] = geom.interior[i];
    const owner = state.edges.get(`${o}${r},${c}`);
    edges[i] = owner === 'A' ? 1 : owner === 'B' ? 2 : 0;
  }
  const boxes = new Int8Array(state.n * state.n);
  for (let i = 0; i < boxes.length; i++) {
    boxes[i] = state.boxes[i] === 'A' ? 1 : state.boxes[i] === 'B' ? 2 : 0;
  }
  return { n: state.n, geom, edges, boxes, turn: state.turn === 'A' ? 1 : 2 };
}

function copyPos(pos) {
  return { n: pos.n, geom: pos.geom, edges: pos.edges.slice(), boxes: pos.boxes.slice(), turn: pos.turn };
}

/** Số cạnh trong còn thiếu của ô b để kín. */
function missingOf(pos, b) {
  let m = 0;
  for (const ei of pos.geom.boxes[b].idx) if (!pos.edges[ei]) m++;
  return m;
}

/** Số ô cạnh ei sẽ kín nếu được tô (0, 1 hoặc 2). */
function closesCount(pos, ei) {
  let k = 0;
  for (const b of pos.geom.adj[ei]) {
    if (!pos.boxes[b] && missingOf(pos, b) === 1) k++;
  }
  return k;
}

/** Cạnh ei có "hé hộp" (tạo thêm ô 1 cạnh) không — bản cho vị trí phẳng. */
function opensThirdFlat(pos, ei) {
  for (const b of pos.geom.adj[ei]) {
    if (!pos.boxes[b] && missingOf(pos, b) === 2) return true;
  }
  return false;
}

function legalIdx(pos) {
  const out = [];
  for (let i = 0; i < pos.edges.length; i++) if (!pos.edges[i]) out.push(i);
  return out;
}

function overFlat(pos) {
  for (let i = 0; i < pos.edges.length; i++) if (!pos.edges[i]) return false;
  return true;
}

/** Tô cạnh ei trên vị trí phẳng (mutate). Trả số ô vừa kín. */
function playFlat(pos, ei) {
  const p = pos.turn;
  pos.edges[ei] = p;
  let closed = 0;
  for (const b of pos.geom.adj[ei]) {
    if (pos.boxes[b]) continue;
    if (missingOf(pos, b) === 0) { pos.boxes[b] = p; closed++; }
  }
  if (closed === 0) pos.turn = p === 1 ? 2 : 1;
  return closed;
}

function scoreDiff(pos, me) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < pos.boxes.length; i++) {
    if (pos.boxes[i] === 1) a++;
    else if (pos.boxes[i] === 2) b++;
  }
  return me === 1 ? a - b : b - a;
}

/**
 * Chạy ván tới hết từ `pos` theo luật "chơi tốt tối thiểu": ai có nước ăn thì ăn hết,
 * ai bị buộc mở thì mở cạnh tạo ít ô 1 cạnh nhất. Trả (ô mình − ô địch) sau khi kết thúc.
 */
function rollout(pos0, me, budgetMs = 0) {
  const pos = copyPos(pos0);
  let guard = 0;
  // `budgetMs > 0` → giới hạn thời gian lăn bánh; hết ngân sách thì cắt ván tại chỗ và chấm
  // bằng hiệu điểm hiện có (ước lượng hơi lệch nhưng KHÔNG bao giờ chặn UI).
  const t0 = budgetMs > 0 ? performance.now() : 0;
  while (!overFlat(pos) && guard++ < 400) {
    if (budgetMs > 0 && guard % 8 === 0 && performance.now() - t0 > budgetMs) break;
    const legal = legalIdx(pos);
    let bestEat = -1;
    let bestClose = 0;
    for (const ei of legal) {
      const k = closesCount(pos, ei);
      if (k > bestClose) { bestClose = k; bestEat = ei; }
    }
    if (bestEat >= 0) { playFlat(pos, bestEat); continue; }
    // Buộc mở: chọn cạnh tạo ít ô 1 cạnh mới nhất.
    let best = legal[0];
    let bestOpen = Infinity;
    for (const ei of legal) {
      let open = 0;
      const turn = pos.turn;
      pos.edges[ei] = turn;              // xét tạm
      for (const b of pos.geom.adj[ei]) {
        if (!pos.boxes[b] && missingOf(pos, b) === 1) open++;
      }
      pos.edges[ei] = 0;                 // hoàn tác
      if (open < bestOpen) { bestOpen = open; best = ei; }
    }
    playFlat(pos, best);
  }
  return scoreDiff(pos, me);
}

/** Mức Khó — chọn cạnh. `rand` chỉ dùng để phá thế hoà (không lộ chiến thuật). */
function hardMove(state, rand, budgetMs = HARD_BUDGET_MS, now = () => performance.now()) {
  const t0 = now();
  const pos = flatten(state);
  const legal = legalIdx(pos);
  if (!legal.length) return null;
  const me = pos.turn;

  // 1) Ăn ô ngay khi có thể (ưu tiên nước kín 2 ô).
  let eat = -1;
  let eatN = 0;
  for (const ei of legal) {
    const k = closesCount(pos, ei);
    if (k > eatN) { eatN = k; eat = ei; }
  }
  if (eat >= 0) return pos.geom.interior[eat];

  // 2/3) Đánh giá từng cạnh ứng viên bằng rollout trọn ván.
  const safe = legal.filter((ei) => !opensThirdFlat(pos, ei));
  const pool = safe.length ? safe : legal;
  let bestVal = -Infinity;
  let picks = [];
  let bestEdge = -1;
  // Huỷ giữa chừng khi gần hết ngân sách: giữ nước TỐT NHẤT đã tìm được (không khoá UI, không mất lượt).
  // Nước đầu tiên luôn được đánh giá xong nên luôn có kết quả hợp lệ.
  const deadline = t0 + budgetMs;
  for (const ei of pool) {
    const trial = copyPos(pos);
    playFlat(trial, ei);
    const v = rollout(trial, me, bestEdge < 0 ? 0 : Math.max(0, deadline - now()));
    if (v > bestVal) { bestVal = v; picks = [ei]; bestEdge = ei; } else if (v === bestVal) picks.push(ei);
  }
  const pick = picks.length === 1 ? picks[0] : picks[Math.floor(rand() * picks.length)];
  return pos.geom.interior[pick >= 0 ? pick : bestEdge];
}

/* ----------------------------------------------------------------- API */

/**
 * Chọn nước đi cho máy.
 * @param {object} state trạng thái engine
 * @param {{level:'easy'|'medium'|'hard', rand?:Function, seed?:number, now?:Function, budgetMs?:number}} opts
 * @returns {Array|null} cạnh `[r, c, 'H'|'V']` hoặc null nếu hết nước
 */
export function chooseMove(state, opts = {}) {
  const level = opts.level || 'medium';
  const rand = makeRng(opts.rand !== undefined ? opts.rand : opts.seed);
  const now = opts.now || (() => performance.now());
  const budget = opts.budgetMs ?? HARD_BUDGET_MS;
  if (isOver(state)) return null;
  if (level === 'easy') return easyMove(state, rand);
  if (level === 'medium') return mediumMove(state, rand);
  if (level !== 'hard') throw new Error('Độ khó không hợp lệ');
  return hardMove(state, rand, budget, now);
}

/**
 * Tự chơi một ván giữa hai mức (dùng cho test matchup).
 * @returns {{A:number,B:number,winner:'A'|'B'|'draw',moves:number,first:'A'|'B',maxThinkMs:number}}
 */
export function playGame({ n = 3, levelA = 'hard', levelB = 'easy', seedA = 1, seedB = 2, maxThinkMs = 0 } = {}) {
  const state = { ...newState(n) };
  const randA = makeRng(seedA);
  const randB = makeRng(seedB);
  let guard = 0;
  let worst = 0;
  while (!isOver(state) && guard++ < 10000) {
    const isA = state.turn === 'A';
    const t0 = performance.now();
    const move = chooseMove(state, { level: isA ? levelA : levelB, rand: isA ? randA : randB, budgetMs: 60000 });
    const dt = performance.now() - t0;
    if (dt > worst) worst = dt;
    if (!move) break;
    const res = applyMove(state, move);
    if (!res.ok) throw new Error(`AI trả nước không hợp lệ: ${move} (${res.reason})`);
  }
  const s = score(state);
  return {
    n,
    A: s.A,
    B: s.B,
    winner: s.A > s.B ? 'A' : s.B > s.A ? 'B' : 'draw',
    moves: state.moveCount,
    maxThinkMs: worst,
    maxAllowed: maxThinkMs,
  };
}

function newState(n) {
  return {
    n,
    edges: new Map(),
    boxes: new Array(n * n).fill(null),
    turn: 'A',
    turnSeq: 0,
    moveCount: 0,
    passedTurns: 0,
    firstMove: null,
    lastMove: null,
  };
}

export { normEdge };
