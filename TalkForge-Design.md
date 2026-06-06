# TalkForge 项目系统设计方案 (Native Audio 版)

## 1. 项目背景与设计哲学

TalkForge 是一款 Web 端 AI 英语口语陪练工具，目标是帮助用户在真实场景中进行低压力、高频次、可量化的英语口语训练。

核心需求包括：

- 场景选择：面试、点餐、会议、寒暄、旅行、商务沟通等。
- 实时语音对话：用户可以自然说话、停顿、打断，AI 以低延迟语音回应。
- 发音评测：对用户语音进行流利度、准确度、可懂度等维度评估。
- 语法与表达纠错：识别语法错误、表达不自然、词汇使用不恰当等问题。
- 课后总结：输出可追踪的能力指标、典型错误、推荐跟读句和下次训练建议。

口语练习产品的核心痛点不是单纯的模型能力，而是两个矛盾：

1. 对话越自然，越不应该频繁打断用户。
2. 反馈越精准，越需要结构化 transcript、音频片段和上下文分析。

因此 TalkForge 的核心设计哲学是：

**前台沉浸对话，后台静默教研。**

- **前台 Real-time Track：** 使用原生音频大模型接管主对话链路，优先保证低延迟、自然度、可打断、情绪反馈和连续对话体验。
- **后台 Background Track：** 异步消费前台产生的音频、文本和上下文数据，进行 ASR、语法纠错、表达优化、发音评测和课后报告生成。

需要明确的是：Native Audio 模型负责“自然对话体验”，但不能替代结构化教研链路。真正的学习闭环必须建立在 turn 级数据、ASR transcript、音频片段、评测结果和报告生成之上。

---

## 2. 产品阶段规划

### 2.1 P0 范围

P0 目标是验证“实时自由对话 + 课后反馈”的核心体验。

优先实现：

- 内置场景库：预置若干高频场景，如咖啡点餐、英文面试、自我介绍、会议发言、旅行问路。
- 实时语音陪练：用户与 AI 进行自然语音对话。
- 用户音频切片与上传：按 user turn 保存音频片段。
- ASR 转写：优先调用外部 ASR API。
- 语法与表达纠错：基于 ASR 文本和上下文异步分析。
- 自由对话轻量评估：语速、停顿、流利度、表达多样性、可懂度等。
- 课后报告：展示本次练习总结、典型错误、推荐替代表达。
- Shadowing 跟读模块：对部分推荐句提供标准音频和跟读评测。

P0 暂不追求：

- 自由对话中的完整音素级发音评分。
- 自研 ASR 模型服务。
- 用户自由生成复杂场景。
- 多用户课堂、教师后台、组织管理等 B2B 能力。

### 2.2 P1/P2 演进

P1：

- 支持自然语言生成新场景。
- 增加更细粒度的能力趋势追踪。
- 增加 ASR Provider 抽象，支持多个 ASR 服务切换。
- 引入更完整的 Shadowing 练习链路。

P2：

- 增加 Python ASR Worker，接入 faster-whisper 等自建 ASR 服务。
- 支持私有化部署或降本优化。
- 支持个性化学习路径和长期能力画像。
- 支持教师/运营侧配置场景、查看数据和干预学习路径。

---

## 3. 场景设计与结束策略

TalkForge 的场景不应只是一段 prompt，而应该是一个有目标、有阶段、有结束条件的对话任务。用户和 AI 可以自由对话，但自由对话必须发生在任务框架内，避免场景无限发散或无法自然收尾。

核心原则：

- 场景负责定义“练什么”。
- 实时模型负责“自然地聊”。
- 后端负责“记录进度、判断完成度、控制结束边界”。
- 课后报告基于场景目标和评分规则进行复盘。

### 3.1 场景结构

建议将场景设计为 `Scenario + Mission + Rubric + ExitPolicy`。

