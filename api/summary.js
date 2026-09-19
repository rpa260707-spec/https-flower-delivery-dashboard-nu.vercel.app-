import { get } from '@vercel/blob';

// 업무포털 위젯용 "집계 전용" API
//
// /api/deliveries 는 고인 성함·상주 연락처·빈소 같은 개인정보를 그대로 담고 있어
// 외부(포털)에 열어 주면 안 됩니다. 이 엔드포인트는 건수와 금액만 계산해서 내보내며
// 개인정보 항목은 한 건도 포함하지 않습니다.

const FILE_NAME = 'deliveries.json';

// 상태 코드가 화면 라벨과 다르게 매핑되어 있습니다. (index.html STATUS_OPTIONS 기준)
const STATUS_LABEL = {
  pending: '배송준비',
  processing: '배송중',
  completed: '배송요청',
  issue: '확인필요',
  cancelled: '배송완료'
};

function setHeaders(res) {
  // 숫자만 나가므로 어디서든 읽을 수 있게 열어 둡니다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // 5분 캐시 — 포털 방문자가 많아도 Blob 을 자주 읽지 않습니다.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode();
  return result;
}

async function readRows() {
  try {
    const blob = await get(FILE_NAME, { access: 'private' });
    if (!blob || !blob.stream) return [];

    const text = await streamToText(blob.stream);
    if (!text) return [];

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    return Array.isArray(parsed?.data) ? parsed.data : [];
  } catch (error) {
    const status = error?.status || error?.statusCode || error?.cause?.status;
    const message = String(error?.message || '').toLowerCase();

    if (status === 404 || message.includes('404') || message.includes('not found')) {
      return [];
    }

    throw error;
  }
}

function kstToday() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())}`;
}

function shiftDays(ymd, days) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: '허용되지 않은 메서드입니다.' });
  }

  try {
    const rows = await readRows();

    const today = kstToday();
    const thisYear = today.slice(0, 4);
    const thisMonth = today.slice(0, 7);
    const weekAgo = shiftDays(today, -7);

    const years = {};      // 연도별 건수·금액
    const months = {};     // 올해 월별 건수·금액
    const items = {};      // 품목별 건수·금액
    const statuses = {};   // 상태별 건수 (라벨 기준)

    let recent7 = 0;
    let lastDate = '';
    let total = 0;
    let totalAmount = 0;

    for (const r of rows) {
      const date = String(r?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const price = Number(r?.price) || 0;
      const year = date.slice(0, 4);
      const month = date.slice(0, 7);

      total += 1;
      totalAmount += price;

      if (!years[year]) years[year] = { count: 0, amount: 0 };
      years[year].count += 1;
      years[year].amount += price;

      if (year === thisYear) {
        if (!months[month]) months[month] = { count: 0, amount: 0 };
        months[month].count += 1;
        months[month].amount += price;
      }

      const item = String(r?.item || '미분류');
      if (!items[item]) items[item] = { count: 0, amount: 0 };
      items[item].count += 1;
      items[item].amount += price;

      const label = STATUS_LABEL[r?.status] || String(r?.status || '미지정');
      statuses[label] = (statuses[label] || 0) + 1;

      if (date >= weekAgo) recent7 += 1;
      if (date > lastDate) lastDate = date;
    }

    return res.status(200).json({
      success: true,
      asOf: today,
      basis: '신청일 기준',
      total,
      totalAmount,
      thisYear: years[thisYear] || { count: 0, amount: 0 },
      thisMonth: months[thisMonth] || { count: 0, amount: 0 },
      recent7,
      lastDate,
      years,
      months,
      items,
      statuses
    });
  } catch (error) {
    console.error('[summary api error]', error);
    return res.status(500).json({ success: false, message: '집계 중 오류가 발생했습니다.' });
  }
}
