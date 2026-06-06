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

export const englishInterviewScenario: Scenario = {
  id: "english_interview_b1",
  title: "English Job Interview",
  description: "Practice answering common interview questions in English.",
  level: "B1",
  userRole: "job candidate",
  aiRole: "interviewer",
  situation:
    "The learner is in a first-round interview for a junior office role.",
  mission:
    "Help the learner introduce themselves and answer common interview questions clearly.",
  goals: [
    {
      id: "self_introduction",
      description: "The learner gives a brief self-introduction.",
      required: true,
      completedWhen:
        "The learner mentions their background, skills, or current role.",
    },
    {
      id: "strengths",
      description: "The learner describes a strength or achievement.",
      required: true,
      completedWhen:
        "The learner explains at least one strength with a short example.",
    },
    {
      id: "motivation",
      description: "The learner explains why they want the role.",
      required: true,
      completedWhen:
        "The learner gives a reason for applying or interest in the company.",
    },
    {
      id: "closing_question",
      description: "The learner asks or answers a closing interview question.",
      required: true,
      completedWhen:
        "The learner asks the interviewer a question or responds to a final prompt.",
    },
  ],
  stages: [
    {
      id: "opening",
      name: "Opening",
      purpose: "Set a professional tone.",
      aiBehavior: "Welcome the candidate and ask them to introduce themselves.",
      expectedUserActions: ["introduce background"],
    },
    {
      id: "experience",
      name: "Experience",
      purpose: "Explore relevant experience.",
      aiBehavior: "Ask about strengths, experience, or a past achievement.",
      expectedUserActions: ["describe strength", "give example"],
    },
    {
      id: "motivation",
      name: "Motivation",
      purpose: "Understand fit for the role.",
      aiBehavior: "Ask why the candidate wants this job or company.",
      expectedUserActions: ["explain motivation"],
    },
    {
      id: "closing",
      name: "Closing",
      purpose: "Wrap up professionally.",
      aiBehavior: "Invite final questions and thank the candidate.",
      expectedUserActions: ["ask question", "respond politely"],
    },
  ],
  vocabulary: [
    "responsible",
    "teamwork",
    "experience",
    "strength",
    "motivated",
    "role",
  ],
  targetExpressions: [
    "I have experience in customer service.",
    "One of my strengths is staying organized under pressure.",
    "I'm interested in this role because I want to grow in a collaborative team.",
    "Do you have any questions for me?",
  ],
  constraints: [
    "Stay in character as a professional interviewer.",
    "Ask one clear question at a time.",
    "Keep follow-up questions supportive, not intimidating.",
  ],
  exitPolicy: {
    minTurns: 6,
    maxTurns: 16,
    maxDurationSec: 600,
    requiredGoals: [
      "self_introduction",
      "strengths",
      "motivation",
      "closing_question",
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
      "professionalism",
    ],
  },
};

