export const APP_TAGLINE_ZH = "AI 英语口语练习";

export const homeCopy = {
  title: "选择练习场景",
  subtitle: "选一个角色扮演，查看历史报告或开始新对话。",
  createCard: {
    badge: "新建",
    role: "自定义场景",
    title: "创建自定义场景",
    description: "描述你想练习的内容，TalkForge 将为你生成角色扮演场景。",
    cta: "创建场景",
    iconLabel: "创建新场景",
  },
  scenarioCta: "查看历史并开始练习",
};

export const navCopy = {
  backToScenarios: "返回全部场景",
  allScenarios: "全部场景",
  changeScenario: "更换场景",
  backToScenariosButton: "返回场景列表",
};

export const loadingCopy = {
  sessionAnalysis: "Loading session analysis…",
};

export const notFoundCopy = {
  title: "未找到该场景",
  description: "该练习场景不存在，请从场景库中选择一个。",
};

export const scenarioCreateCopy = {
  title: "创建自定义场景",
  subtitle:
    "用日常语言描述你想练习的内容。TalkForge 会生成结构化角色扮演场景，保存前你可以先预览确认。",
  requestLabel: "场景需求",
  placeholder: "例如：我想练习在餐厅点餐，难度大约 A2。",
  generate: "生成场景",
  regenerate: "重新生成",
  generating: "生成中…",
  saving: "保存中…",
  confirm: "确认并添加场景",
  showDetails: "查看目标与阶段",
  hideDetails: "收起详情",
  goals: "目标",
  stages: "阶段",
  targetExpressions: "目标表达",
  required: "（必达）",
  generateFailed: "场景生成失败，请重试。",
  saveFailed: "场景保存失败，请重试。",
};

export const scenarioEntryCopy = {
  startConversation: "开始对话",
  practiceHistory: "练习历史",
  loadingHistory: "正在加载历史报告…",
  loadHistoryError: "无法加载练习历史，你仍可以开始新对话。",
  emptyHistory: "还没有历史报告，点击下方开始你的第一次对话。",
  historicalReportFailed: "报告生成失败，可重试生成或查看对话详情。",
  historicalReportGenerating: "报告正在生成中…",
  historicalReportRetrying: "正在重新生成报告…",
  viewSessionDetails: "查看详情",
};

export const conversationCopy = {
  voicePractice: "语音练习",
  endPractice: "结束练习",
  interruptAi: "打断 AI",
  sendPracticeResponse: "发送练习回复",
  retryVoiceConnection: "重试语音连接",
  continueTextPractice: "继续使用文字练习",
  changeScenario: "更换场景",
  micLowHint:
    "麦克风音量过低（峰值 < 0.01）。请检查 Windows 输入音量、选择正确的输入设备、使用耳机，或在 .env 中提高 NEXT_PUBLIC_REALTIME_MIC_GAIN=8。",
  bargeInHint: "清晰说话即可打断 AI，或使用「打断 AI」按钮。",
  sessionEnded: "练习已结束。处理完成后可在下方查看练习报告。",
  endingSuggestions: {
    goalsComplete: "你已完成主要场景目标，准备好了就可以结束练习。",
    maxTurns: "本次练习已达到回合上限，可以结束练习了。",
    maxDuration: "本次练习已达到时长上限，可以结束练习了。",
    default: "准备好了就可以结束练习。",
  },
};

export const statusCopy = {
  realtime: "实时连接",
  turnLabel: "回合",
  session: "会话",
  evaluation: "发音反馈",
  debug: "调试",
  endingSession: "Ending session…",
  evaluationPlaceholder: "Feedback appears after each turn",
  sessionStatus: {
    active: "In progress",
    completed: "Completed",
    failed: "Failed",
  },
  turnStatus: {
    idle: "Your turn",
    user_speaking: "Speaking",
    user_processing: "Processing your speech",
    assistant_speaking: "AI speaking",
    assistant_processing: "AI thinking",
  },
};

export const voiceVisualizerCopy = {
  listening: "正在听你说话…",
  aiResponding: "AI 正在回应…",
  processing: "处理中…",
};

