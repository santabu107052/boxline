/**
 * tutorial.js — nội dung tutorial (docs/30-TUTORIAL.md), THUẦN DỮ LIỆU (không DOM, không Canvas).
 *
 * Mọi chuỗi tiếng Việt của tutorial nằm ở đây, không rải trong ui.js.
 * `TUTORIAL_STEPS` là JSON y nguyên docs/30-TUTORIAL.md §3 (dùng cho cả test lẫn runtime).
 *
 * Quy ước cạnh: `[r, c, 'H'|'V']` — điểm neo là góc trên-trái (xem engine.js).
 */

/* ---------------------------------------------------------------------------
 * §3 — Hằng số TUTORIAL_STEPS (nguyên văn JSON của tài liệu)
 * ------------------------------------------------------------------------- */
export const TUTORIAL_STEPS = {
  boardSize: 3,
  player: 'player',
  opponent: 'com',
  storageKey: 'db_tutorial_done',
  steps: [
    {
      id: 1,
      goal: 'edge',
      seedEdges: [],
      allowedEdges: [
        [1, 0, 'H'], [1, 1, 'H'], [1, 2, 'H'],
        [2, 0, 'H'], [2, 1, 'H'], [2, 2, 'H'],
      ],
      decoyEdges: [],
      aiMoves: [],
      title: 'Bước 1/5',
      instruction: 'Bàn chỉ có các chấm tròn. Bấm vào khoảng giữa hai chấm để nối một cạnh.',
      hint: 'Mỗi lần chỉ tô được một cạnh. Cạnh sát mép bàn không tô được.',
      successLine: 'Xong. Lượt chuyển sang máy.',
      advanceOn: 'randomEdgeChosen',
      advanceDelayMs: 700,
    },
    {
      id: 2,
      goal: 'box',
      seedEdges: [
        [1, 0, 'H'], [2, 1, 'H'],
      ],
      allowedEdges: [
        [0, 1, 'V'],
      ],
      decoyEdges: [],
      aiMoves: [],
      title: 'Bước 2/5',
      instruction: 'Ô góc này mới có 2 cạnh, còn thiếu 2 cạnh nữa mới kín. Cả 4 cạnh bạn đều phải tô.',
      hint: 'Kín 4 cạnh là mình được ô.',
      successLine: 'Kín ô rồi! Ô đó là của bạn, và bạn được đi tiếp.',
      advanceOn: 'boxCaptured',
      advanceDelayMs: 1200,
    },
    {
      id: 3,
      goal: 'turn',
      seedEdges: [
        [1, 0, 'H'], [0, 1, 'V'],
      ],
      allowedEdges: [
        [2, 1, 'H'], [1, 2, 'V'],
      ],
      decoyEdges: [],
      aiMoves: [
        [1, 2, 'V'],
      ],
      aiReply: {
        '[2,1,H]': [[1, 2, 'V']],
        '[1,2,V]': [[2, 1, 'H']],
      },
      aiDelayMs: 600,
      title: 'Bước 3/5',
      instruction: 'Bạn vừa kín ô nên vẫn là lượt bạn. Ô đó đủ 4 cạnh đều do bạn tô. Tô thêm một cạnh nữa đi.',
      hint: 'Đây là lần đi thứ hai liên tiếp của bạn.',
      successLine: 'Đó là chơi luân phiên: hết lượt thì đến máy.',
      advanceOn: 'turnEnded',
      advanceDelayMs: 900,
    },
    {
      id: 4,
      goal: 'avoid_third',
      seedEdges: [
        [1, 1, 'H'], [2, 0, 'H'],
      ],
      allowedEdges: [
        [2, 1, 'H'], [1, 2, 'V'],
      ],
      decoyEdges: [
        [2, 1, 'V'],
      ],
      dangerBox: [2, 0],
      aiMoves: [],
      title: 'Bước 4/5',
      instruction: 'Ô góc dưới-trái đã có 3 cạnh. Đừng tô cạnh cuối của ô đó — tô một cạnh khác an toàn hơn.',
      hint: '3 cạnh = gần như của máy.',
      successLine: 'Tô cạnh thứ 3 là mở ô cho người khác. Gặp ô 3 cạnh thì đi chỗ khác.',
      failLine: 'Cạnh đó mở ô cho máy mất rồi. Thử lại nhé.',
      advanceOn: 'dangerousEdgeAvoided',
      advanceDelayMs: 900,
      failUndoDelayMs: 900,
    },
    {
      id: 5,
      goal: 'options',
      seedEdges: [],
      seatFromStateOf: 4,
      allowedEdges: [],
      decoyEdges: [],
      aiMoves: [],
      controls: ['timeLimit', 'boardSize', 'difficulty'],
      title: 'Bước 5/5',
      instruction: 'Bàn chỉ có các chấm tròn — bạn nối cạnh giữa chúng. Cạnh sát mép bàn là viền, không tô được.',
      hint: 'Thử bấm vào hàng tùy chọn bên dưới: thời gian, kích thước, độ khó.',
      successLine: 'Hết hướng dẫn. Chơi ván đầu tiên nhé!',
      advanceOn: 'optionsExplored',
      advanceDelayMs: 0,
    },
  ],
};