export const selfIntroductionScenario: Scenario = {
  id: "self_introduction_a2",
  title: "Self Introduction",
  description: "Practice introducing yourself in everyday English.",
  level: "A2",
  userRole: "new acquaintance",
  aiRole: "friendly host at a social meetup",
  situation:
    "The learner has just arrived at a casual English conversation meetup.",
  mission: "Help the learner introduce themselves naturally to someone new.",
  goals: [
    {
      id: "share_name",
      description: "The learner shares their name.",
      required: true,
      completedWhen: "The learner clearly states their name.",
    },
    {
      id: "share_origin",
      description: "The learner mentions where they are from or live.",
      required: true,
      completedWhen:
        "The learner mentions their hometown, country, or current city.",
    },
    {
      id: "share_interest",
      description: "The learner mentions a hobby or interest.",
      required: true,
      completedWhen:
        "The learner talks about at least one hobby, job, or interest.",
    },
    {
      id: "ask_reciprocal",
      description: "The learner asks the host a simple question back.",
      required: true,
      completedWhen:
        "The learner asks a polite follow-up question about the host or event.",
    },
  ],
  stages: [
    {
      id: "welcome",
      name: "Welcome",
      purpose: "Make the learner feel comfortable.",
      aiBehavior: "Welcome the learner and ask their name.",
      expectedUserActions: ["share name"],
    },
    {
      id: "background",
      name: "Background",
      purpose: "Learn basic personal details.",
      aiBehavior: "Ask where the learner is from or what they do.",
      expectedUserActions: ["share origin", "share job or study"],
    },
    {
      id: "interests",
      name: "Interests",
      purpose: "Keep the conversation friendly.",
      aiBehavior: "Ask about hobbies or why they joined the meetup.",
      expectedUserActions: ["share interest"],
    },
    {
      id: "wrap_up",
      name: "Wrap Up",
      purpose: "End with a reciprocal question.",
      aiBehavior: "Share a short detail and invite the learner to ask something.",
      expectedUserActions: ["ask reciprocal question"],
    },
  ],
  vocabulary: ["from", "live", "work", "study", "hobby", "like"],
  targetExpressions: [
    "Nice to meet you. My name is Alex.",
    "I'm from Shanghai, but I live in Beijing now.",
    "In my free time, I enjoy reading and hiking.",
    "What about you?",
  ],
  constraints: [
    "Stay warm and encouraging like a friendly host.",
    "Use simple follow-up questions suitable for A2 learners.",
    "Do not overwhelm the learner with too many questions at once.",
  ],
  exitPolicy: {
    minTurns: 4,
    maxTurns: 10,
    maxDurationSec: 300,
    requiredGoals: ["share_name", "share_origin", "share_interest", "ask_reciprocal"],
    endWhenGoalsCompleted: true,
    allowUserManualEnd: true,
    aiCanSuggestEnd: true,
  },
  evaluationRubric: {
    dimensions: ["task_completion", "fluency", "clarity", "grammar", "expression"],
  },
};

export const meetingUpdateScenario: Scenario = {
  id: "meeting_update_b1",
  title: "Team Meeting Update",
  description: "Practice giving a short progress update in a team meeting.",
  level: "B1",
  userRole: "team member",
  aiRole: "project lead",
  situation:
    "The learner is joining a weekly team stand-up and needs to share a project update.",
  mission:
    "Help the learner give a concise status update and respond to one follow-up question.",
  goals: [
    {
      id: "state_progress",
      description: "The learner summarizes what they completed recently.",
      required: true,
      completedWhen:
        "The learner mentions at least one completed task or milestone.",
    },
    {
      id: "state_plan",
      description: "The learner shares what they plan to do next.",
      required: true,
      completedWhen:
        "The learner mentions a next step, plan, or upcoming task.",
    },
    {
      id: "mention_blocker",
      description: "The learner mentions a blocker or says there is none.",
      required: true,
      completedWhen:
        "The learner identifies a blocker or clearly says they have no blockers.",
    },
    {
      id: "answer_follow_up",
      description: "The learner answers a follow-up from the project lead.",
      required: true,
      completedWhen:
        "The learner responds to a clarifying question about timing, priority, or support.",
    },
  ],
  stages: [
    {
      id: "check_in",
      name: "Check In",
      purpose: "Start the stand-up update.",
      aiBehavior: "Ask the learner for their update on current work.",
      expectedUserActions: ["state progress"],
    },
    {
      id: "next_steps",
      name: "Next Steps",
      purpose: "Understand upcoming work.",
      aiBehavior: "Ask what they will focus on next.",
      expectedUserActions: ["state plan"],
    },
    {
      id: "blockers",
      name: "Blockers",
      purpose: "Surface risks early.",
      aiBehavior: "Ask whether anything is blocking progress.",
      expectedUserActions: ["mention blocker"],
    },
    {
      id: "follow_up",
      name: "Follow Up",
      purpose: "Clarify one detail.",
      aiBehavior: "Ask one follow-up about timing, priority, or support needed.",
      expectedUserActions: ["answer follow-up"],
    },
  ],
  vocabulary: [
    "progress",
    "deadline",
    "blocker",
    "priority",
    "on track",
    "support",
  ],
  targetExpressions: [
    "This week I finished the first draft of the report.",
    "Next, I'll review the feedback and update the slides.",
    "I don't have any blockers right now.",
    "I may need support from design by Friday.",
  ],
  constraints: [
    "Stay in character as a supportive project lead.",
    "Keep questions focused on one update at a time.",
    "Use professional but approachable language.",
  ],
  exitPolicy: {
    minTurns: 4,
    maxTurns: 12,
    maxDurationSec: 420,
    requiredGoals: [
      "state_progress",
      "state_plan",
      "mention_blocker",
      "answer_follow_up",
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
      "professionalism",
    ],
  },
};