```ts
type Scenario = {
  id: string;
  title: string;
  description: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1";
  userRole: string;
  aiRole: string;
  situation: string;
  mission: string;
  goals: ScenarioGoal[];
  stages: ScenarioStage[];
  vocabulary: string[];
  targetExpressions: string[];
  constraints: string[];
  exitPolicy: ExitPolicy;
  evaluationRubric: EvaluationRubric;
};

type ScenarioGoal = {
  id: string;
  description: string;
  required: boolean;
  completedWhen: string;
};

type ScenarioStage = {
  id: string;
  name: string;
  purpose: string;
  aiBehavior: string;
  expectedUserActions: string[];
};

type ExitPolicy = {
  minTurns: number;
  maxTurns: number;
  maxDurationSec: number;
  requiredGoals: string[];
  endWhenGoalsCompleted: boolean;
  allowUserManualEnd: boolean;
  aiCanSuggestEnd: boolean;
};
```

### 3.2 示例：咖啡点餐场景

```ts
const coffeeOrderingScenario: Scenario = {
  id: "coffee_ordering_a2",
  title: "Order Coffee at a Cafe",
  description: "Practice ordering a drink at a cafe.",
  level: "A2",
  userRole: "customer",
  aiRole: "barista",
  situation: "The learner is ordering a drink at a busy cafe.",
  mission: "Help the learner complete a natural coffee order in English.",
  goals: [
    {
      id: "choose_drink",
      description: "The learner chooses a drink.",
      required: true,
      completedWhen: "The learner clearly states a drink name."
    },
    {
      id: "choose_size",
      description: "The learner chooses a size.",
      required: true,
      completedWhen: "The learner chooses small, medium, large, tall, grande, or venti."
    },
    {
      id: "customize_order",
      description: "The learner answers at least one customization question.",
      required: true,
      completedWhen: "The learner answers milk, ice, sugar, temperature, or add-on preference."
    },
    {
      id: "confirm_payment",
      description: "The learner confirms the order and payment.",
      required: true,
      completedWhen: "The order is repeated back and the learner confirms it."
    }
  ],
  stages: [
    {
      id: "greeting",
      name: "Greeting",
      purpose: "Start the order naturally.",
      aiBehavior: "Greet the learner and ask what they would like.",
      expectedUserActions: ["greet", "state drink"]
    },
    {
      id: "customization",
      name: "Customization",
      purpose: "Ask follow-up questions.",
      aiBehavior: "Ask about size, temperature, milk, sweetness, or add-ons.",
      expectedUserActions: ["choose size", "answer customization"]
    },
    {
      id: "confirmation",
      name: "Confirmation",
      purpose: "Confirm the order.",
      aiBehavior: "Repeat the order and ask for confirmation.",
      expectedUserActions: ["confirm order"]
    },
    {
      id: "closing",
      name: "Closing",
      purpose: "Finish the transaction politely.",
      aiBehavior: "Give a price and close the interaction.",
      expectedUserActions: ["respond politely"]
    }
  ],
  vocabulary: ["latte", "americano", "iced", "hot", "medium", "oat milk"],
  targetExpressions: [
    "Could I get a medium latte?",
    "Can I have it iced?",
    "That's all, thank you."
  ],
  constraints: [
    "Stay in character as a barista.",
    "Use short, natural sentences suitable for A2 learners.",
    "Do not correct grammar during the conversation unless the learner asks."
  ],
  exitPolicy: {
    minTurns: 4,
    maxTurns: 12,
    maxDurationSec: 360,
    requiredGoals: ["choose_drink", "choose_size", "customize_order", "confirm_payment"],
    endWhenGoalsCompleted: true,
    allowUserManualEnd: true,
    aiCanSuggestEnd: true
  },
  evaluationRubric: {
    dimensions: ["task_completion", "fluency", "clarity", "grammar", "expression"]
  }
};
```

### 3.3 提供给 AI 的方式

后端保存结构化 `Scenario`，但不建议把完整 JSON 原样塞给实时模型。更稳妥的方式是由后端将场景转换成清晰的 system instructions。

