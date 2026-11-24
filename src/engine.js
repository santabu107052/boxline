/**
 * engine.js — luật chơi Dots & Boxes, THUẦN LOGIC (không DOM, không Canvas, không Audio).
 *
 * Nguồn sự thật: docs/00-BRIEF.md §4 và docs/30-TUTORIAL.md (quy ước cạnh).
 *
 * Quy ước cạnh: `[r, c, 'H' | 'V']`—điểm neo là GÓC TRÊN-TRÁI:
 *   - ngang `[r, c, 'H']` nối điểm (r, c) với (r, c+1)  → 0 ≤ r ≤ n, 0 ≤ c < n
 *   - dọc   `[r, c, 'V']` nối điểm (r, c) với (r+1, c)  → 0 ≤ r < n, 0 ≤ c ≤ n
 *
 * Luật Dots & Boxes chuẩn (không có viền ngoài tô sẵn): TẤT CẢ `2n(n+1)` cạnh hợp lệ
 * về mặt hình học (kể cả cạnh nằm trên mép bàn) đều chơi được. Mọi ô (góc, mép, giữa)
 * đều cần đủ 4 cạnh mới kín và tính điểm.
 *
 * Ô (br, bc) có 4 cạnh:
 *   trên  [br,   bc,   'H']
 *   dưới  [br+1, bc,   'H']
 *   trái  [br,   bc,   'V']
 *   phải  [br,   bc+1, 'V']
 */

export const PLAYERS = ['A', 'B'];

/** Chuẩn hoá cạnh về mảng 3 phần tử, trả null nếu sai kiểu. */
export function normEdge(edge) {
  if (!Array.isArray(edge) || edge.length < 3) return null;
  const r = Number(edge[0]);
  const c = Number(edge[1]);
  const o = edge[2];
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  if (o !== 'H' && o !== 'V') return null;
  return [r, c, o];
}

export function edgeKey(edge) {
  const e = normEdge(edge);
  if (!e) return '';
  return `${e[2]}${e[0]},${e[1]}`;
}

export function edgeEquals(a, b) {
  const x = normEdge(a);
  const y = normEdge(b);
  if (!x || !y) return false;
  return x[0] === y[0] && x[1] === y[1] && x[2] === y[2];
}

/** Cạnh nằm bên trong lưới (hình học: không nằm trên mép ngoài cùng). */
export function isInteriorEdge(edge, n) {
  const e = normEdge(edge);
  if (!e) return false;
  const [r, c, o] = e;
  if (o === 'H') return r >= 1 && r <= n - 1 && c >= 0 && c < n;
  return c >= 1 && c <= n - 1 && r >= 0 && r < n;
}

/** Cạnh hợp lệ về hình học (cả cạnh trong lẫn cạnh mép bàn). */
export function isOnBoard(edge, n) {
  const e = normEdge(edge);
  if (!e) return false;
  const [r, c, o] = e;
  if (o === 'H') return r >= 0 && r <= n && c >= 0 && c < n;
  return c >= 0 && c <= n && r >= 0 && r < n;
}

/** Cạnh nằm trên mép ngoài cùng của bàn (hình học: trên bàn nhưng không phải cạnh trong). */
export function isBorderEdge(edge, n) {
  const e = normEdge(edge);
  if (!e) return false;
  return isOnBoard(e, n) && !isInteriorEdge(e, n);
}

/** Danh sách toàn bộ cạnh chơi được trên bàn n×n (gồm cả cạnh mép bàn, tổng 2n(n+1)). */
export function allBoardEdges(n) {
  const list = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) list.push([r, c, 'H']);
  for (let c = 0; c <= n; c++) for (let r = 0; r < n; r++) list.push([r, c, 'V']);
  return list;
}

/** Danh sách toàn bộ cạnh trong (theo thứ tự hàng → cột: ngang hết, rồi dọc hết). */
export function allInteriorEdges(n) {
  const list = [];
  for (let r = 1; r < n; r++) for (let c = 0; c < n; c++) list.push([r, c, 'H']);
  for (let c = 1; c < n; c++) for (let r = 0; r < n; r++) list.push([r, c, 'V']);
  return list;
}

/** 4 cạnh của một ô (kể cả viền). */
export function boxEdges(br, bc) {
  return [
    [br, bc, 'H'],        // trên
    [br + 1, bc, 'H'],    // dưới
    [br, bc, 'V'],        // trái
    [br, bc + 1, 'V'],    // phải
  ];
}

/** Bốn ô kề với một cạnh (dùng chung để tránh lệch công thức giữa các hàm). */
function cellsOfEdge(r, c, o) {
  return o === 'H' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
}

/**
 * Tạo ván mới.
 * @param {{n:number, first?:'A'|'B', state?:object}} opts
 */