export const travelDirectionsScenario: Scenario = {
  id: "travel_directions_a2",
  title: "Ask for Travel Directions",
  description: "Practice asking for and understanding directions while traveling.",
  level: "A2",
  userRole: "traveler",
  aiRole: "local passerby",
  situation:
    "The learner is visiting a new city and needs help finding a nearby place.",
  mission:
    "Help the learner ask for directions politely and confirm they understand the route.",
  goals: [
    {
      id: "state_destination",
      description: "The learner says where they want to go.",
      required: true,
      completedWhen:
        "The learner names a destination such as a station, museum, or hotel.",
    },
    {
      id: "ask_directions",
      description: "The learner asks how to get there.",
      required: true,
      completedWhen:
        "The learner asks for directions using a polite question.",
    },
    {
      id: "confirm_route",
      description: "The learner confirms part of the directions.",
      required: true,
      completedWhen:
        "The learner repeats or confirms a landmark, turn, or travel method.",
    },
    {
      id: "thank_and_close",
      description: "The learner thanks the helper and closes politely.",
      required: true,
      completedWhen: "The learner thanks the local and ends the exchange politely.",
    },
  ],
  stages: [
    {
      id: "approach",
      name: "Approach",
      purpose: "Start the interaction politely.",
      aiBehavior: "Respond to the traveler and ask what they are looking for.",
      expectedUserActions: ["greet", "state destination"],
    },
    {
      id: "directions",
      name: "Directions",
      purpose: "Provide simple route guidance.",
      aiBehavior: "Give clear directions with landmarks and left/right turns.",
      expectedUserActions: ["ask directions", "listen"],
    },
    {
      id: "confirmation",
      name: "Confirmation",
      purpose: "Check understanding.",
      aiBehavior: "Ask whether the route makes sense or offer to repeat it.",
      expectedUserActions: ["confirm route"],
    },
    {
      id: "closing",
      name: "Closing",
      purpose: "End helpfully.",
      aiBehavior: "Wish the traveler a good trip and close warmly.",
      expectedUserActions: ["thank and close"],
    },
  ],
  vocabulary: [
    "turn left",
    "turn right",
    "straight",
    "station",
    "block",
    "nearby",
  ],
  targetExpressions: [
    "Excuse me, could you tell me how to get to the train station?",
    "Is it far from here?",
    "So I go straight and then turn left?",
    "Thank you very much for your help.",
  ],
  constraints: [
    "Stay in character as a helpful local passerby.",
    "Give directions in short, clear steps.",
    "Offer to repeat directions if the learner seems unsure.",
  ],
  exitPolicy: {
    minTurns: 4,
    maxTurns: 12,
    maxDurationSec: 360,
    requiredGoals: [
      "state_destination",
      "ask_directions",
      "confirm_route",
      "thank_and_close",
    ],
    endWhenGoalsCompleted: true,
    allowUserManualEnd: true,
    aiCanSuggestEnd: true,
  },
  evaluationRubric: {
    dimensions: ["task_completion", "fluency", "clarity", "grammar", "expression"],
  },
};

export const seedScenarios: Scenario[] = [
  coffeeOrderingScenario,
  englishInterviewScenario,
  selfIntroductionScenario,
  meetingUpdateScenario,
  travelDirectionsScenario,
];