export const transcriptCopy = {
  title: "对话记录",
  empty: "会话开始后将在此显示对话记录。",
  roleAssistant: "AI",
  roleUser: "You",
  analyzing: "Analyzing pronunciation…",
  evaluationSkipped: "未上传音频，已跳过发音评估",
  evaluationFailed: "本轮发音评估暂不可用。",
  scoreNote: "评分基于本轮识别出的文本。",
};

export const reportCopy = {
  title: "练习报告",
  generating: "正在生成练习报告…",
  unavailable:
    "报告暂不可用。请确认 worker 已启动且 provider 配置正确，然后重试生成。",
  retry: "重试生成报告",
  taskCompletion: "任务完成情况",
  completed: "已完成",
  stillToPractice: "仍需练习",
  none: "无",
  keyCorrections: "重点纠错",
  alternativeExpressions: "替代表达",
  shadowingRecommendations: "跟读推荐",
  nextPractice: "下次练习建议",
};

export const shadowingCopy = {
  title: "跟读练习",
  loading: "正在准备推荐句子和标准音频…",
  unavailable: "跟读内容暂不可用。请等待练习报告处理完成后再试。",
  summary:
    "跟着标准音频练习这些句子。服务端发音评分可通过跟读评估 API 使用；应用内录音与评分展示将在后续任务中上线。",
  yourPhrase: "你的表达",
  audioReady: "标准音频已就绪",
  audioReadyDuration: (durationLabel: string) => `标准音频已就绪（${durationLabel}）`,
  audioUnavailable: "标准音频暂不可用",
  generatingAudio: "正在生成标准音频…",
  playStandardAudio: "播放标准音频",
  pauseStandardAudio: "暂停",
  loadingAudio: "加载音频…",
  playbackFailed: "无法播放标准音频",
};

export const pronunciationCopy = {
  analyzing: "正在分析发音…",
  skipped: "未上传音频，已跳过发音评估",
  unavailable: "本轮发音评估暂不可用",
  overall: (score: number) => `综合 ${Math.round(score)}`,
  accuracy: (score: number) => `准确度 ${Math.round(score)}`,
  fluency: (score: number) => `流畅度 ${Math.round(score)}`,
  completeness: (score: number) => `完整度 ${Math.round(score)}`,
  weakLegend: "橙色高亮表示该词发音较弱（得分低于 60）",
  wordScore: (word: string, score: number) => `${word}：${score} 分`,
  scoreNote: "评分基于本轮识别出的文本。",
};

export const taskCompletionCopy = {
  scoreCompleted: (score: number, completed: number, total: number) =>
    `已完成 ${score}% 目标（${completed}/${total}）`,
  unavailable: "任务完成情况暂不可用",
  countCompleted: (completed: number, total: number) =>
    `已完成 ${completed}/${total} 个目标`,
};

export const errorCopy = {
  startSessionFailed: "无法开始练习会话，请重试。",
  submitTurnFailed: "无法提交练习回复，请重试。",
  endSessionFailed: "无法正常结束会话，请刷新页面后重试。",
  realtimeFailed: "实时语音连接失败，请重试或继续使用文字练习模式。",
  fetchReportsFailed: (status: number) => `获取场景报告失败（${status}）。`,
  generic: "出了点问题，请重试。",
  providerFallback: "服务暂时不可用，请稍后再试。",
  providerConfig:
    "语音或教学服务尚未完全配置，若问题持续请联系支持。",
  providerRateLimit: "服务当前较忙，请稍后再试。",
  providerTimeout: "请求超时，请检查网络后重试。",
  providerUnavailable:
    "语音或教学服务暂时不可用，你可以重试或继续使用文字练习模式。",
};

export const usageLimitCopy = {
  turnLimit: "本次练习已达到回合上限，结束练习后可查看报告。",
  durationLimit: "本次练习已达到时长上限，结束练习后可查看报告。",
  asrLimit: "本次练习已达到转写上限，请结束练习并查看已有反馈。",
  reportLimit: "本次练习的报告生成暂时不可用，请稍后再试。",
};