export function createGame({ n, first = 'A', state = null } = {}) {
  if (!Number.isInteger(n) || n < 2) throw new Error('Kích thước bàn không hợp lệ');
  if (state) return restoreGame(state);
  return {
    n,
    edges: new Map(),           // edgeKey -> player
    boxes: new Array(n * n).fill(null),
    turn: first === 'B' ? 'B' : 'A',
    turnSeq: 0,
    moveCount: 0,
    passedTurns: 0,             // số lượt bị mất do hết giờ (chỉ để hiển thị)
    firstMove: null,
    lastMove: null,
  };
}

/* ---------------------------------------------------------------------------
 * Truy vấn
 * ------------------------------------------------------------------------- */

export function boxState(state, br, bc) {
  const n = state.n;
  if (br < 0 || bc < 0 || br >= n || bc >= n) return { vs: 0, owner: null, count: 0 };
  let filled = 0;
  let ownerIn = null;
  for (const e of boxEdges(br, bc)) {
    const p = state.edges.get(edgeKey(e));
    if (p) {
      filled++;
      ownerIn = p;
    }
  }
  const closed = filled === 4;
  return { vs: 0, owner: closed ? (state.boxes[br * n + bc] || ownerIn) : null, count: filled };
}

/** Các cạnh mà ô (br, bc) còn phải tô để kín (luôn là 4 cạnh). */
export function requiredEdgesForBox(n, br, bc) {
  return boxEdges(br, bc);
}

/** Ô còn thiếu bao nhiêu cạnh (mọi ô mới đều thiếu 4 cạnh). */
export function boxMissing(state, br, bc) {
  const n = state.n;
  if (br < 0 || bc < 0 || br >= n || bc >= n) return 4;
  let missing = 0;
  for (const e of boxEdges(br, bc)) {
    if (!state.edges.has(edgeKey(e))) missing++;
  }
  return missing;
}

export function isBoxClosed(state, br, bc) {
  if (br < 0 || bc < 0 || br >= state.n || bc >= state.n) return false;
  return boxMissing(state, br, bc) === 0;
}

/** Cạnh chưa tô trên bàn → hợp lệ để đi. */
export function isLegal(state, edge) {
  const e = normEdge(edge);
  if (!e) return false;
  if (!isOnBoard(e, state.n)) return false;
  return !state.edges.has(edgeKey(e));
}

/** Danh sách cạnh còn chơi được. */
export function legalEdges(state) {
  const out = [];
  for (const e of allBoardEdges(state.n)) {
    if (!state.edges.has(edgeKey(e))) out.push(e);
  }
  return out;
}

/** Cạnh nào (nếu tô) sẽ là cạnh thứ 3 của một ô đang có 2 cạnh. */
export function createsThirdEdge(state, edge) {
  const e = normEdge(edge);
  if (!e) return false;
  if (!isLegal(state, e)) return false;
  const [r, c, o] = e;
  // Ô trên/dưới (cạnh ngang) hoặc ô trái/phải (cạnh dọc).
  for (const [br, bc] of cellsOfEdge(r, c, o)) {
    if (br < 0 || bc < 0 || br >= state.n || bc >= state.n) continue;
    if (state.boxes[br * state.n + bc]) continue;
    // Tô cạnh này biến ô 2 cạnh (thiếu 2) thành ô 3 cạnh (thiếu 1) → "hé nắp hộp".
    if (boxMissing(state, br, bc) === 2) return true;
  }
  return false;
}

/** Các ô đang đủ 3 cạnh (thiếu đúng 1 cạnh). */
export function thirdEdgeBoxes(state) {
  const out = [];
  for (let br = 0; br < state.n; br++) {
    for (let bc = 0; bc < state.n; bc++) {
      if (boxMissing(state, br, bc) === 1) {
        const missing = boxEdges(br, bc).find(
          (e) => !state.edges.has(edgeKey(e)),
        );
        out.push({ br, bc, edge: missing });
      }
    }
  }
  return out;
}

/**
 * Cạnh kín ô nào? Trả các ô (br, bc) mà cạnh `edge` là cạnh cuối cùng.
 *
 * Hàm này dùng được ở CẢ HAI thời điểm:
 *  - trước khi tô (state chưa có cạnh đó) → ô đang thiếu đúng 1 cạnh;
 *  - sau khi tô (state đã có cạnh đó, ví dụ state đã lưu từ trước) → ô đã kín mà cạnh
 *    này chính là cạnh cuối vừa được thêm vào.
 */