示例：

```text
You are role-playing as a barista in a cafe.

Scenario:
The learner is a customer ordering coffee at a busy cafe.

Learner level:
A2. Use short, natural sentences. Avoid complex idioms.

Mission:
Help the learner complete a natural coffee order in English.

Conversation goals:
1. Ask what drink the learner wants.
2. Ask for size.
3. Ask one customization question.
4. Confirm the final order.
5. Close politely.

Behavior rules:
- Stay in character as the barista.
- Do not correct grammar during the conversation unless the learner asks.
- If the learner struggles, offer a short hint or a simple choice.
- Keep responses concise.
- After all goals are complete, naturally ask whether they want to finish the practice.
- If the learner goes off-topic, gently bring them back to ordering coffee.
```

结构化场景同时用于：

- 实时 prompt 生成。
- 目标完成度判断。
- 课后报告评分。
- 推荐跟读句生成。
- 下一次训练建议。

### 3.4 场景结束条件

场景结束不应完全依赖 AI 自行判断。推荐组合使用以下结束条件：

- **用户主动结束：** 用户点击结束按钮，或明确说出想结束练习。
- **任务目标完成：** required goals 全部完成后，AI 自然建议结束。
- **保护性结束：** 达到最大轮数、最大时长、长时间沉默或严重偏题。

P0 推荐采用：

- 用户手动结束。
- 最大时长和最大轮数限制。
- 目标完成后由 AI 建议结束，但最终由用户确认。

这样既能保证对话自然，也能避免场景无限延长。

### 3.5 场景进度判断

P0 可使用规则判断 + 轻量 LLM Judge：

- 规则判断：最大时长、最大轮数、用户手动结束、长时间沉默。
- LLM Judge：每 1-2 个 user turn 或 session 结束时，根据 transcript 判断哪些 goals 已完成。

```ts
type ScenarioProgress = {
  sessionId: string;
  currentStageId: string;
  completedGoalIds: string[];
  missingGoalIds: string[];
  shouldSuggestEnding: boolean;
  offTopic: boolean;
  updatedAt: string;
};
```

实时对话中不必每轮都调用 Judge，避免成本和延迟上升。P0 可以每 2 个 user turn 判断一次，或者先只在课后判断；AI 的 system instructions 本身会推动对话按阶段前进。

---

## 4. 系统核心架构：主从双轨协同

### 4.1 总体架构

```text
Browser Client
  - Next.js UI
  - WebRTC / WebSocket realtime audio
  - MediaRecorder local audio capture
  - IndexedDB temporary cache
        |
        | realtime token / scenario config / upload / report
        v
TypeScript Backend
  - Auth
  - Scenario config
  - Realtime session token
  - Turn and session records
  - Audio upload signing
  - Job orchestration
        |
        | async jobs
        v
Background Workers
  - ASR
  - Grammar correction
  - Expression improvement
  - Pronunciation evaluation
  - Report generation
        |
        v
PostgreSQL + Object Storage + Redis Queue
```

### 4.2 主干道：实时陪练链路

这是用户感知最强、延迟要求最高的链路。

通信协议优先级：

1. 如果模型厂商支持稳定的 WebRTC，优先使用 WebRTC。
2. 如果厂商主要提供 WebSocket realtime API，则使用 WebSocket。
3. 后端不直接转发所有音频流，除非厂商安全机制不允许前端直连。

核心流程：

1. 用户选择场景。
2. 前端向后端请求场景配置和实时模型连接凭证。
3. 后端创建 `Session`，生成短期 realtime token。
4. 浏览器使用短期 token 连接实时音频模型。
5. 用户语音通过 WebRTC/WebSocket 发送给模型。
6. 模型返回流式音频，前端播放。
7. 用户说话期间，前端同步用 `MediaRecorder` 录制 user turn 音频。

安全要求：

