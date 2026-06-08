import type { CefrLevel } from "@/domain/enums";

export type CefrLevelGuideEntry = {
  level: CefrLevel;
  label: string;
  summary: string;
};

/** User-facing CEFR explanations (Chinese UI). */
export const CEFR_LEVEL_GUIDE: CefrLevelGuideEntry[] = [
  {
    level: "A1",
    label: "入门",
    summary: "简单单词与短句，适合刚开始开口练习。",
  },
  {
    level: "A2",
    label: "基础",
    summary: "日常简单对话，如点餐、问路、自我介绍。",
  },
  {
    level: "B1",
    label: "中级",
    summary: "熟悉话题的交流，能表达基本观点与需求。",
  },
  {
    level: "B2",
    label: "中高级",
    summary: "工作、旅行等场景下较流利的独立对话。",
  },
  {
    level: "C1",
    label: "高级",
    summary: "复杂话题下自然、准确的口语表达。",
  },
];

export const cefrLevelGuideCopy = {
  title: "难度级别说明（CEFR）",
  intro:
    "卡片上的 A1–C1 是欧洲语言共同参考标准（CEFR），表示练习时 AI 使用的英语复杂度，不代表你的「认证等级」。",
  createHint:
    "你可以在需求里写明期望难度（如「大约 A2」）。生成结果的标题与描述为中文展示；对话目标、推荐表达等练习内容为英文。",
};
