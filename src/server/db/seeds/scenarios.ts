import type { Scenario } from "@/domain/scenario";

export const coffeeOrderingScenario: Scenario = {
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
      completedWhen: "The learner clearly states a drink name.",
    },
    {
      id: "choose_size",
      description: "The learner chooses a size.",
      required: true,
      completedWhen:
        "The learner chooses small, medium, large, tall, grande, or venti.",
    },
    {
      id: "customize_order",
      description: "The learner answers at least one customization question.",
      required: true,
      completedWhen:
        "The learner answers milk, ice, sugar, temperature, or add-on preference.",
    },
    {
      id: "confirm_payment",
      description: "The learner confirms the order and payment.",
      required: true,
      completedWhen: "The order is repeated back and the learner confirms it.",
    },
  ],
  stages: [
    {
      id: "greeting",
      name: "Greeting",
      purpose: "Start the order naturally.",
      aiBehavior: "Greet the learner and ask what they would like.",
      expectedUserActions: ["greet", "state drink"],
    },
    {
      id: "customization",
      name: "Customization",
      purpose: "Ask follow-up questions.",
      aiBehavior: "Ask about size, temperature, milk, sweetness, or add-ons.",
      expectedUserActions: ["choose size", "answer customization"],
    },
    {
      id: "confirmation",
      name: "Confirmation",
      purpose: "Confirm the order.",
      aiBehavior: "Repeat the order and ask for confirmation.",
      expectedUserActions: ["confirm order"],
    },
    {
      id: "closing",
      name: "Closing",
      purpose: "Finish the transaction politely.",
      aiBehavior: "Give a price and close the interaction.",
      expectedUserActions: ["respond politely"],
    },
  ],
  vocabulary: ["latte", "americano", "iced", "hot", "medium", "oat milk"],
  targetExpressions: [
    "Could I get a medium latte?",
    "Can I have it iced?",
    "That's all, thank you.",
  ],
  constraints: [
    "Stay in character as a barista.",
    "Use short, natural sentences suitable for A2 learners.",
    "Do not correct grammar during the conversation unless the learner asks.",
  ],
  exitPolicy: {
    minTurns: 4,
    maxTurns: 12,
    maxDurationSec: 360,
    requiredGoals: [
      "choose_drink",
      "choose_size",
      "customize_order",
      "confirm_payment",
    ],
    endWhenGoalsCompleted: true,
    allowUserManualEnd: true,
    aiCanSuggestEnd: true,
  },
  evaluationRubric: {
    dimensions: [
      "task_completion",
      "fluency",
      "clarity",
      "grammar",
      "expression",
    ],
  },
};

export const seedScenarios: Scenario[] = [coffeeOrderingScenario];
