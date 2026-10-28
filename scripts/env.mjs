// 读环境变量，**空字符串当成没设**。
//
// 为什么需要这么一个东西：.env.example 里好几项是留空的（PUBLIC_BASE= /
// OSS_PYTHON= / AUTH_PASS= …），注释写的是「留空即可，用默认值」。但留空的那一行
// 照样会进 process.env，值是 ''，而 `process.env.X ?? 默认值` 里的 `??` 只对
// undefined 生效——'' 算「设过了」，默认值永远轮不到。
//
// 踩过的两次：
//   * PUBLIC_BASE='' → 上传回执的 url 变成相对路径 /uploads/x.mp4 →
//     提交任务时被 /^https?:\/\// 挡掉，前端报「That video link doesn't look right」。
//     文件已经传上去了，所以日志里只有「上传完成」没有「新任务」，很难联想到是它。
//   * AUTH_PASS='' → Basic Auth 的密码变成空串，而不是随机生成的那个。
//
// 所以这里统一按「空白 = 没设」处理。真要把某一项显式设成空的场景，这个仓库里没有。

export function env(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') return fallback
  return value
}
