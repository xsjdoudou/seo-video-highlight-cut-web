# seo-video-highlight-cut-web

高光剪辑站点的前端 + 一层薄薄的编排服务（`scripts/clip-api.mjs`）。

## 它跑在哪儿

```
  海外机器                                     国内 GPU 机器
┌────────────────────────┐                 ┌──────────────────────┐
│ 浏览器 ← vite / dist   │                 │ seo_server.py :8649  │
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

跨境的只有 ① 和 ②，视频字节走 OSS 不走 ①。

**① 这一跳现在走 SSH 反向隧道，不是直连 EIP。** 那台 ECS 的安全组入方向规则我们
没有权限改，海外机器直连 `101.132.167.193:10080` 是超时（包被丢了）。但它的**出方向**
是全放通的，所以由国内主动往海外连一条隧道就绕开了权限问题，顺带把这一跳加密了。
具体配法见下面「连不上又改不了安全组」。链路变成：

```
海外 clip-api ──▶ 127.0.0.1:10080 ──┐
                                    │ SSH 隧道（国内发起的那条连接）
国内 seo_server.py :8649  ◀──────────┘
```

三件事决定了海外机器能不能跑通：

1. **① 要带令牌。** `seo_server.py` 配了 `SEO_TOKEN` 之后，不带令牌的请求一律 `401`。
   两边的值必须一模一样。走隧道也一样要带——隧道只解决「连得上」，不解决鉴权。
2. **端口两头不一样，由隧道对上。** 国内就用 `seo_server.py` 的默认端口 8649
   （裸跑 `python seo_server.py` 即可，**不用**带 `SEO_PORT=`），海外那头是 10080。
   隧道的 `-R 127.0.0.1:10080:127.0.0.1:8649` 负责把它们接起来。
3. **② 必须用 OSS 公网接入点。** 默认那套配置从内网 Nacos 读，给的是
   `oss-cn-shanghai-internal.aliyuncs.com`，只在阿里云 VPC 内部可达。海外机器连不上，
   而且报错是连接超时，看不出原因。所以 `OSS_*` 必须在环境变量里设齐，
   设齐了就完全不碰 Nacos。

### 国内那边怎么起

```bash
cd /datadisk1/xieshiji/code/seo-jogg-video-highlight-cut
python seo_server.py
```

就这一条，**不带任何环境变量**。端口是它自己的默认值 8649，令牌从 Nacos 的
`seo_token` 读。（踩过一次：之前要求带 `SEO_PORT=10080`，结果重启时漏了，
隧道照常挂着但转发不到服务上，报 `connect_to 127.0.0.1 port 10080: failed`。
现在端口差异交给隧道的 `-R` 处理，这边不用记了。）

启动日志里必须看到这一行：

```
接口鉴权已开启，调用方需要带上 Authorization: Bearer <SEO_TOKEN>
```

看到的是 `未配置 SEO_TOKEN，接口无鉴权` 就立刻停掉——`make_server("", port, app)`
绑的是 `0.0.0.0`，8649 对公网是开着的，挡在前面的只有 `SEO_TOKEN`，
没有它谁扫到都能白嫖这台机器的 GPU。

（更稳的做法是让它只绑 `127.0.0.1`——走隧道之后外部本来就不需要直连。
那要改 `seo_server.py` 里的 `make_server("", port, app)`，暂时没动。）

## 连不上又改不了安全组

症状：海外机器 `npm run check:seo` 第二步**超时**（不是 connection refused），
而国内那台上 `curl http://127.0.0.1:10080/health_check` 是 200。

超时和拒绝的区别很关键：阿里云安全组拦下来的包是直接**丢弃**的，不回 RST，
所以表现成超时；包到了但没人监听才会回 connection refused。超时 = 根本没到机器。

正规解法是在阿里云控制台给实例 `i-uf659g4jleurwg5zoboz` 的安全组加一条入方向规则
（自定义 TCP / `10080/10080` / 授权对象填海外机器的公网 IP 加 `/32`）。
**没有那个权限的话走下面这条，一条规则都不用加。**

### SSH 反向隧道

安全组对**出方向**是全放通的，所以反过来由国内发起连接就绕开了权限问题：

```
国内机器  ssh -R 127.0.0.1:10080:127.0.0.1:8649 <用户>@<海外IP>
                      │        ▲                      ▲
                      │        │                      └ 国内：seo_server.py 的默认端口
                      │        └ 海外：SEO_URL 指的就是它
                      └─▶ 海外机器上出现一个 127.0.0.1:10080，连它就等于连国内的服务
```

两头端口不一样是故意的。**走隧道之后安全组不参与了，端口想用哪个用哪个**，
所以国内这头干脆用 `seo_server.py` 自己的默认值 8649——国内永远是
`python seo_server.py` 裸跑，不用记 `SEO_PORT=`。海外那头固定 10080，
`SEO_URL` 一个字不用改。

需要的权限只有**海外机器的 22 入方向**，那台是你自己的。额外的好处是这一跳变成
SSH 加密的了——直连方案里 `SEO_TOKEN` 是明文走公网的。