- 浏览器不能持有长期 API Key。
- 后端只签发短期 token 或临时 session。
- token 需要绑定用户、场景、模型、时长和费用上限。
- 后端记录 provider session id，方便追踪成本和排查问题。

### 4.3 辅路：后台教研链路

后台教研链路不打断用户对话，所有任务异步执行。

每个 user turn 结束后：

1. 前端生成 turn 级音频片段。
2. 前端将音频临时保存到 IndexedDB。
3. 前端上传音频到后端或对象存储。
4. 后端创建 `AudioSegment` 和异步 job。
5. Worker 执行 ASR。
6. Worker 基于 ASR 文本和最近上下文进行纠错。
7. Worker 对自由对话做轻量口语评估。
8. Session 结束后生成整体报告。

任务系统建议：

- P0 使用 BullMQ + Redis。
- 每个任务有明确状态：`pending`、`processing`、`succeeded`、`failed`。
- 前端通过 WebSocket 或 SSE 订阅任务进度。
- 失败任务支持重试，避免因为单个 ASR 或评测失败影响整个 session。

---

## 5. 数据模型设计

TalkForge 的核心数据单位不是 message，而是 turn。turn 是一次完整的用户或 AI 发言，后续 ASR、纠错、音频评测和报告都应围绕 turn 建模。

### 5.1 核心实体

```text
User
Scenario
ScenarioProgress
Session
Turn
AudioSegment
Transcript
Correction
PronunciationEvaluation
Report
```

### 5.2 Session

```ts
type Session = {
  id: string;
  userId: string;
  scenarioId: string;
  realtimeProvider: string;
  realtimeProviderSessionId?: string;
  status: "active" | "completed" | "failed";
  startedAt: string;
  endedAt?: string;
};
```

### 5.3 Turn

```ts
type Turn = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  startedAt: string;
  endedAt: string;
  transcriptText?: string;
  audioSegmentId?: string;
  evaluationStatus: "none" | "pending" | "processing" | "done" | "failed";
};
```

### 5.4 AudioSegment

```ts
type AudioSegment = {
  id: string;
  turnId: string;
  objectKey: string;
  format: "webm" | "wav" | "pcm";
  codec?: "opus" | "pcm_s16le";
  sampleRate?: number;
  durationMs: number;
  sizeBytes: number;
  createdAt: string;
};
```

### 5.5 Transcript

```ts
type Transcript = {
  id: string;
  turnId: string;
  provider: string;
  text: string;
  confidence?: number;
  segments: Array<{
    startMs: number;
    endMs: number;
    text: string;
    words?: Array<{
      word: string;
      startMs: number;
      endMs: number;
      confidence?: number;
    }>;
  }>;
};
```

### 5.6 Correction

```ts
type Correction = {
  id: string;
  turnId: string;
  type: "grammar" | "expression" | "vocabulary" | "clarity" | "asr_uncertain";
  originalText: string;
  correctedText?: string;
  explanation: string;
  confidence: number;
};
```

### 5.7 PronunciationEvaluation

```ts
type PronunciationEvaluation = {
  id: string;
  turnId: string;
  mode: "free_speech" | "shadowing";
  overallScore?: number;
  fluencyScore?: number;
  accuracyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  details?: unknown;
};
```

---

## 6. 音频存储策略

### 6.1 两段式存储

用户原始音频采用“两段式存储”：

- **前端临时存储：** IndexedDB 保存当前 session 的 user turn 音频片段，用于即时回放、断网恢复和上传失败重试。
- **后端正式存储：** 对象存储保存正式音频副本，数据库只保存 object key、时长、格式、采样率等元数据。

不建议把音频二进制直接存入 PostgreSQL。

### 6.2 音频格式

推荐策略：

- 浏览器录制：`webm/opus`，体积小，适合上传和长期留存。
- ASR 输入：根据 ASR Provider 要求传 `webm/opus` 或转换后的 `wav`。
- 发音评测输入：按评测 API 要求转换为 `wav/pcm 16kHz mono 16-bit` 或指定格式。
- 长期归档：保留 `webm/opus` 即可。