/** Tên hiển thị của "người chơi" và "máy" trong tutorial. */
export const TUTORIAL_LABELS = Object.freeze({
  player: 'Bạn',
  com: 'máy',
  playerSymbol: 'A',
  comSymbol: 'B',
  skip: 'Bỏ qua hướng dẫn',
  skipShort: 'Bỏ qua',
  finish: 'Xong',
  finishCta: 'Chơi ván đầu tiên',
  comThinking: 'Đến lượt máy…',
  comDone: 'Lại đến lượt bạn.',
  comMoved: 'Máy vừa đi.',
});

/** Câu nhắc người chơi ở bước 5 khi chưa chạm control nào. */
export const TUTORIAL_STEP5_IDLE_HINT = 'Thử bấm vào hàng tùy chọn bên dưới: thời gian, kích thước, độ khó.';
/** Đổi dòng phụ sau khi người chơi đã bấm 1 control (docs/30-TUTORIAL.md Bước 5). */
export const TUTORIAL_STEP5_DONE_HINT = 'Bấm Xong khi bạn đã xem.';

/** Thời gian chờ tối đa cho phản hồi của máy ở bước 3 (an toàn nếu timer bị trôi). */
export const TUTORIAL_STEP3_AI_MAX_WAIT_MS = 3000;

/* ---------------------------------------------------------------------------
 * §4 — Màn "Hướng dẫn nhanh": 3 thẻ, hình vẽ canvas tĩnh
 * ------------------------------------------------------------------------- */
export const QUICK_GUIDE = Object.freeze({
  title: 'Hướng dẫn nhanh',
  subtitle: 'Ba thẻ, đọc trong khoảng 20 giây.',
  cta: 'Chơi thử Tutorial',
  skip: 'Bỏ qua',
  cards: [
    {
      id: 1,
      title: 'Tô một đoạn thẳng',
      text: 'Mỗi lượt, bạn tô một đoạn thẳng còn trống.',
      // Minh hoạ: bàn 3×3 CHỈ có các chấm (không có viền vẽ sẵn), một cạnh dọc ở giữa bên trái
      // vừa tô màu xanh dương.
      illustration: 'edge',
      // §4: "một cạnh dọc ở giữa bên trái vừa tô màu xanh dương" → cạnh dọc [0,1,'V'].
      seedEdges: [[0, 1, 'V']],
      seedOwner: 'A',
      highlightEdge: [0, 1, 'V'],
    },
    {
      id: 2,
      title: 'Kín 4 cạnh được một ô',
      text: 'Ô đủ 4 cạnh thì thuộc về người tô cạnh cuối, và người đó đi tiếp.',
      // Minh hoạ: ô góc trên-trái đã tô kín, ruột xanh nhạt, dấu tick mảnh giữa ô.
      illustration: 'box',
      seedEdges: [[1, 0, 'H'], [0, 1, 'V']],
      seedOwner: 'A',
      highlightBox: [0, 0],
      showTick: true,
    },
    {
      id: 3,
      title: 'Thấy ô 3 cạnh thì tránh',
      text: 'Để ô thiếu đúng 1 cạnh là dâng ô cho đối thủ.',
      // Minh hoạ: ô góc dưới-phải có 3 cạnh đã tô, viền ngoài cam mảnh + mũi tên cong chỉ ra xa.
      illustration: 'avoid',
      // Ô góc dưới-phải (2,2) là ô ở GÓC nên chỉ cần 2 cạnh trong: tô 1 cạnh → còn thiếu đúng 1.
      // Cạnh còn lại [2,2,'V'] là "cạnh thứ 3" đang bỏ ngỏ (dâng ô cho đối thủ).
      seedEdges: [[2, 2, 'H']],
      seedOwner: 'B',
      highlightBox: [2, 2],
      showAvoidArrow: true,
      warnEdges: [[2, 2, 'V']],
    },
  ],
});

