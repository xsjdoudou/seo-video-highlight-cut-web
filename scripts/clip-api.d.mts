import type { Connect } from 'vite'

/** 见 scripts/clip-api.mjs —— 上传、ASR、剪辑、烧字幕都在那一份实现里。 */
export function createClipApi(): Connect.NextHandleFunction