转码不应放在前端完成，建议由后端 worker 使用 FFmpeg 处理。

### 6.3 隐私与合规

音频属于敏感数据，应提供：

- 用户主动删除音频的能力。
- 默认保留周期，例如 7 天、30 天或按套餐配置。
- 隐私模式：不保存原声，只保存 transcript 和评分。
- 对象存储私有 bucket，不使用公开 URL。
- 下载/播放通过后端签名 URL 控制权限。

---

## 7. ASR 策略

### 7.1 P0 推荐：外部 ASR API

P0 阶段优先调用外部 ASR API，而不是自建 faster-whisper。

原因：

- 上线快，不需要处理 GPU、模型加载、显存、并发和冷启动。
- 外部 ASR 通常已经处理 VAD、标点、时间戳、多语种和噪声鲁棒性。
- P0 的核心风险是实时体验和学习闭环，不是 ASR 自研能力。
- 成本可通过 session 时长、上传策略和异步任务控制。

后端应该实现 `AsrProvider` 抽象，避免和具体厂商强绑定。

```ts
interface AsrProvider {
  transcribe(input: {
    audioObjectKey: string;
    language?: "en";
    wordTimestamps?: boolean;
  }): Promise<{
    text: string;
    confidence?: number;
    segments: Array<{
      startMs: number;
      endMs: number;
      text: string;
      words?: Array<{
        word: string;
        startMs: number;
        endMs: number;
        confidence?: number;
      }>;
    }>;
    provider: string;
  }>;
}
```

### 7.2 P2 可选：Python ASR Worker

后续如果需要降本、私有化或更强控制力，可以增加独立 Python ASR Worker：

```text
TypeScript Backend
  -> Redis Queue / Job
  -> Python ASR Worker
  -> faster-whisper
  -> Transcript JSON
```

不建议在 Next.js API Route 或 Node.js 进程里直接运行 faster-whisper。Next.js/TypeScript 后端适合作为编排层，ASR 推理服务适合由独立 Python 常驻服务承担。

---

## 8. 发音评测策略

### 8.1 自由对话和跟读评测分离

自由对话中的用户表达没有固定标准文本，不适合直接做严格音素级评分。否则会把 ASR 错误、用户语法错误、表达不完整和真实发音问题混在一起。

因此发音评测拆成两类：

1. **自由对话轻评估：** 用于对话中的 user turn，评估语速、停顿、流利度、可懂度、重复、犹豫等。
2. **Shadowing 跟读强评估：** 用于标准句跟读，有明确标准文本，可调用专业语音评测 API 做单词级、音素级、准确度和完整度评分。

### 8.2 调用时机

P0 建议：

- 每个 user turn 结束后异步入队。
- 对话过程中只做轻量处理，不阻塞实时对话。
- 课后报告页展示完整结果。
- Shadowing 跟读时一句一评，因为此时用户预期就是等待评分。

不建议：

- 每句话同步等待发音评测结果后再继续对话。
- 等整场对话结束后才开始处理所有音频。

### 8.3 标准发音来源

专业评测 API 通常返回评分、错误定位和评测细节，不负责自动提供标准母语音频。

TalkForge 应自行生成和缓存标准发音：

- 对内置场景的推荐句，预先用高质量 TTS 生成标准音频。
- 对课后动态生成的推荐句，首次生成后缓存。
- 标准音频与 `standardText`、voice、speed、provider 绑定。

---

## 9. 语法与表达纠错策略

### 9.1 调用时机

纠错分为两层：

- **进行中轻纠错：** 每个 user turn 完成后，基于 ASR 文本和最近 3-5 轮上下文异步分析，结果静默记录，不打断用户。
- **课后深度纠错：** session 结束后，基于完整 transcript 生成系统性总结，包括高频错误、替代表达、词汇丰富度、CEFR 估计和下次练习建议。