/* ---------------------------------------------------------------------------
 * §5.2 — Bảng luật ngắn (modal "?")
 * ------------------------------------------------------------------------- */
export const RULES_SHORT = Object.freeze([
  'Mỗi lượt: tô một cạnh còn trống.',
  'Ô đủ 4 cạnh: ô đó là của người tô cạnh cuối.',
  'Kín ô thì được đi tiếp.',
  'Nhiều ô hơn thì thắng.',
]);

export const RULES_MODAL = Object.freeze({
  title: 'Luật chơi',
  openGlossary: 'Đọc bảng từ ngữ',
  close: 'Đóng',
});

/* ---------------------------------------------------------------------------
 * §5.3 — Câu "Gợi ý" theo thứ tự ưu tiên (dừng ở câu đầu tiên đúng)
 * ------------------------------------------------------------------------- */
export const HINT_LINES = Object.freeze([
  {
    priority: 1,
    id: 'capture',
    when: 'Có ô đang 3 cạnh và cạnh thứ 4 là "món ăn" của mình (mình tô được ngay)',
    text: 'Có một ô đang thiếu đúng một cạnh. Tô nốt cạnh đó đi.',
  },
  {
    priority: 2,
    id: 'danger',
    when: 'Có ô 3 cạnh không thuộc mình (nguy hiểm)',
    text: 'Có ô đã 3 cạnh. Cẩn thận, đừng tô cạnh cuối của ô đó.',
  },
  {
    priority: 3,
    id: 'middle',
    when: 'Không có ô 3 cạnh nào',
    text: 'Tô ở giữa bàn trước, tránh tạo ô đủ 3 cạnh.',
  },
  {
    priority: 4,
    id: 'low',
    when: 'Còn rất ít cạnh',
    text: 'Sắp hết rồi. Đếm số ô hai bên để biết mình đang hơn hay kém.',
  },
]);

/** Nhãn nút gợi ý. */
export const HINT_LABELS = Object.freeze({
  hint: 'Gợi ý',
  exhausted: 'Hết gợi ý',
  counter: (left, total) => `Còn ${left}/${total} gợi ý`,
});

/* ---------------------------------------------------------------------------
 * §5.1 — Tooltip ngữ cảnh lần đầu
 * ------------------------------------------------------------------------- */
export const FIRST_TOOLTIP = Object.freeze({
  text: 'Bàn còn nhiều cạnh trống. Tô thoải mái ở giữa, để ý đừng làm ô nào đủ 3 cạnh.',
  close: 'Đã hiểu',
});

/* ---------------------------------------------------------------------------
 * §6 — Bảng thuật ngữ cho người mới
 * ------------------------------------------------------------------------- */