装法见 [deploy/seo-tunnel.service](deploy/seo-tunnel.service)，文件头上写了完整步骤。
四个容易踩的点先说在这里，报错都指向错误的方向：

- **密钥别留在 root 名下。** `sudo ssh-keygen` 生成出来是 `root:root`，而隧道是以普通
  用户跑的，读不到就报 `Load key ...: Permission denied`，紧接着因为没钥匙可用而变成
  `Permission denied (publickey)`——看着像公钥没加对，其实是本地文件权限。
  生成完 `sudo chown <跑隧道的用户>:<同左> /etc/seo-video-highlight/tunnel_key*`。
- **监听地址要写全。** 必须是 `-R 127.0.0.1:10080:...`，不能简写成 `-R 10080:...`。
  简写时 ssh 发过去的 bind address 是空的，和 `authorized_keys` 里的
  `permitlisten="127.0.0.1:10080"` 字面匹配不上，sshd 会拒绝转发，报
  `Warning: remote port forwarding failed for listen port 10080`。
- **host key 是按用户存的。** 先用**跑隧道的那个用户**手动 ssh 一次收 host key。
  用 sudo 试的话收进的是 root 的 `known_hosts`，unit 照样 `Host key verification failed`。
- **`ExitOnForwardFailure=yes` 不能省。** 缺了它，端口没挂上时 ssh 会「连上了但没转发」
  地挂着，systemd 看着是 active，而所有请求都 connection refused。

密钥要限权：海外机器的 `authorized_keys` 里给这把钥匙加上
`restrict,port-forwarding,permitlisten="127.0.0.1:10080"`。这样密钥泄漏了也只能挂
这一个端口，登不进 shell。

挂好之后，海外机器的配置改成：

```
SEO_URL=http://127.0.0.1:10080
```

隧道那头绑的是海外机器的 `127.0.0.1`（sshd 默认 `GatewayPorts no`），只有本机进程连得上，
不对公网开放。`check:seo` 认得这个地址，第一步会打「指向本机：要么是本机联调，
要么是走 SSH 反向隧道」。

隧道断了的表现是 `check:seo` 第二步失败而国内服务一切正常。到国内那台上看：

```bash
systemctl status seo-tunnel
journalctl -u seo-tunnel -n 50
```

## 装 node

vite 7 要求 **node >= 20.19**。版本不够的话 `npm ci` 能装完，但一跑就炸，
而且报错完全看不出是版本问题（`SyntaxError: Unexpected token '?'` 之类）。

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

**装完 `node -v` 还是旧版本？多半是 conda。** 提示符上有 `(base)` 就是——
conda 把自己的 `bin` 排在 `PATH` 最前面，`apt install` 装到 `/usr/bin/node` 的那个
被它挡住了。验一下：

```bash
which -a node        # 第一行是 ~/miniconda3/bin/node 就是被挡了
```

是的话 `conda deactivate`，重开一个 shell，然后 `rm -rf node_modules && npm ci`
重装依赖——之前用旧 node 装的原生模块对不上新版本。

`npm run dev` / `preview` / `clip-api` / `check:seo` 都会先过 `scripts/with-env.mjs`
的版本检查，版本不够会直接告诉你怎么装，不会抛那种看不懂的语法错。
（那个文件本身是用老语法写的，不然它自己就先被解析报错了，检查根本跑不到。）

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
#   node >= 20.19（见上面「装 node」）、python3、ffmpeg、fonts-noto-cjk（烧中文字幕要）
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

### OSS 凭证怎么灌到海外机器

海外机器连不上内网 Nacos，`OSS_*` 只能手工设。别手抄、更别贴进聊天或者 issue——
让国内那台把值导出来，走一条不经过第三方的路。

```bash
# 在国内那台上跑（它能读到 Nacos）
cd /datadisk1/xieshiji/code/seo-video-highlight-cut-web
python3 scripts/oss_upload.py --export-env 2>/dev/null
```

`2>/dev/null` 滤掉 Nacos 的 INFO 和提示，屏幕上只剩 6 行 `KEY=value`。复制，
然后在海外机器上：

```bash
cat >> ~/code/seo-video-highlight-cut-web/.env <<'EOF'
<粘贴那 6 行>
EOF
chmod 600 ~/code/seo-video-highlight-cut-web/.env
npm run check:oss      # 来源要显示「环境变量」
```

`<<'EOF'` 的单引号不能省，否则值里的 `$`、反引号会被 shell 解释掉。

要是国内那台有一把**能在海外机器上执行命令**的密钥，可以一步到位：

```bash
python3 scripts/oss_upload.py --export-env | ssh <用户>@<海外IP> \
    'cat >> ~/code/seo-video-highlight-cut-web/.env'
```

**隧道那把钥匙不行**——它带着 `restrict`，只能挂端口，跑不了命令，
会报 `Permission denied (publickey)`。那是故意的，别为了图方便把限制去掉。

