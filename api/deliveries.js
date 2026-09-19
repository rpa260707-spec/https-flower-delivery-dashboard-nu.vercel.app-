import { put, get } from '@vercel/blob';
/* Vercel Blob 자격 찾기
   Storage 를 연결할 때 접두사가 붙으면(`housing_STORE_ID`, `procurement_STORE_ID` …)
   기본 이름(BLOB_READ_WRITE_TOKEN)이 없어서 SDK 가 엉뚱한 자격으로 붙고 403 이 납니다.
   그래서 기본 이름 → 접두사가 뭐든 끝이 맞는 이름 순으로 찾아 명시적으로 넘깁니다. */
const BLOB_OPT = (() => {
  const pick = (suffix) => {
    if (process.env['BLOB' + suffix]) return process.env['BLOB' + suffix];
    const key = Object.keys(process.env).find((n) => n.endsWith(suffix) && process.env[n]);
    return key ? process.env[key] : undefined;
  };
  const token = pick('_READ_WRITE_TOKEN');
  const storeId = pick('_STORE_ID');
  const o = {};
  if (token) o.token = token;
  else if (storeId) o.storeId = storeId;
  return o;
})();


const FILE_NAME = 'deliveries.json';

// 저장(POST)은 관리자 계정에서만 허용합니다. 일반 이름으로 로그인한 사용자는 조회만 가능합니다.
const ADMIN_USER_NAMES = ['전략구매팀', '관리자'];

function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

// 이 엔드포인트는 고인 성함·상주 연락처·빈소 등 개인정보를 그대로 담고 있으므로
// 외부 출처(CORS)를 열지 않습니다. 포털 위젯은 집계만 내보내는 /api/summary 를 씁니다.

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

function normalizeSavedPayload(raw) {
  // 기존 버전 호환:
  // 예전에는 deliveries.json에 배열만 저장했습니다.

  if (Array.isArray(raw)) {
    return {
      data: raw,
      lastSavedAt: '',
      lastSavedBy: '',
      saveVersion: ''
    };
  }

  if (raw && typeof raw === 'object') {
    return {
      data: Array.isArray(raw.data) ? raw.data : [],
      lastSavedAt: String(raw.lastSavedAt || ''),
      lastSavedBy: String(raw.lastSavedBy || ''),
      saveVersion: String(raw.saveVersion || raw.lastSavedAt || '')
    };
  }

  return {
    data: [],
    lastSavedAt: '',
    lastSavedBy: '',
    saveVersion: ''
  };
}

function emptySavedPayload() {
  return {
    data: [],
    lastSavedAt: '',
    lastSavedBy: '',
    saveVersion: ''
  };
}

async function readSavedPayload() {
  try {
    const blob = await get(FILE_NAME, {
      access: 'private'
    });

    if (!blob || !blob.stream) {
      return emptySavedPayload();
    }

    const text = await streamToText(blob.stream);
    const parsed = text ? JSON.parse(text) : [];
    return normalizeSavedPayload(parsed);
  } catch (error) {
    // 파일이 아직 한 번도 생성되지 않은 초기 상태만 빈 데이터로 처리합니다.
    // 그 외 오류는 실제 서버 문제이므로 숨기지 않고 상위 catch로 전달합니다.
    const status = error?.status || error?.statusCode || error?.cause?.status || error?.cause?.statusCode;
    const message = String(error?.message || '');

    if (
      status === 404 ||
      message.includes('404') ||
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('no such')
    ) {
      return emptySavedPayload();
    }

    throw error;
  }
}

function nowKstText() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');

  return `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())}`;
}

export default async function handler(req, res) {
  setNoStoreHeaders(res);

  try {
    if (req.method === 'GET') {
      const saved = await readSavedPayload();

      return res.status(200).json({
        success: true,
        data: saved.data,
        lastSavedAt: saved.lastSavedAt,
        lastSavedBy: saved.lastSavedBy,
        saveVersion: saved.saveVersion
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const data = Array.isArray(body.data) ? body.data : [];
      const lastSavedAt = nowKstText();
      const lastSavedBy = String(body.lastSavedBy || body.user || '').trim();
      const expectedSaveVersion = String(body.expectedSaveVersion || '').trim();

      if (!ADMIN_USER_NAMES.includes(lastSavedBy)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: `조회 전용 계정입니다. 저장은 관리자(${ADMIN_USER_NAMES.join(' 또는 ')}) 계정에서만 가능합니다.`
        });
      }

      const currentSaved = await readSavedPayload();
      const currentVersion = String(currentSaved.saveVersion || currentSaved.lastSavedAt || '').trim();

      if (currentVersion && currentVersion !== expectedSaveVersion) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: '다른 사용자가 먼저 저장했습니다.',
          latestSavedAt: currentSaved.lastSavedAt,
          latestSavedBy: currentSaved.lastSavedBy,
          latestSaveVersion: currentVersion
        });
      }

      const saveVersion = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const payload = {
        data,
        lastSavedAt,
        lastSavedBy,
        saveVersion
      };

      await put(FILE_NAME, JSON.stringify(payload, null, 2), {
        access: 'private',
        ...BLOB_OPT,
        contentType: 'application/json',
        allowOverwrite: true
      });

      return res.status(200).json({
        success: true,
        message: '저장 완료',
        count: data.length,
        lastSavedAt,
        lastSavedBy,
        saveVersion
      });
    }

    return res.status(405).json({
      success: false,
      message: '허용되지 않은 메서드입니다.'
    });
  } catch (error) {
    console.error('[deliveries api error]', error);

    return res.status(500).json({
      success: false,
      message: error.message || '서버 오류가 발생했습니다.'
    });
  }
}
