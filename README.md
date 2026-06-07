# TalkForge

**TalkForge** 是一款 Web 端 AI 英语口语陪练工具，帮助用户在指定场景下进行真实、低延迟的语音对话训练，并在课后获得语法纠错、发音评测与结构化学习报告。

> 设计哲学：**前台沉浸对话，后台静默教研。**  
> 实时语音模型负责自然对话体验与 turn 级转写；异步教研链路负责纠错、评测与报告，不打断用户说话。

---

## 目录

- [赛题背景](#赛题背景)
- [核心功能](#核心功能)
- [系统架构](#系统架构)
- [技术选型](#技术选型)
- [内置场景](#内置场景)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [麦克风与音频设备](#麦克风与音频设备)
- [使用方式](#使用方式)
- [开发脚本](#开发脚本)
- [测试与验证](#测试与验证)
- [项目结构](#项目结构)
- [相关文档](#相关文档)
- [已知限制](#已知限制)

---

## 赛题背景

**AI 英语口语陪练**

请开发一款英语口语练习工具，帮助用户在指定场景下进行真实对话训练。

**要求：**

- 支持场景选择（面试 / 点餐 / 会议等）
- 实时语音对话
- 发音评测
- 语法 / 表达纠错与课后总结

需综合考虑：


| 维度   | 关注点                    |
| ---- | ---------------------- |
| 对话交互 | 自然度、可打断、角色扮演沉浸感        |
| 语音链路 | 端到端流畅性与低延迟             |
| 纠错反馈 | 精准度与时机（对话中不打断，课后结构化呈现） |
| 能力提升 | 可量化指标、历史追踪、跟读练习        |


TalkForge 针对上述矛盾做了明确取舍：对话阶段优先体验，教研阶段异步完成，并通过 turn 级数据（音频片段、转写、纠错、评测、报告）形成完整学习闭环。

---

## 核心功能

### 1. 场景选择与任务框架

每个场景不是一段简单 prompt，而是包含角色、情境、目标、阶段、退出策略与评分维度的结构化任务：

- **内置场景库**：咖啡点餐、英文面试、自我介绍、会议汇报、旅行问路等
- **自定义场景生成**：通过自然语言描述，由 LLM 生成结构化场景并持久化到数据库
- **场景入口页**：进入练习前展示该场景的历史练习报告，便于回顾与对比
- **进度追踪**：LLM Judge 根据对话转写判断目标完成情况，UI 实时展示已完成 / 未完成目标

### 2. 实时语音对话

- **Qwen Omni 双向语音**：浏览器通过 WebSocket 代理连接 DashScope 实时模型，支持 AI 先开口、用户自然说话、流式语音回复
- **PCM 音频链路**：麦克风采集 → 软件增益 / 噪声门 / 回声防护 → 上行 PCM；下行 PCM 播放
- **安全设计**：浏览器仅持有后端签发的短期 token，长期 API Key 不暴露给前端

### 3. 后台教研链路（异步）

每个 user turn 结束后，后台 worker 依次处理：


| 步骤           | 说明                                                               |
| ------------ | ---------------------------------------------------------------- |
| 实时转写         | Qwen Omni 实时会话输出英文转写，落盘至 `turns.transcript_text`（对话中即可展示）      |
| 音频上传         | 前端录制 turn 级 webm/wav，经签名 URL 上传至对象存储（供发音评测与存档）                 |
| 语法 / 表达纠错    | OpenAI 兼容 LLM 分析实时转写文本，输出 grammar / expression / vocabulary 等纠错 |
| 发音评测（自由对话）   | iFlytek ISE `read_sentence`，以实时转写为参考，UI 展示词级弱项高亮                 |
| 场景进度判断       | LLM Judge 更新 `scenario_progress.completed_goal_ids`              |
| 课后报告         | LLM 生成总结、任务完成度、典型错误、下次练习建议                                       |
| Shadowing 跟读 | TTS（CosyVoice）生成标准音频 → 用户跟读 → iFlytek ISE 严格评测                   |


### 4. 可观测性与成本控制

- **AI 调用追踪**：每次 Provider 调用写入 `ai_invocation_logs`，可选落盘原始 request/response
- **Provider 健康检查**：`/api/health` 聚合 PostgreSQL、Redis、各 Provider 状态
- **会话用量限额**：可配置最大时长、轮数、报告重试次数，超限后 UI 禁用练习操作

---

## 系统架构

TalkForge 采用 **主从双轨协同** 架构：

```text
┌─────────────────────────────────────────────────────────────┐
│                     Browser Client                          │
│  Next.js UI · 实时语音 WebSocket · MediaRecorder · IndexedDB │
└───────────────┬─────────────────────────────┬───────────────┘
                │ Realtime Track              │ Background Track
                │ (低延迟语音对话)              │ (turn 音频 / 报告 API)
                ▼                             ▼
┌───────────────────────────┐   ┌────────────────────────────┐
│  Realtime WebSocket Proxy │   │   Next.js Route Handlers   │
│  (Qwen Omni token 代理)    │   │   Auth · Session · Upload  │
└───────────────┬───────────┘   └──────────────┬─────────────┘
                │                              │
                ▼                              ▼
        DashScope Qwen Omni            BullMQ Worker 进程
                                       ├─ Realtime WS 代理（同进程启动）
                                       ├─ Correction (LLM)
                                       ├─ Pronunciation (iFlytek)
                                       ├─ Scenario Judge (LLM)
                                       ├─ Report (LLM)
                                       └─ TTS + Shadowing (CosyVoice)
                                                │
                                                ▼
                              PostgreSQL + Redis + Object Storage
```

**Real-time Track（主干道）**：用户选场景 → 后端创建 Session 并签发短期 token → 浏览器经代理连接实时模型 → 双向语音对话。

**Background Track（辅路）**：user turn 结束 → 实时转写落盘 + 音频上传 → 入队纠错 / 评测 job → worker 消费 → 前端轮询报告与反馈。

---

## 技术选型


| 层级     | 选型                                 | 说明                                            |
| ------ | ---------------------------------- | --------------------------------------------- |
| 前端     | Next.js 15 + React 19 + TypeScript | App Router，Server / Client 组件分离               |
| 状态     | Zustand                            | 练习页会话与实时状态                                    |
| 后端     | Next.js Route Handlers             | REST API，TypeScript 统一栈                       |
| 数据库    | PostgreSQL 16 + Drizzle ORM        | Session、Turn、Report 等结构化持久化                   |
| 队列     | BullMQ + Redis 7                   | 异步教研 job 调度                                   |
| 对象存储   | 本地 / S3 / R2 / OSS / MinIO         | turn 音频与 TTS 标准音私有存储                          |
| 实时语音   | Qwen Omni（DashScope）               | WebSocket + 短期 token；本地 WS 代理；同步输出 turn 级英文转写   |
| 文本 LLM | DashScope / OpenAI 兼容 API          | 纠错、报告、场景 Judge、场景生成                           |
| TTS    | DashScope CosyVoice                | Shadowing 标准音频                                |
| 发音评测   | iFlytek ISE                        | 自由对话 + Shadowing 跟读                           |
| 测试     | Vitest + Testing Library           | 单元 / 集成 / 组件测试                                |
| 基础设施   | Docker Compose                     | 本地 PostgreSQL（5434）+ Redis（6381）              |


所有外部能力均通过 **Provider 抽象层**（`src/providers/`）隔离，便于切换供应商与独立演进。

---

## 内置场景


| ID                     | 场景       | 等级  | 用户角色 → AI 角色 |
| ---------------------- | -------- | --- | ------------ |
| `coffee_ordering_a2`   | 在咖啡馆点咖啡  | A2  | 顾客 → 咖啡师     |
| `english_interview_b1` | 英文求职面试   | B1  | 求职者 → 面试官    |
| `self_introduction_a2` | 自我介绍     | A2  | 学习者 → 对话伙伴   |
| `meeting_update_b1`    | 团队会议进度汇报 | B1  | 团队成员 → 主持人   |
| `travel_directions_a2` | 问路       | A2  | 游客 → 路人      |


运行 `npm run db:seed` 写入数据库；启动 Session 时也会自动 upsert 种子场景。

---

## 快速开始

### 环境要求

- **Node.js** 20+
- **PostgreSQL**（本地安装或 Docker Compose）
- **Redis**
- **ffmpeg**（发音评测 worker 需要，需在 PATH 中）
- **各 Provider API Key**（DashScope、讯飞开放平台、对象存储等，见 [环境变量配置](#环境变量配置)）

### 1. 克隆与安装

```bash
git clone <your-repo-url> TalkForge
cd TalkForge
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

[`.env.example`](.env.example) 已为本地开发准备好可直接使用的参考值，复制后 **通常只需填入各 Provider 的 API Key / Secret**（见 [获取 API 凭证](#获取-api-凭证)）。详细说明见 [环境变量配置](#环境变量配置)。

### 3. 启动基础设施

Docker Compose 将 PostgreSQL 映射到 **5434**、Redis 映射到 **6381**，避免与本地默认端口冲突：

```bash
npm run infra:up
npm run infra:check
```

在 `.env` 中确认以下变量（若使用 `.env.example` 默认值且已执行 `cp .env.example .env`，**可跳过此步**）：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/talkforge
QUEUE_PROVIDER=redis
REDIS_URL=redis://localhost:6381
```

### 4. 初始化数据库

```bash
npm run db:push
npm run db:seed
npm run staging:smoke
```

`staging:smoke` 会检查基础设施与 Provider 配置是否就绪。

### 5. 启动应用

在 **两个终端** 分别运行：

```bash
# 终端 1：Next.js 应用
npm run dev

# 终端 2：Worker（后台 job + Realtime WebSocket 代理）
npm run worker
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

> **关于 Realtime 代理：** 当 `REALTIME_PROVIDER=qwen-omni` 时，`npm run worker` 会在同一进程内自动启动 WebSocket 代理（默认端口 `3002`），**无需**再单独运行 `npm run realtime-proxy`。DashScope 要求 WebSocket 携带 `Authorization` 头，浏览器无法直接发送，因此由本地代理转发。

进入练习页前，请先完成 [麦克风与音频设备](#麦克风与音频设备) 中的系统与浏览器授权设置。

---

## 环境变量配置

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

**带 `NEXT_PUBLIC_` 前缀的变量会暴露给浏览器，切勿放入密钥。**

以下模块在 `.env.example` 中已给出可直接使用的本地参考值，复制后 **无需修改**（除非你使用非 Docker 的 PostgreSQL / Redis，或部署到远程环境）：

- **应用与开发用户**
- **数据库与队列**（默认对齐 `docker-compose.yml` 的 `5434` / `6381` 端口）
- **对象存储**（`STORAGE_PROVIDER=local` 本地开发模式）
- **AI 追踪与会话限额**

你只需在 **各 Provider 模块** 填入 API Key / Secret（见 [获取 API 凭证](#获取-api-凭证)）。

### 获取 API 凭证

TalkForge 的实时语音（含 turn 级转写）、文本 LLM、TTS 均使用 **阿里云百炼（DashScope）** 同一套 API Key；发音评测使用 **讯飞开放平台 ISE**。两家均提供 **免费额度**，适合开发与轻度试用。

| 服务 | 用途 | 获取入口 |
|------|------|----------|
| 阿里云百炼 | Qwen Omni 实时语音与转写、文本 LLM、CosyVoice TTS | [百炼控制台 · 模型免费额度](https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/free-quota?modelType=Text) |
| 讯飞 ISE | 自由对话发音评测、Shadowing 跟读评测 | [讯飞开放平台 · 语音评测（流式版）](https://console.xfyun.cn/services/ise) |

配置步骤概要：

1. 在百炼控制台创建 API Key，填入 `REALTIME_API_KEY`、`LLM_API_KEY`、`TTS_API_KEY`（可为同一 Key）。
2. 在讯飞控制台创建应用并开通 ISE 服务，填入 `PRONUNCIATION_APP_ID`、`PRONUNCIATION_API_KEY`、`PRONUNCIATION_API_SECRET`。
3. 运行 `npm run staging:smoke` 检查各 Provider 是否就绪。

### 应用与开发用户

`.env.example` 默认值可直接使用：

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `APP_BASE_URL` | 服务端基础 URL（签名上传链接） | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_BASE_URL` | 浏览器 API 基础 URL | `http://localhost:3000` |
| `NEXT_PUBLIC_DEV_USER_ID` | 开发用户 ID（请求头 `x-talkforge-user-id`） | `99999999-9999-4999-8999-999999999999` |

### 数据库与队列

`.env.example` 默认值可直接配合 `npm run infra:up` 使用：

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `DATABASE_PROVIDER` | 数据库类型 | `postgres` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:postgres@localhost:5434/talkforge` |
| `QUEUE_PROVIDER` | 队列后端 | `redis` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6381` |


### 对象存储

本地开发可直接使用 `.env.example` 中的 `local` 配置：

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `STORAGE_PROVIDER` | 存储后端 | `local` |
| `STORAGE_SIGNING_SECRET` | 上传签名 HMAC 密钥 | `talkforge-dev-storage-secret` |
| `LOCAL_STORAGE_ROOT` | 本地存储根目录 | `.data/storage` |

部署到 staging / 生产时，将 `STORAGE_PROVIDER` 改为 `oss` / `s3` 等并填写 `STORAGE_ENDPOINT`、`STORAGE_BUCKET`、访问密钥。

### 实时语音与转写（Qwen Omni）

模型与端点可直接使用 `.env.example` 默认值；**`REALTIME_API_KEY` 需填入百炼 API Key**（见 [获取 API 凭证](#获取-api-凭证)）。  
当前主链路**不再依赖外部 ASR**：user turn 的英文转写由 Omni 实时会话输出，写入 `turns.transcript_text`，供纠错、发音评测与报告使用。

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `REALTIME_PROVIDER` | 实时语音 Provider | `qwen-omni` |
| `REALTIME_API_KEY` | DashScope API Key（**仅服务端，必填**） | （留空，自行填写） |
| `REALTIME_BASE_URL` | DashScope 端点 | `https://dashscope.aliyuncs.com` |
| `REALTIME_MODEL` | 实时模型 | `qwen3.5-omni-flash-realtime` |
| `REALTIME_VOICE` | 音色 | `Cherry` |
| `REALTIME_PROXY_PORT` | 本地 WS 代理端口 | `3002` |
| `NEXT_PUBLIC_REALTIME_PROXY_URL` | 浏览器连接地址 | `ws://localhost:3002` |
| `REALTIME_VAD_MODE` | 可选 VAD 模式 | `server_vad` / `semantic_vad` |


**浏览器音频调优：**


| 变量                                    | 说明                                              |
| ------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_REALTIME_MIC_PROCESSING` | `balanced`（默认，外放推荐）/ `standard`（耳机推荐）/ `raw`    |
| `NEXT_PUBLIC_REALTIME_MIC_GAIN`       | 麦克风软件增益                                         |
| `NEXT_PUBLIC_REALTIME_NOISE_GATE`     | 上行静音门限                                          |
| `NEXT_PUBLIC_REALTIME_BARGE_IN`       | 是否允许语音打断 AI，默认 `false`（见 [麦克风与音频设备](#麦克风与音频设备)） |


### 文本 LLM

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `LLM_CORRECTION_PROVIDER` | 纠错 | `dashscope` |
| `LLM_REPORT_PROVIDER` | 报告生成 | `dashscope` |
| `LLM_GOAL_JUDGE_PROVIDER` | 场景目标 Judge | `dashscope` |
| `LLM_SCENARIO_GENERATE_PROVIDER` | 自定义场景生成 | `dashscope` |
| `LLM_API_KEY` | DashScope API Key（**必填**） | （留空，自行填写） |
| `LLM_BASE_URL` | 兼容模式端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_MODEL` | 文本模型 | `qwen3.7-max` |
| `SCENARIO_PROGRESS_JUDGE_USER_TURN_INTERVAL` | 每 N 个 user turn 触发 Judge | `1` |

### TTS 与发音评测

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `TTS_PROVIDER` | TTS Provider | `cosyvoice` |
| `TTS_API_KEY` | DashScope API Key（**必填**） | （留空，自行填写） |
| `TTS_BASE_URL` | DashScope 端点 | `https://dashscope.aliyuncs.com` |
| `TTS_MODEL` | TTS 模型 | `cosyvoice-v1` |
| `TTS_VOICE` | 音色 | `longxiaochun_v3` |
| `PRONUNCIATION_PROVIDER` | 发音评测 Provider | `iflytek-ise` |
| `PRONUNCIATION_APP_ID` | 讯飞应用 ID（**必填**） | （留空，自行填写） |
| `PRONUNCIATION_API_KEY` | 讯飞 API Key（**必填**） | （留空，自行填写） |
| `PRONUNCIATION_API_SECRET` | 讯飞 API Secret（**必填**） | （留空，自行填写） |
| `PRONUNCIATION_WS_BASE_URL` | 讯飞 ISE WebSocket 端点 | `wss://ise-api.xfyun.cn/v2/open-ise` |


### AI 追踪与会话限额

`.env.example` 默认值可直接使用：

| 变量 | 说明 | `.env.example` 参考值 |
|------|------|----------------------|
| `AI_TRACING_ENABLED` | 是否记录 AI 调用 | `true` |
| `AI_TRACING_RAW_REQUEST` / `AI_TRACING_RAW_RESPONSE` | 是否落盘原始 payload | `true` |
| `AI_TRACING_LOCAL_ROOT` | 追踪文件目录 | `.storage/ai-traces` |
| `SESSION_MAX_REALTIME_DURATION_SEC` | 最大实时时长（0 = 不限制） | `0` |
| `SESSION_MAX_TURNS` | 最大轮数（0 = 不限制） | `0` |
| `OPS_HEALTH_DETAIL_TOKEN` | 生产环境 `/api/health?detail=1` Bearer Token | （留空） |

完整注释版见 [`.env.example`](.env.example)。

---

## 麦克风与音频设备

开始语音练习前，请确保操作系统、浏览器均已授权麦克风，并选择合适的音频输出方式。

### 开启麦克风

#### Windows

1. 打开 **设置 → 系统 → 声音**。
2. 在 **输入** 区域选择正确的麦克风设备（笔记本内置麦或外接耳机麦）。
3. 对着麦克风说话，确认 **输入音量** 条有跳动；若无反应，点击 **设备属性** 检查是否被静音。
4. 打开 **设置 → 隐私和安全性 → 麦克风**，确认 **麦克风访问** 已开启，并允许你使用的浏览器（Chrome / Edge 等）访问麦克风。
5. 首次进入练习页时，在浏览器地址栏旁的权限弹窗中点击 **允许** 麦克风。

#### macOS

1. 打开 **系统设置 → 声音 → 输入**，选择麦克风设备并观察 **输入电平** 是否有波动。
2. 打开 **系统设置 → 隐私与安全性 → 麦克风**，为你使用的浏览器开启权限。
3. 首次进入练习页时，在浏览器弹窗中点击 **允许** 麦克风。

> 若权限曾被拒绝，需在浏览器设置中手动恢复该站点的麦克风权限，然后刷新页面。

### 外放 vs 耳机

AI 回复通过扬声器外放时，麦克风可能拾取播放声音，导致误触发「打断 AI」。因此项目 **默认关闭语音打断**（`NEXT_PUBLIC_REALTIME_BARGE_IN=false`）：


| 使用方式          | 推荐配置                                     | 打断 AI 的方式            |
| ------------- | ---------------------------------------- | -------------------- |
| **扬声器外放**（默认） | 保持 `NEXT_PUBLIC_REALTIME_BARGE_IN=false` | 点击练习页上的 **打断 AI** 按钮 |
| **佩戴耳机**      | 在 `.env` 中开启语音打断                         | 直接说话即可打断 AI 回复       |


佩戴耳机时，可在 `.env` 中加入：

```env
NEXT_PUBLIC_REALTIME_BARGE_IN=true
# 可选：调整打断灵敏度
# NEXT_PUBLIC_REALTIME_BARGE_IN_PEAK=0.14
# NEXT_PUBLIC_REALTIME_BARGE_IN_ARM_MS=1200
```

修改 `.env` 后需 **重启** `npm run dev` 使 `NEXT_PUBLIC_`* 变量生效。

耳机场景下也可将麦克风处理模式设为 `standard`，获得更完整的浏览器降噪与回声消除：

```env
NEXT_PUBLIC_REALTIME_MIC_PROCESSING=standard
```

---

## 使用方式

### 完整练习流程

1. 按 [快速开始](#快速开始) 完成环境配置，双终端启动 `npm run dev` 与 `npm run worker`。
2. 打开 [http://localhost:3000](http://localhost:3000)，选择场景（如「在咖啡馆点咖啡」）。
3. 在场景入口页可查看该场景的历史报告，点击 **开始练习** 进入对话页。
4. 授权麦克风后，AI 会先开口；对着麦克风用英语回应，观察状态栏（Listening / AI is speaking）与转写面板。
5. 每个 user turn 结束后，实时转写会写入面板；后台 worker 自动完成纠错、发音评测与场景进度更新。
6. 点击 **结束练习**，等待报告生成。
7. 在报告面板查看总结、典型错误与下次建议；进入 **Shadowing 跟读** 练习推荐句。

### 自定义场景

1. 首页点击 **创建场景**。
2. 用中文或英文描述你想练习的情境（如「在酒店前台办理入住」）。
3. LLM 生成结构化场景，审核后保存。
4. 新场景出现在首页列表，可像内置场景一样开始练习。

### 验证 AI 调用追踪

完成一次练习后，可用 session ID 检查各 Provider 调用记录：

```bash
npm run staging:smoke -- --session-id <your-session-id>
```

详细 staging 清单见 `[plans/talkforge-p1/staging-readiness.md](plans/talkforge-p1/staging-readiness.md)`。

### 典型数据流

```text
选择场景
  → POST /api/sessions（创建 Session + 实时凭证）
  → 实时语音对话（Qwen Omni，经本地 WS 代理）
  → POST /api/sessions/:id/turns + 音频 finalize
  → Worker：纠错 → 发音评测 → 场景进度（转写来自 Omni 实时输出）
  → 结束练习 → 报告生成 → Shadowing TTS → 跟读评测
```

---

## 开发脚本


| 命令                      | 说明                                              |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | 启动 Next.js 开发服务器                                |
| `npm run build`         | 生产构建                                            |
| `npm run start`         | 启动生产服务器                                         |
| `npm run worker`        | 启动 BullMQ Worker，并自动启动 Realtime WebSocket 代理    |
| `npm run test`          | 运行 Vitest 测试套件                                  |
| `npm run test:watch`    | 监听模式测试                                          |
| `npm run lint`          | ESLint 检查                                       |
| `npm run typecheck`     | TypeScript 类型检查                                 |
| `npm run db:push`       | 将 Drizzle schema 同步到数据库                         |
| `npm run db:migrate`    | 应用已提交的 SQL 迁移                                   |
| `npm run db:generate`   | schema 变更后生成迁移文件                                |
| `npm run db:seed`       | 写入开发用户与内置场景                                     |
| `npm run infra:up`      | Docker Compose 启动 PostgreSQL + Redis            |
| `npm run infra:down`    | 停止基础设施                                          |
| `npm run infra:check`   | 检测 PostgreSQL / Redis 连通性                       |
| `npm run staging:smoke` | 配置与基础设施就绪检查；加 `-- --session-id <uuid>` 检查 AI 追踪 |


健康检查：`GET /api/health`（PostgreSQL / Redis 异常时返回 503）。

---

## 测试与验证

```bash
# 全量测试
npm run test

# 全链路集成测试
npm run test -- src/test/p1-e2e-staging-readiness.test.ts
```

---

## 项目结构

```text
TalkForge/
├── src/
│   ├── app/                 # Next.js 页面与 API Route Handlers
│   ├── components/          # UI 组件（练习页、报告、场景选择等）
│   ├── domain/              # 领域类型（Session、Turn、Report、Scenario…）
│   ├── features/            # 前端功能模块（conversation、scenario-create）
│   ├── providers/           # 外部 Provider 抽象与适配器
│   ├── server/              # 服务端逻辑（DB、Worker、Session、Queue）
│   └── test/                # Vitest 测试
├── scripts/                 # Worker、DB Seed、Staging Smoke
├── drizzle/                 # 数据库迁移
├── plans/                   # 开发计划与验证清单
├── TalkForge-Design.md      # 系统设计文档（权威）
├── AGENTS.md                # Agent 开发指南
└── docker-compose.yml       # 本地 PostgreSQL + Redis
```

---

## 已知限制

- **认证**：当前使用开发头 `x-talkforge-user-id`，任意客户端可冒充用户 ID，**不可用于生产**。
- **Worker 必须运行**：`QUEUE_PROVIDER=redis` 时必须单独运行 `npm run worker`，否则后台 job 不会执行、报告无法生成；Realtime 代理也随 worker 一同启动。
- **ffmpeg 依赖**：iFlytek ISE 发音评测需要 worker 主机安装 ffmpeg。
- **音频格式**：iFlytek 要求 16 kHz mono PCM；worker 会从 webm/wav 转换。
- **成本**：各 Provider 会产生 API 费用；staging 建议设置 `SESSION_MAX_`* 限额。

### 常见问题


| 现象          | 排查                                                                   |
| ----------- | -------------------------------------------------------------------- |
| 报告一直不可用     | 确认 `npm run worker` 已启动，Redis 连通正常                                   |
| API 401     | `NEXT_PUBLIC_DEV_USER_ID` 需与 seed 用户一致                               |
| 实时语音无声音     | 确认 `npm run worker` 已启动（含 WS 代理），检查 `NEXT_PUBLIC_REALTIME_PROXY_URL` |
| 麦克风无输入      | 按 [麦克风与音频设备](#麦克风与音频设备) 检查系统与浏览器权限                                   |
| 外放时 AI 被误打断 | 保持 `NEXT_PUBLIC_REALTIME_BARGE_IN=false`，或改用耳机并开启该开关                 |


---

## License

Private — 详见仓库设置。