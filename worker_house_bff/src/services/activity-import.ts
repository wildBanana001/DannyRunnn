const MAX_TEXT_LENGTH = 20_000;

export class ActivityImportError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = 'ActivityImportError';
  }
}

export interface ImportedActivityDraft {
  title: string;
  description: string;
  fullDescription: string;
  coverImage: string;
  gallery: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  price: number | null;
  maxParticipants: number | null;
  category: string;
  hostName: string;
  refundPolicy: string;
}

export interface ActivityImportResult {
  draft: ImportedActivityDraft;
  warnings: string[];
}

function cleanText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/[\u200b-\u200d\ufeff]/g, '')
    .split('\n').map((line) => line.replace(/[\t \u00a0]+/g, ' ').trim())
    .filter(Boolean).join('\n');
}

function field(lines: string[], names: string) {
  const pattern = new RegExp(`^[【\\[（(]?\\s*(?:${names})\\s*[】\\]）)]?\\s*[:：]?\\s*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const match = pattern.exec(lines[i]);
    if (match) return match[1].trim() || lines[i + 1] || '';
  }
  return '';
}

function validDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseActivityText(input: string): ActivityImportResult {
  const text = cleanText(input);
  if (/^https?:\/\/\S+$/i.test(text)) throw new ActivityImportError('请粘贴复制出来的推文正文，而不是文章链接');
  if (text.length < 10) throw new ActivityImportError('正文太短，请粘贴包含活动说明的完整推文');
  if (text.length > MAX_TEXT_LENGTH) throw new ActivityImportError('正文最多支持 20000 字，请精简后重试');
  const lines = text.split('\n');
  const warnings: string[] = [];
  const schedule = field(lines, '活动时间|活动日期|举办时间|日期|时间');
  const dates = [...schedule.matchAll(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/g)]
    .map((match) => `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`)
    .filter(validDate);
  const uniqueDates = [...new Set(dates)];
  const remainingSchedule = schedule.replace(/20\d{2}[年/.-]\d{1,2}[月/.-]\d{1,2}日?/g, '');
  const hasPartialEndDate = /\d+\s*[月日]/.test(remainingSchedule);
  const timeLine = field(lines, '活动时段|时段') || schedule;
  const times = [...timeLine.matchAll(/(?<!\d)([01]?\d|2[0-3])[:：]([0-5]\d)(?!\d)/g)]
    .map((match) => `${match[1].padStart(2, '0')}:${match[2]}`);
  const priceLine = field(lines, '活动费用|报名费用|报名费|活动价格|票价|费用|价格|单价');
  const prices = [...priceLine.matchAll(/(?:[¥￥]\s*(\d+(?:\.\d{1,2})?)(?![\d.])|(\d+(?:\.\d{1,2})?)(?![\d.])\s*元)/g)]
    .map((match) => Number(match[1] || match[2]));
  if (!prices.length && /^\d+(?:\.\d{1,2})?$/.test(priceLine)) prices.push(Number(priceLine));
  const uniquePrices = [...new Set(prices)];
  const priceNumbers = [...priceLine.matchAll(/\d+(?:\.\d+)?/g)];
  const price = /^(免费|免票|0元)[。！!]?\s*$/.test(priceLine) ? 0
    : uniquePrices.length === 1 && priceNumbers.length === 1
      && Number(priceNumbers[0][0]) === uniquePrices[0] ? uniquePrices[0] : null;
  const capacityLine = field(lines, '活动人数|人数上限|限定人数|招募人数|名额|人数|限额');
  const capacities = [...capacityLine.matchAll(/(?<!\d)(\d+)\s*(?:人|位|个名额)/g)].map((match) => Number(match[1]));
  if (!capacities.length && /^\d+$/.test(capacityLine)) capacities.push(Number(capacityLine));
  const capacity = capacities.length === 1 && [...capacityLine.matchAll(/\d+/g)].length === 1
    && Number.isSafeInteger(capacities[0]) && capacities[0] > 0
    ? capacities[0] : null;
  const title = (field(lines, '活动标题|活动名称|标题') || lines[0]).slice(0, 100);
  const narrative = lines.filter((line) => line !== title
    && !/^[【\[（(]?\s*(?:活动时间|活动日期|活动地点|详细地址|活动费用|活动人数|活动价格|活动分类|活动类型|主理人|主办方|退款说明|退款政策|退款规则|日期|时间|地点|地址|费用|价格|人数|名额|票价|报名费)\s*[】\]）):：]/.test(line));
  const draft: ImportedActivityDraft = {
    title,
    description: (narrative.join(' ') || title).slice(0, 140),
    fullDescription: text,
    coverImage: '',
    gallery: [],
    startDate: uniqueDates.length <= 2 ? uniqueDates[0] || '' : '',
    endDate: uniqueDates.length <= 2 && !hasPartialEndDate ? uniqueDates[1] || uniqueDates[0] || '' : '',
    startTime: times.length === 2 ? times[0] : '',
    endTime: times.length === 2 ? times[1] : '',
    location: field(lines, '活动地点|集合地点|举办地点|地点').slice(0, 200),
    address: field(lines, '详细地址|地址').slice(0, 300),
    price,
    maxParticipants: capacity,
    category: field(lines, '活动分类|活动类型|分类').slice(0, 40) || '社群活动',
    hostName: field(lines, '活动主理人|主理人|主办方').slice(0, 80),
    refundPolicy: field(lines, '退款说明|退款政策|退款规则').slice(0, 1000),
  };
  if (!draft.startDate || !draft.endDate) warnings.push('未识别到完整明确的活动日期，请填写准确的开始和结束日期（含年份）。');
  if (!draft.startTime || !draft.endTime) warnings.push('未识别到唯一的起止时间，请核对活动时段。');
  if (price === null) warnings.push(priceNumbers.length > 1 ? '推文包含多个价格，请选择本次报名使用的单价。' : '未识别到明确价格，请填写单价；免费活动请填 0。');
  if (capacity === null) warnings.push('未识别到明确名额，请填写人数上限。');
  if (!draft.location) warnings.push('未识别到活动地点，请补充。');
  if (!draft.coverImage) warnings.push('正文不包含可用封面，请上传封面或填写图片链接。');
  return { draft, warnings };
}

export async function importActivityArticle(input: unknown): Promise<ActivityImportResult> {
  if (!input || typeof input !== 'object') throw new ActivityImportError('请粘贴推文正文');
  const { type, content } = input as Record<string, unknown>;
  if (type !== 'text') throw new ActivityImportError('仅支持粘贴推文正文');
  if (typeof content !== 'string' || !content.trim()) throw new ActivityImportError('请先粘贴推文正文');
  return parseActivityText(content);
}