### 9.2 输入选择

P0 优先使用：

```text
Audio -> ASR -> Transcript -> Text LLM Correction
```

不建议把音频直接交给多模态模型作为主要纠错链路。原因是文本纠错更便宜、更稳定、更容易解释、更方便保存和复查。

音频模型可作为补充能力：

- ASR 低置信度时二次确认。
- 判断某些错误是否可能来自发音而非语法。
- 对关键片段进行更细粒度分析。

### 9.3 ASR 偏差处理

ASR 偏差不可避免，应在系统中显式建模。

处理策略：

- 保存 ASR confidence 和 word timestamps。
- 低置信度词不要强行纠错。
- 纠错结果区分 `grammar`、`expression`、`vocabulary`、`clarity`、`asr_uncertain`。
- Prompt 明确要求模型不要把明显 ASR 误识别当成语法错误。
- UI 上将“可能识别不准”和“确定表达错误”分开展示。

---

## 10. 技术选型

### 10.1 推荐 P0 技术栈

P0 推荐使用 TypeScript 全栈作为主工程：

- Frontend：Next.js + React + TypeScript
- State：Zustand
- Audio：Web Audio API + MediaRecorder + WebRTC/WebSocket
- Backend：Next.js Route Handlers 起步，或独立 NestJS/Fastify 服务
- Database：PostgreSQL
- ORM：Prisma 或 Drizzle
- Queue：BullMQ + Redis
- Storage：S3 / Cloudflare R2 / 阿里 OSS / MinIO
- Worker：Node.js Worker 起步
- ASR：外部 ASR API
- Realtime Model：Qwen Omni Realtime / Doubao Realtime 等
- Pronunciation Evaluation：科大讯飞语音评测 API 或同类服务

### 10.2 TypeScript 后端与 Python 后端的取舍

推荐结论：

- P0 使用 Next.js + TypeScript 后端。
- ASR 推理不要直接塞进 Next.js。
- 如需 faster-whisper，后续作为独立 Python Worker 接入。

原因：

- WebRTC、WebSocket、前后端类型共享、session token 和状态管理，TypeScript 全栈更顺。
- AI API 调用、队列、对象存储、PostgreSQL 和鉴权，Node.js 完全够用。
- P0 最大风险是实时体验和学习闭环，不是自研推理服务。
- Python 更适合作为后续 ASR、声学分析或模型实验 worker。

---

## 11. 核心工作流

### 11.1 场景初始化

1. 用户选择内置场景。
2. 前端请求后端创建 session。
3. 后端读取结构化场景，生成 realtime system instructions。
4. 后端返回场景 prompt、角色设定、目标词汇、推荐表达、exit policy 和 realtime token。
5. 前端初始化实时模型连接。

### 11.2 实时对话

1. 用户开口。
2. 音频通过 WebRTC/WebSocket 发送给实时模型。
3. 前端同时用 `MediaRecorder` 录制 user turn。
4. AI 返回流式音频，前端播放。
5. 用户可以打断 AI，实时模型处理 interrupt。
6. 后端按 turn 更新场景进度，必要时提示 AI 自然收尾。

### 11.3 Turn 完成

1. 前端检测到 user turn 结束。
2. 生成本地音频片段。
3. 保存到 IndexedDB。
4. 上传到对象存储。
5. 后端创建 `Turn`、`AudioSegment` 和 ASR job。
6. 后端根据轮数、时长和场景目标更新 `ScenarioProgress`。

### 11.4 后台处理

1. ASR Worker 生成 transcript。
2. Correction Worker 基于 transcript 和上下文生成纠错结果。
3. Evaluation Worker 做自由对话轻评估。
4. ScenarioProgress Worker 判断目标完成度和偏题情况。
5. 前端通过 WebSocket/SSE 接收处理状态。

### 11.5 场景结束

场景结束来源包括：

