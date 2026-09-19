import { put, list, get } from '@vercel/blob';
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


const FILE_NAME = 'logs.json';

// 변경이력 저장(POST)도 관리자 계정에서만 허용합니다.
const ADMIN_USER_NAME = '전략구매팀';

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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await list({
        prefix: FILE_NAME,
        limit: 1,
        access: 'private'
      });

      const file = result.blobs?.find((blob) => blob.pathname === FILE_NAME);

      if (!file) {
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const blob = await get(FILE_NAME, {
        access: 'private'
      });

      if (!blob || !blob.stream) {
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const text = await streamToText(blob.stream);
      const data = text ? JSON.parse(text) : [];

      return res.status(200).json({
        success: true,
        data: Array.isArray(data) ? data : []
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const requestUser = String(body.user || body.lastSavedBy || '').trim();

      if (requestUser !== ADMIN_USER_NAME) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: `조회 전용 계정입니다. 변경이력 저장은 관리자(${ADMIN_USER_NAME}) 계정에서만 가능합니다.`
        });
      }

      const data = Array.isArray(body.data) ? body.data : [];

      await put(FILE_NAME, JSON.stringify(data.slice(0, 30), null, 2), {
        access: 'private',
        ...BLOB_OPT,
        contentType: 'application/json',
        allowOverwrite: true
      });

      return res.status(200).json({
        success: true,
        message: '변경이력 저장 완료',
        count: Math.min(data.length, 30)
      });
    }

    return res.status(405).json({
      success: false,
      message: '허용되지 않은 메서드입니다.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