`--export-env` 只往 stdout 打 `KEY=value`，提示全走 stderr，所以能直接管道。
它会顺手把 `OSS_ENDPOINT` 里的 `-internal` 去掉换成公网接入点——Nacos 里存的是
`oss-cn-*-internal.aliyuncs.com`，只在阿里云 VPC 内部可达，海外机器照抄过去
每次上传都会卡到超时，而且报错看不出是接入点的问题。

追加就行，不用先删旧的：同一个文件里重复的键，**后面的覆盖前面的**，
所以 `.env` 里原来那几行空的 `OSS_AK=` 会被追加的真值盖掉。
（但命令行临时给的 `OSS_AK=xxx npm run dev` 仍然赢过整个文件。）

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
3. 最后重启国内那个服务（`python seo_server.py`，不带环境变量）。启动日志里会打一行
   `接口鉴权已开启，调用方需要带上 Authorization: Bearer <SEO_TOKEN>`，
   没看到这行就是没读到配置，这时候 8649 是裸着对公网开的，赶紧停掉。
4. 回到**海外机器**跑 `npm run check:seo`，三步全绿才算通。

第 4 步必须在海外机器上跑，不能在国内那台上自测：那台机器连自己的 EIP 是不通的
（`101.132.167.193:22` 从本机都连不上，hairpin NAT 没开），所以在国内怎么试都看不出
跨境那一跳到底通没通。

令牌用 `openssl rand -hex 32` 生成。**不要**把生成的值贴进聊天记录、issue 或者任何
会留档的地方——贴过就等于泄漏，重新生成一个。两边核对是不是同一个值的时候也别互相贴明文，
各自 `printf %s "$SEO_TOKEN" | sha256sum` 比对前 12 位就够了。

> 走 SSH 反向隧道的话，跨境这一跳已经是 SSH 加密的了，令牌不再明文过公网，
> 这一段可以跳过。
>
> 如果是直连 EIP，那一跳是明文 HTTP，令牌和视频地址在路上能被看到。想上 TLS 的话，
> Let's Encrypt 的自动签发需要 80（HTTP-01）或 443（TLS-ALPN-01），只开 10080 签不下来——
> 要么安全组再放通 443 挂个 caddy/nginx，要么用 DNS-01 校验（任何端口都行，但要配 DNS 厂商凭证）。
> 既然安全组本来就改不动，隧道反而是这里成本最低的那条路。

## 排查

| 现象 | 多半是 |
| --- | --- |
| `SyntaxError: Unexpected token '?'` | node 太旧（< 20.19）。见上面「装 node」，注意 conda 会挡住新装的 node |
| 请求**超时** | 包被丢了，没到机器。直连的话是安全组没放通；走隧道的话是隧道断了，到国内 `systemctl status seo-tunnel` |
| 请求**被拒绝**（connection refused） | 包到了但没人监听。隧道断了，或者国内的服务没起 |
| 隧道里刷 `connect_to 127.0.0.1 port 10080: failed` | 隧道是好的，是国内这头转发不过去——`seo_server.py` 没在跑，或者监听的端口和 `-R` 最后那个数字对不上。`ss -tlnp \| grep 8649` 查一下 |
| 隧道 active 但请求全被拒绝 | unit 里漏了 `ExitOnForwardFailure=yes`，ssh 连上了却没挂上端口 |
| `Load key ...: Permission denied` | 密钥还是 root 的。`sudo chown <跑隧道的用户>: /etc/seo-video-highlight/tunnel_key*` |
| `Permission denied (publickey)` | 先排除上一行（读不到密钥会连带报这个）。密钥能读了还报，才是公钥没加进海外机器的 `authorized_keys` |
| `Permission denied (open failed)` / `remote port forwarding failed` | `-R` 写成了 `10080:...`。要写全 `-R 127.0.0.1:10080:127.0.0.1:8649`，否则和 `permitlisten` 匹配不上 |
| `Host key verification failed` | host key 收进了别的用户的 `known_hosts`。用跑隧道的那个用户再手动 ssh 一次 |
| 前端报「剪辑服务拒绝了请求」 | 两边 `SEO_TOKEN` 不一致，或者一边配了一边没配。这个错误不会重试，看日志里括号里那句提示 |
| 提交任务后卡在上传 | `OSS_*` 没设齐，或者 `OSS_ENDPOINT` 用成了 `-internal` 的内网接入点。跑 `npm run check:oss` |
| `new URL()` 抛错 / `SEO_URL` 不生效 | `SEO_URL` 写成了裸 IP。必须带协议和端口：`http://127.0.0.1:10080` |
| 剪辑服务下不到源视频 | 和 `PUBLIC_BASE` 无关——交给下游的 `video_url` 永远是 OSS 地址。查 OSS 那一侧：对象传上去了吗、`OSS_CDN_URL` 拼出来的地址公网能不能下 |
| 页面上视频 404 / 下载不了 | `PUBLIC_BASE` 不对。它是给**浏览器**用的地址前缀，必须是终端用户能访问到的域名，和国内那台没关系 |
| 字幕是方块 | 缺中文字体，`apt install fonts-noto-cjk` |