1. 用户手动结束。
2. 达到最大时长或最大轮数。
3. required goals 全部完成后，AI 建议结束并获得用户确认。
4. 长时间沉默或严重偏题，系统提示用户是否结束或重新开始。

结束后后端将 `Session.status` 更新为 `completed`，并触发报告生成任务。

### 11.6 课后报告

Session 结束后：

1. Report Worker 汇总所有 turn。
2. 生成本次练习总结。
3. 标出典型表达错误和更自然说法。
4. 选出适合跟读的句子。
5. 为跟读句生成或复用标准音频。
6. 用户进入 Shadowing UI 逐句跟读。

---

## 12. UI/UX 设计规范

视觉方向：Warm & Minimalist，避免冰冷的科幻感。

建议：

- 主色调可以使用奶油白、柔和桃色、浅灰、低饱和蓝绿作为辅助色。
- 对话页以沉浸式语音交互为主，不展示过多纠错信息。
- 对话页应提供明确但不突兀的结束按钮。
- 目标完成后，AI 可以自然询问用户是否结束本次练习。
- 纠错不在对话中打断用户，而是在右侧轻提示或课后报告中集中呈现。
- Voice Visualizer 使用流体/气泡状动态音波，表达生命感和呼吸感。
- 报告页重点展示“下一步怎么练”，不要只展示分数。
- Shadowing UI 应提供用户原声、标准音频、跟读录音、逐词反馈和重试。

---

## 13. 风险与兜底

### 13.1 实时模型风险

风险：

- 实时模型延迟不稳定。
- WebRTC 或 WebSocket 接入复杂。
- 厂商 API 变更。
- 成本较高。

兜底：

- 保留文本模式或 ASR-LLM-TTS fallback。
- 记录 provider latency、session cost 和失败率。
- 抽象 RealtimeProvider，避免和单一厂商强绑定。

### 13.2 ASR 风险

风险：

- ASR 误识别导致错误纠错。
- 噪声环境下 transcript 不稳定。

兜底：

- 保存 confidence。
- 低置信度内容单独标记。
- 关键片段支持用户手动修正 transcript。

### 13.3 发音评测风险

风险：

- 自由对话没有标准文本，音素级评分不可靠。
- 第三方评测接口输入格式严格，转码失败会影响评测。

兜底：

- 自由对话只做轻评估。
- 严格评分放到 Shadowing。
- Worker 中统一转码和重试。

### 13.4 场景控制风险

风险：

- 场景目标定义过弱，导致 AI 聊天发散。
- 结束条件过强，导致用户还没练够就被打断。
- LLM Judge 判断目标完成度不稳定。

兜底：

- P0 保留用户手动结束作为最高优先级。
- 使用最大轮数和最大时长作为保护性边界。
- required goals 全部完成后只建议结束，不强制结束。
- Judge 结果只作为进度参考，关键结束动作由规则和用户确认兜底。

---

## 14. 待确认决策

已经确认的方向：

- P0 采用 Next.js + TypeScript 作为主工程技术栈。
- ASR P0 优先调用外部 API。
- faster-whisper 后续作为独立 Python Worker 接入，不直接放入 Next.js。
- 用户音频采用前端 IndexedDB 临时缓存 + 后端对象存储正式保存。
- 纠错优先走 ASR 文本链路。
- 发音评测区分自由对话轻评估和 Shadowing 强评估。
- 场景采用结构化配置，包含角色、情境、目标、阶段、结束策略和评分规则。
- P0 采用用户手动结束 + 最大时长/轮数 + 目标完成后 AI 建议结束。

后续需要进一步确认：

- Realtime 模型首选供应商和备用供应商。
- 外部 ASR API 供应商。
- 对象存储选型。
- 音频默认保留周期。
- P0 内置场景数量和场景内容。
- 每个 P0 场景的 required goals、maxTurns 和 maxDurationSec。
- 是否需要用户手动修正 transcript 的能力。