export function boxesClosedBy(state, edge) {
  const e = normEdge(edge);
  if (!e) return [];
  const [r, c, o] = e;
  const alreadyIn = state.edges.has(edgeKey(e));
  const out = [];
  for (const [br, bc] of cellsOfEdge(r, c, o)) {
    if (br < 0 || bc < 0 || br >= state.n || bc >= state.n) continue;
    if (state.boxes[br * state.n + bc]) continue;
    const missing = boxMissing(state, br, bc);
    const closesNow = alreadyIn ? missing === 0 : missing === 1;
    if (closesNow) out.push([br, bc]);
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Mutator — mọi thay đổi đi qua đây. Idempotent: cạnh đã tô → no-op.
 * ------------------------------------------------------------------------- */

/**
 * Tô một cạnh.
 * @returns {{ok:boolean, reason?:string, player?:string, closed?:Array<[number,number]>,
 *            keepsTurn?:boolean, turn?:string, turnSeq?:number, gameOver?:boolean, winner?:string|null}}
 */
export function applyMove(state, edge) {
  const e = normEdge(edge);
  if (!e) return { ok: false, reason: 'invalid' };
  if (!isOnBoard(e, state.n)) return { ok: false, reason: 'outside' };
  const key = edgeKey(e);
  // Idempotent: gọi 2 lần cùng cạnh → lần 2 no-op.
  if (state.edges.has(key)) return { ok: false, reason: 'taken' };
  if (isOver(state)) return { ok: false, reason: 'over' };

  const player = state.turn;
  // QUAN TRỌNG: tính ô kín TRƯỚC khi ghi cạnh vào bản đồ — boxesClosedBy đọc trạng thái
  // "trước nước đi" (ô còn thiếu đúng 1 cạnh). Ghi trước rồi mới tính sẽ luôn ra [].
  const closed = boxesClosedBy(state, e);
  state.edges.set(key, player);
  if (!state.firstMove) state.firstMove = { player, edge: e };
  for (const [br, bc] of closed) {
    // Một cạnh nằm giữa 2 ô: ô A đã kín từ trước, ô B mới kín ở đây. Chỉ ghi chủ cho ô
    // CHƯA có chủ — tô cạnh không bao giờ cướp ô đã kín của người khác.
    if (!state.boxes[br * state.n + bc]) state.boxes[br * state.n + bc] = player;
  }

  state.moveCount++;
  state.lastMove = { edge: e, player, closed, seq: state.turnSeq };
  const keepsTurn = closed.length > 0;
  if (!keepsTurn) state.turn = player === 'A' ? 'B' : 'A';
  state.turnSeq++;

  const over = legalEdges(state).length === 0;
  return {
    ok: true,
    player,
    edge: e,
    closed,
    keepsTurn,
    turn: state.turn,
    turnSeq: state.turnSeq,
    gameOver: over,
    winner: over ? getWinner(state) : null,
  };
}

/**
 * Mất lượt do hết giờ. Đổi lượt + tăng turnSeq để mọi timer cũ vô hiệu (chống race R-02).
 * @returns {{ok:boolean, reason?:string, turn?:string, turnSeq?:number, gameOver?:boolean, winner?:string|null}}
 */
export function passTurn(state) {
  if (isOver(state)) return { ok: false, reason: 'over' };
  const player = state.turn;
  state.turn = player === 'A' ? 'B' : 'A';
  state.turnSeq++;
  state.passedTurns++;
  return { ok: true, turn: state.turn, turnSeq: state.turnSeq, gameOver: false, winner: null };
}

/** Huỷ cạnh vừa tô (chỉ dùng cho tutorial: hoàn tác cạnh mồi). */
export function undoMove(state) {
  const last = state.lastMove;
  if (!last) return { ok: false, reason: 'empty' };
  state.edges.delete(edgeKey(last.edge));
  for (const [br, bc] of last.closed) {
    // Ô vừa đóng có thể ĐÃ thuộc người khác trước đó (cạnh nằm giữa 2 ô) — chỉ gỡ ô
    // chính người vừa đi chiếm được ở nước này.
    if (state.boxes[br * state.n + bc] === last.player) state.boxes[br * state.n + bc] = null;
  }
  state.turn = last.player;
  state.turnSeq++;
  state.moveCount = Math.max(0, state.moveCount - 1);
  state.lastMove = null;
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * Điểm & kết thúc
 * ------------------------------------------------------------------------- */

export function isOver(state) {
  return legalEdges(state).length === 0;
}

/** @returns {{A:number,B:number,total:number}} */
export function score(state) {
  let A = 0;
  let B = 0;
  for (const b of state.boxes) {
    if (b === 'A') A++;
    else if (b === 'B') B++;
  }
  return { A, B, total: A + B };
}

/** @returns {'A'|'B'|'draw'|null} null = ván chưa xong */
export function getWinner(state) {
  if (!isOver(state)) return null;
  const s = score(state);
  if (s.A > s.B) return 'A';
  if (s.B > s.A) return 'B';
  return 'draw';
}

export function remainingCount(state) {
  return legalEdges(state).length;
}

export function totalBoardEdges(n) {
  return 2 * n * (n + 1);
}

export function totalInteriorEdges(n) {
  return 2 * n * (n - 1);
}

/* ---------------------------------------------------------------------------
 * Serialize / deserialize (để replay, test, và học từ trạng thái)
 * ------------------------------------------------------------------------- */

export function serializeGame(state) {
  const moves = [];
  for (const [key, p] of state.edges) moves.push([key, p]);
  return {
    n: state.n,
    turn: state.turn,
    turnSeq: state.turnSeq,
    moveCount: state.moveCount,
    passedTurns: state.passedTurns,
    edges: moves,
    // Chủ từng ô được lưu TƯỜNG MINH: không suy ra được từ bản đồ cạnh (cạnh nằm giữa
    // 2 ô và ai đóng trước là chuyện của lịch sử, không phải của hình học).
    boxes: state.boxes.slice(),
  };
}

export function restoreGame(data) {
  const state = {
    n: data.n,
    edges: new Map(),
    boxes: new Array(data.n * data.n).fill(null),
    turn: data.turn === 'B' ? 'B' : 'A',
    turnSeq: Number(data.turnSeq) || 0,
    moveCount: Number(data.moveCount) || 0,
    passedTurns: Number(data.passedTurns) || 0,
    firstMove: null,
    lastMove: null,
  };
  for (const [key, p] of data.edges || []) state.edges.set(key, p);
  if (Array.isArray(data.boxes) && data.boxes.length === data.n * data.n) {
    // Bản lưu mới: dùng đúng chủ ô đã ghi.
    for (let i = 0; i < data.boxes.length; i++) {
      const b = data.boxes[i];
      state.boxes[i] = b === 'A' || b === 'B' ? b : null;
    }
  } else {
    // Bản lưu cũ (không có `boxes`): ô kín thì thuộc người tô cạnh cuối — suy ra từ bản đồ cạnh.
    for (let br = 0; br < state.n; br++) {
      for (let bc = 0; bc < state.n; bc++) {
        if (boxMissing(state, br, bc) === 0) state.boxes[br * state.n + bc] = boxState(state, br, bc).owner;
      }
    }
  }
  return state;
}

/** Snapshot bất biến cho UI. */
export function getState(state) {
  return {
    n: state.n,
    turn: state.turn,
    turnSeq: state.turnSeq,
    moveCount: state.moveCount,
    passedTurns: state.passedTurns,
    edges: new Map(state.edges),
    boxes: state.boxes.slice(),
    lastMove: state.lastMove,
    over: isOver(state),
    score: score(state),
    remaining: legalEdges(state).length,
  };
}

/** Chạy thử một nước trên bản copy (không đụng state gốc). */
export function simulate(state, edge) {
  const clone = cloneState(state);
  const res = applyMove(clone, edge);
  return { state: clone, res };
}

export function cloneState(state) {
  const clone = {
    n: state.n,
    edges: new Map(state.edges),
    boxes: state.boxes.slice(),
    turn: state.turn,
    turnSeq: state.turnSeq,
    moveCount: state.moveCount,
    passedTurns: state.passedTurns,
    firstMove: state.firstMove,
    lastMove: state.lastMove,
  };
  return clone;
}

/** Hai trạng thái giống nhau? (dùng trong test đối xứng) */
export function statesEqual(a, b) {
  if (a.n !== b.n || a.turn !== b.turn) return false;
  if (a.edges.size !== b.edges.size) return false;
  for (const [k, v] of a.edges) if (b.edges.get(k) !== v) return false;
  for (let i = 0; i < a.boxes.length; i++) if (a.boxes[i] !== b.boxes[i]) return false;
  return true;
}

/* ---------------------------------------------------------------------------
 * Truy vấn chuỗi (chain) — dùng cho AI Khó và chẩn đoán
 * ------------------------------------------------------------------------- */

/**
 * Tầm ảnh hưởng của một nước đi: nếu tô `edge`, liệt kê số ô kín được và mức độ
 * "mở" thêm cho đối thủ (số ô 3 cạnh phát sinh).
 */
export function analyzeMove(state, edge) {
  const closed = boxesClosedBy(state, edge);
  let opensThird = 0;
  if (closed.length === 0) {
    const [r, c, o] = normEdge(edge);
    for (const [br, bc] of cellsOfEdge(r, c, o)) {
      if (br < 0 || bc < 0 || br >= state.n || bc >= state.n) continue;
      if (boxState(state, br, bc).count === 2) opensThird++;
    }
  }
  return { closed: closed.length, opensThird };
}