export const GLOSSARY = Object.freeze({
  heading: 'Từ ngữ trong game',
  metaphor:
    'Mỗi ô là một cái hộp, cạnh là thanh ghép của nắp hộp. Ghép đủ 4 thanh thì hộp đóng lại và phần thưởng là của mình.',
  metaphorCaveat:
    'Lưu ý: mọi ô đều cần đủ 4 cạnh do hai bên tô — kể cả ô ở góc. Bàn chỉ có các chấm, không có sẵn cạnh nào.',
  entries: [
    {
      term: 'Cạnh',
      plain: 'Đoạn thẳng nối hai chấm. Tô một cạnh mỗi lượt.',
      metaphor: 'Một thanh ghép của nắp hộp.',
    },
    {
      term: 'Ô',
      plain: 'Hình vuông do 4 cạnh ghép lại.',
      metaphor: 'Một cái hộp.',
    },
    {
      term: 'Mép bàn',
      plain: 'Cạnh nằm sát mép ngoài cùng của bàn. Không tô được, không tính điểm — bàn chỉ có các chấm để nối.',
      metaphor: 'Mép của tờ giấy — không phải thanh ghép của hộp nào.',
    },
    {
      term: 'Giữ lượt',
      plain: 'Kín được ô thì được đi ngay một lần nữa, không mất lượt.',
      metaphor: 'Đóng xong một hộp thì được chơi thêm lượt như phần thưởng.',
    },
    {
      term: 'Cạnh thứ 3 (cạnh xấu)',
      plain: 'Cạnh làm cho một ô chỉ còn thiếu 1 cạnh. Tô nó là dọn sẵn ô cho đối thủ.',
      metaphor: 'Bạn hé nắp hộp lên — người sau chỉ việc đóng lại và lấy hộp.',
    },
    {
      term: 'Chuỗi',
      plain: 'Một dãy ô dính nhau, mỗi lần đóng ô này lại mở sẵn ô kế tiếp. Ai đóng ô đầu chuỗi thì ăn gần cả dãy.',
      metaphor: 'Một dãy hộp xếp liền, mở hộp này là lộ ra hộp sau.',
    },
  ],
});

/* ---------------------------------------------------------------------------
 * Truy vấn / chuyển hoá dữ liệu (thuần, test được)
 * ------------------------------------------------------------------------- */

/** Lấy bước theo id (1..5). Trả null nếu không có. */
export function getStep(id) {
  return TUTORIAL_STEPS.steps.find((s) => s.id === id) || null;
}

/** Số bước của tutorial. */
export function stepCount() {
  return TUTORIAL_STEPS.steps.length;
}

const edgeKeyOf = (e) => `${e[2]}${e[0]},${e[1]}`;

/** Có cạnh `edge` trong danh sách không. */
export function listHasEdge(list, edge) {
  const k = edgeKeyOf(edge);
  return (list || []).some((x) => edgeKeyOf(x) === k);
}

/** Nhãn "Cạnh ngang hàng r cột c +1, chưa tô" — dùng cho aria-label của lưới ẩn. */
export function describeEdge(edge) {
  const [r, c, o] = edge;
  if (o === 'H') return `Cạnh ngang hàng ${r + 1} cột ${c + 1}`;
  return `Cạnh dọc hàng ${r + 1} cột ${c + 1}`;
}

/** Câu hướng dẫn của một bước, đúng nguyên văn. */
export function instructionOf(stepId) {
  const s = getStep(stepId);
  return s ? s.instruction : '';
}

/** Câu nhãn phụ của một bước. */
export function hintOf(stepId) {
  const s = getStep(stepId);
  return s ? s.hint : '';
}

/**
 * Chọn câu "Gợi ý" theo docs/30-TUTORIAL.md §5.3.
 * Thứ tự ưu tiên: 1) mình ăn được ô 3 cạnh → 2) có ô 3 cạnh (nguy hiểm) →
 * 3) không có ô 3 cạnh nào → 4) còn rất ít cạnh.
 *
 * @param {{myCapturable:number, opponentThird:number, anyThird:number, remaining:number, total:number}} info
 * @returns {{priority:number, id:string, text:string}}
 */
export function pickHintLine(info) {
  const {
    myCapturable = 0,
    opponentThird = 0,
    anyThird = 0,
    remaining = Infinity,
    total = Infinity,
  } = info || {};
  const low = Number.isFinite(total) && total > 0 && remaining <= Math.max(2, Math.ceil(total * 0.2));
  // Câu 4 "còn rất ít cạnh" chỉ dùng khi không còn tình huống 3 cạnh nào (tài liệu xếp nó cuối
  // bảng; khi có ô 3 cạnh thì câu 1–2 luôn là lời khuyên hữu ích hơn).
  if (anyThird === 0 && low) return HINT_LINES[3];
  if (myCapturable > 0) return HINT_LINES[0];
  if (opponentThird > 0 && opponentThird === anyThird) return HINT_LINES[1];
  if (anyThird > 0) return HINT_LINES[1];
  return HINT_LINES[2];
}
