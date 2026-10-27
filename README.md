# seo-video-highlight-cut-web

高光剪辑站点的前端 + 一层薄薄的编排服务（`scripts/clip-api.mjs`）。

## 它跑在哪儿

```
  海外机器                                     国内 GPU 机器
┌────────────────────────┐                 ┌──────────────────────┐
│ 浏览器 ← vite / dist   │                 │ seo_server.py :10080 │
│          ↕             │  ① HTTP + 令牌  │  （腾讯 ASR + 剪辑） │
│ clip-api.mjs           │ ───────────────▶│                      │
│   └ oss_upload.py      │                 └──────────┬───────────┘
└──────────┬─────────────┘                            │
           │ ② 上传源视频                   ③ 下载源视频 / 回传成片
           ▼                                          ▼
        ┌──────────────── 阿里云 OSS（公网接入点）────────────────┐
        └──────────────────────────────────────────────────────┘
```

国内那台是阿里云 ECS `i-uf659g4jleurwg5zoboz`（cn-shanghai），EIP `101.132.167.193`。
**安全组只放通了 10080**，所以跨境那一跳走 10080，不是 `seo_server.py` 默认的 8649。

跨境的只有 ① 和 ②，都是普通 HTTP，视频字节走 OSS 不走这条链路。

三件事决定了海外机器能不能跑通：

1. **① 要带令牌。** `seo_server.py` 配了 `SEO_TOKEN` 之后，不带令牌的请求一律 `401`。
   两边的值必须一模一样。
2. **① 的端口是 10080。** `seo_server.py` 读 `os.getenv("SEO_PORT", "8649")`，默认值是
   8649，但安全组没放通 8649。国内起服务时必须 `SEO_PORT=10080`，海外的 `SEO_URL`
   也要跟着写 `:10080`。
3. **② 必须用 OSS 公网接入点。** 默认那套配置从内网 Nacos 读，给的是
   `oss-cn-shanghai-internal.aliyuncs.com`，只在阿里云 VPC 内部可达。海外机器连不上，
   而且报错是连接超时，看不出原因。所以 `OSS_*` 必须在环境变量里设齐，
   设齐了就完全不碰 Nacos。

### 国内那边怎么起

```bash
cd /datadisk1/xieshiji/code/seo-jogg-video-highlight-cut
SEO_PORT=10080 SEO_TOKEN=<和海外同一个值> python seo_server.py
```

`make_server("", port, app)` 绑的是 `0.0.0.0`，所以起好之后 10080 就对公网开着了，
挡在前面的只有 `SEO_TOKEN`。启动日志里必须看到这一行：

```
接口鉴权已开启，调用方需要带上 Authorization: Bearer <SEO_TOKEN>
```

看到的是 `未配置 SEO_TOKEN，接口无鉴权` 就立刻停掉——那种状态下任何人扫到
`101.132.167.193:10080` 都能白嫖这台机器的 GPU。

## 环境变量

所有配置都走环境变量，没有配置文件格式要学。完整清单和说明在 [.env.example](.env.example)。

**变量名一律不要加 `VITE_` 前缀。** vite 的 `envPrefix` 默认就是 `VITE_`，带这个前缀的值
会被编译进浏览器能下载到的 JS 里，令牌等于公开。（`npm run build` 后可以自己
`grep -r '你的令牌' dist/` 验一下，正常情况下搜不到。）

三种设法，按场景选：

| 场景 | 做法 |
| --- | --- |
| 本机开发 | `cp .env.example .env && chmod 600 .env`，然后照常 `npm run dev` |
| systemd 托管 | 写 `/etc/seo-video-highlight/web.env`，unit 里用 `EnvironmentFile=`，见 [deploy/](deploy/) |
| 临时试一下 | `SEO_TOKEN=xxx npm run dev`，优先级高于 `.env` |

`.env` 已经在 `.gitignore` 里。**真实令牌只写 `.env`，不要写进 `.env.example`、
不要写进任何会提交的文件。**

### `.env` 是怎么被读到的

`npm run dev` / `preview` / `clip-api` 都经过 `scripts/with-env.mjs`：读 `.env` 塞进
`process.env`，再把真正的命令当子进程起来。文件不存在就跳过，本机不配也能跑。

绕这一圈是因为 node 原生的 `--env-file` 在这里用不了：dev 模式下 `clip-api` 是被
`vite.config.ts` 挂进 **vite 进程**里的（见那边的 `configureServer`），给 vite 传 node
参数只能走 `NODE_OPTIONS`，而 node 明确拒绝 `NODE_OPTIONS` 里出现 `--env-file`。

用 systemd 的 `EnvironmentFile=` 时不需要这一层，unit 里直接 `ExecStart=node scripts/clip-api.mjs`。

## 本机开发

```bash
npm install
npm run prepare:media     # 生成演示素材，可选，约 170MB
cp .env.example .env && chmod 600 .env
npm run dev               # http://127.0.0.1:10050
```

dev 模式是**一个进程**：vite 和 clip-api 在一起。

`npm run preview` 那套是**三个进程**，各自需要的变量不同：

