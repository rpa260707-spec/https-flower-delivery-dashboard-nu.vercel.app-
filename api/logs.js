import { put, list, get } from '@vercel/blob';

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