| 进程 | 命令 | 要 `SEO_TOKEN` 吗 |
| --- | --- | --- |
| 静态站点 | `npx vite preview`（:4173） | 不要 |
| 编排服务 | `npm run clip-api`（:10051） | **要** |
| 访问口令代理 | `npm run auth-proxy`（:10060） | 不要 |

## 部署到海外机器

```bash
# 依赖
#   node >= 20、python3、ffmpeg、fonts-noto-cjk（烧中文字幕要）
#   pip install oss2

git clone https://github.com/xsjdoudou/seo-video-highlight-cut-web.git /srv/seo-video-highlight-cut-web
cd /srv/seo-video-highlight-cut-web
npm ci
npm run build

sudo mkdir -p /etc/seo-video-highlight
sudo cp .env.example /etc/seo-video-highlight/web.env
sudo vi   /etc/seo-video-highlight/web.env   # 填 SEO_URL / SEO_TOKEN / PUBLIC_BASE / OSS_*
sudo chmod 600 /etc/seo-video-highlight/web.env
```

抄 `.env.example` 过去时注意 systemd 的 `EnvironmentFile` 语法比 shell 严：不要写
`export`，也不要在值后面跟 ` # 注释`。整行注释没问题。

先验凭证和链路，再起服务——这两步能把大部分部署问题挡在前面：

```bash
npm run check:seo        # SEO_URL 格式 → 连通性 → 令牌，三步分开报
npm run check:oss        # OSS 凭证来源 / endpoint / bucket
```

`check:seo` 全程不打印令牌，只说它好不好使。它第三步是 GET 一个随机的 `task_id`：
拿到 `404 task not found` 说明令牌已经被服务端认了（这个 id 本来就不存在），
拿到 `401` 就是令牌不对。整个过程不创建任务，也不占 GPU。

`check:oss` 打印的**来源必须是「环境变量」**，如果显示走了 Nacos 说明 `OSS_*` 没设齐，
那条路在海外机器上早晚会断。

systemd 那份配置文件要这样验：

```bash
ENV_FILE=/etc/seo-video-highlight/web.env npm run check:seo
```

然后起服务：

```bash
sudo cp deploy/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clip-api web
```

### 开鉴权的顺序

两边配置有先后，搞反了站点会在中间那段时间全挂：

1. 先在**海外机器**上设好 `SEO_TOKEN`（这时国内还没开鉴权，带着令牌发请求也无所谓，
   没开鉴权的服务端会直接忽略这个头）。
2. 再把同一个值写进**国内**的配置（Nacos 的 `seo_token`，或者 `seo_server.py` 进程的
   `SEO_TOKEN` 环境变量）。
3. 最后用 `SEO_PORT=10080` 重启国内那个服务。启动日志里会打一行
   `接口鉴权已开启，调用方需要带上 Authorization: Bearer <SEO_TOKEN>`，
   没看到这行就是没读到配置，这时候 10080 是裸着对公网开的，赶紧停掉。
4. 回到**海外机器**跑 `npm run check:seo`，三步全绿才算通。

第 4 步必须在海外机器上跑，不能在国内那台上自测：那台机器连自己的 EIP 是不通的
（`101.132.167.193:22` 从本机都连不上，hairpin NAT 没开），所以在国内怎么试都看不出
安全组到底放通了没有。

令牌用 `openssl rand -hex 32` 生成。**不要**把生成的值贴进聊天记录、issue 或者任何
会留档的地方——贴过就等于泄漏，重新生成一个。两边核对是不是同一个值的时候也别互相贴明文，
各自 `printf %s "$SEO_TOKEN" | sha256sum` 比对前 12 位就够了。

> 跨境这一跳现在是明文 HTTP，令牌和视频地址在路上是能被看到的。想上 TLS 的话，
> Let's Encrypt 的自动签发需要 80（HTTP-01）或 443（TLS-ALPN-01），只开 10080 签不下来——
> 要么安全组再放通 443 挂个 caddy/nginx，要么用 DNS-01 校验（任何端口都行，但要配 DNS 厂商凭证）。
> 在那之前，这个令牌的影响范围仅限这一个接口，把它当「随时可能要换」来对待。

## 排查

| 现象 | 多半是 |
| --- | --- |
| 连不上 / 请求超时 | 端口不对。安全组只放通 10080，`SEO_URL` 写成 `:8649` 一定超时。国内起服务也要带 `SEO_PORT=10080` |
| 前端报「剪辑服务拒绝了请求」 | 两边 `SEO_TOKEN` 不一致，或者一边配了一边没配。这个错误不会重试，看日志里括号里那句提示 |
| 提交任务后卡在上传 | `OSS_*` 没设齐，或者 `OSS_ENDPOINT` 用成了 `-internal` 的内网接入点。跑 `npm run check:oss` |
| `new URL()` 抛错 / `SEO_URL` 不生效 | `SEO_URL` 写成了裸 IP。必须带协议和端口：`http://101.132.167.193:10080` |
| 剪辑服务下不到源视频 | `PUBLIC_BASE` 没设或者指向了内网地址。它必须是国内那台机器从公网能访问到的地址 |
| 字幕是方块 | 缺中文字体，`apt install fonts-noto-cjk` |
