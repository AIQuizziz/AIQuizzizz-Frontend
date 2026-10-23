/**
 * Xuất / nhập câu hỏi dạng JSON (định dạng "aiquizzizz/questions", server đọc và kiểm tra) + prompt mẫu để người dùng
 * nhờ AI (ChatGPT, Gemini, Claude...) tạo JSON rồi dán vào hệ thống.
 */
export const QUESTION_JSON_FORMAT = "aiquizzizz/questions";
export const QUESTION_JSON_MAX_QUESTIONS = 500;
/** Kích thước tối đa của nội dung JSON (khớp giới hạn server: 2 triệu ký tự) */
export const QUESTION_JSON_MAX_LENGTH = 2_000_000;

export const QUESTION_JSON_TYPES = ["MultipleChoice", "Matching", "Ordering", "ShortText"] as const;
export type QuestionJsonType = (typeof QUESTION_JSON_TYPES)[number];

/** Tên / mô tả / thẻ của bộ đọc từ JSON (trang tạo bộ dùng để điền sẵn ô còn trống) */
export interface ImportedSetInfo {
    name?: string | null;
    description?: string | null;
    tags?: string[] | null;
}

export type PromptLocale = "vn" | "en";
export type PromptDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface QuestionPromptOptions {
    topic: string;
    count: number;
    types: QuestionJsonType[];
    /** ngôn ngữ của câu hỏi (không phải ngôn ngữ prompt) */
    questionLanguage: string;
    difficulty: PromptDifficulty;
    /** yêu cầu thêm của người dùng (tuỳ chọn) */
    notes?: string;
}

/** File mẫu: đủ 4 dạng câu hỏi, đúng định dạng server đọc */
export const QUESTION_JSON_EXAMPLE = {
    format: QUESTION_JSON_FORMAT,
    version: 1,
    questionSet: {
        name: "Hệ Mặt Trời",
        description: "Kiến thức cơ bản về các hành tinh",
        tags: ["thiên văn", "khoa học"],
    },
    questions: [
        {
            type: "MultipleChoice",
            content: "Hành tinh nào lớn nhất trong Hệ Mặt Trời?",
            points: 1,
            explanation: "Sao Mộc có đường kính khoảng 143.000 km, lớn nhất Hệ Mặt Trời.",
            options: [
                { text: "Sao Thổ", correct: false },
                { text: "Sao Mộc", correct: true },
                { text: "Trái Đất", correct: false },
                { text: "Sao Hải Vương", correct: false },
            ],
        },
        {
            type: "Matching",
            content: "Nối hành tinh với đặc điểm của nó",
            points: 2,
            pairs: [
                { left: "Sao Hoả", right: "Hành tinh đỏ" },
                { left: "Sao Thổ", right: "Có vành đai nổi bật" },
                { left: "Sao Kim", right: "Nóng nhất" },
            ],
        },
        {
            type: "Ordering",
            content: "Sắp xếp các hành tinh theo khoảng cách tới Mặt Trời (gần → xa)",
            points: 2,
            items: ["Sao Thuỷ", "Sao Kim", "Trái Đất", "Sao Hoả"],
        },
        {
            type: "ShortText",
            content: "Vệ tinh tự nhiên duy nhất của Trái Đất tên là gì?",
            points: 1,
            answer: "Mặt Trăng",
        },
    ],
};

export const exampleQuestionJson = () => JSON.stringify(QUESTION_JSON_EXAMPLE, null, 2);

const TYPE_RULES: Record<PromptLocale, Record<QuestionJsonType, string>> = {
    vn: {
        MultipleChoice:
            'MultipleChoice: 2–10 "options" {"text", "correct"}, ít nhất 1 lựa chọn "correct": true, các lựa chọn không trùng nội dung.',
        Matching:
            'Matching: 2–10 "pairs" {"left", "right"}; vế trái không trùng nhau, vế phải không trùng nhau.',
        Ordering:
            'Ordering: 2–10 "items" (chuỗi) liệt kê theo THỨ TỰ ĐÚNG — hệ thống tự xáo trộn khi làm bài.',
        ShortText:
            'ShortText: "answer" là MỘT đáp án ngắn, rõ ràng (một từ, cụm từ hoặc số), người làm bài gõ lại được chính xác.',
    },
    en: {
        MultipleChoice:
            'MultipleChoice: 2–10 "options" {"text", "correct"}, at least one option with "correct": true, no duplicate option texts.',
        Matching:
            'Matching: 2–10 "pairs" {"left", "right"}; left items are unique, right items are unique.',
        Ordering:
            'Ordering: 2–10 "items" (strings) listed in the CORRECT order — the system shuffles them for learners.',
        ShortText:
            'ShortText: "answer" is ONE short, unambiguous answer (a word, phrase or number) the learner can type exactly.',
    },
};

const DIFFICULTY_TEXT: Record<PromptLocale, Record<PromptDifficulty, string>> = {
    vn: { easy: "dễ", medium: "trung bình", hard: "khó", mixed: "trộn dễ, trung bình và khó" },
    en: { easy: "easy", medium: "medium", hard: "hard", mixed: "a mix of easy, medium and hard" },
};

/** Khung JSON đưa vào prompt: chỉ gồm các dạng được chọn */
const promptSkeleton = (types: QuestionJsonType[]) =>
    JSON.stringify(
        {
            format: QUESTION_JSON_FORMAT,
            version: 1,
            questionSet: QUESTION_JSON_EXAMPLE.questionSet,
            questions: QUESTION_JSON_EXAMPLE.questions.filter((q) =>
                types.includes(q.type as QuestionJsonType),
            ),
        },
        null,
        2,
    );

export const clampQuestionCount = (count: number) =>
    Math.min(QUESTION_JSON_MAX_QUESTIONS, Math.max(1, Math.round(Number(count) || 1)));

/** Prompt mẫu để dán vào ChatGPT / Gemini / Claude... AI trả về JSON đúng định dạng nhập của hệ thống */
export function buildQuestionJsonPrompt(options: QuestionPromptOptions, locale: PromptLocale = "vn") {
    const types = QUESTION_JSON_TYPES.filter((x) => options.types.includes(x));
    const usedTypes = types.length > 0 ? types : [...QUESTION_JSON_TYPES];
    const count = clampQuestionCount(options.count);
    const topic = options.topic.trim() || (locale === "vn" ? "(điền chủ đề)" : "(your topic)");
    const language = options.questionLanguage.trim() || (locale === "vn" ? "Tiếng Việt" : "English");
    const difficulty = DIFFICULTY_TEXT[locale][options.difficulty] ?? DIFFICULTY_TEXT[locale].mixed;
    const notes = options.notes?.trim();
    const rules = usedTypes.map((x) => `   - ${TYPE_RULES[locale][x]}`).join("\n");

    if (locale === "en") {
        return [
            `You are an experienced teacher. Create ${count} quiz questions about: "${topic}".`,
            `- Question language: ${language}`,
            `- Difficulty: ${difficulty}`,
            `- Question types to use: ${usedTypes.join(", ")} (spread them sensibly)`,
            ...(notes ? [`- Extra requirements: ${notes}`] : []),
            "",
            "Return ONLY one valid JSON object (no explanations, no text before or after) with exactly this structure:",
            "",
            promptSkeleton(usedTypes),
            "",
            "Rules:",
            `1. "type" is one of: ${usedTypes.join(", ")}.`,
            "2. Type-specific fields:",
            rules,
            '3. "content": the question, at most 5000 characters; each option / item / answer at most 1000 characters.',
            '4. "points": a number from 0 to 999 (use 1 if unsure). "explanation": a short reason why the answer is correct.',
            '5. Plain text only (no HTML). If you need formulas, code or lists, write Markdown and add "textFormat": "Markdown" to that question.',
            '6. "questionSet": a short title (≤ 100 characters), a description (≤ 200 characters) and at most 5 tags.',
            "7. Facts must be accurate; do not repeat questions; every question must have exactly the answer(s) marked correct.",
        ].join("\n");
    }

    return [
        `Bạn là giáo viên giàu kinh nghiệm. Hãy soạn ${count} câu hỏi về chủ đề: "${topic}".`,
        `- Ngôn ngữ câu hỏi: ${language}`,
        `- Độ khó: ${difficulty}`,
        `- Dạng câu hỏi dùng: ${usedTypes.join(", ")} (phân bổ hợp lý)`,
        ...(notes ? [`- Yêu cầu thêm: ${notes}`] : []),
        "",
        "Chỉ trả về DUY NHẤT một đối tượng JSON hợp lệ (không giải thích, không viết gì trước hoặc sau) theo đúng cấu trúc:",
        "",
        promptSkeleton(usedTypes),
        "",
        "Quy tắc:",
        `1. "type" chỉ nhận: ${usedTypes.join(", ")}.`,
        "2. Trường riêng theo dạng câu hỏi:",
        rules,
        '3. "content": nội dung câu hỏi, tối đa 5000 ký tự; mỗi lựa chọn / mục / đáp án tối đa 1000 ký tự.',
        '4. "points": số từ 0 đến 999 (không chắc thì để 1). "explanation": giải thích ngắn vì sao đáp án đúng.',
        '5. Chỉ dùng văn bản thường (không HTML). Cần công thức, code, danh sách thì viết Markdown và thêm "textFormat": "Markdown" cho câu đó.',
        '6. "questionSet": tên ngắn (≤ 100 ký tự), mô tả (≤ 200 ký tự), tối đa 5 thẻ.',
        "7. Kiến thức phải chính xác, không lặp câu hỏi, mỗi câu chỉ đánh dấu đúng (các) đáp án đúng.",
    ].join("\n");
}

/** Tên file xuất: tên bộ câu hỏi bỏ dấu, chỉ còn chữ / số / gạch nối */
export function questionJsonFileName(name?: string | null) {
    const slug = (name ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");
    return `${slug || "questions"}.json`;
}

/** Bỏ các trường null / undefined (file xuất gọn, dễ sửa tay) */
export function stripEmpty<T>(value: T): T {
    if (Array.isArray(value)) return value.map(stripEmpty) as T;
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => [k, stripEmpty(v)]),
        ) as T;
    }
    return value;
}

/** Tải xuống nội dung JSON thành file */
export function downloadJsonFile(fileName: string, data: unknown) {
    const text = typeof data === "string" ? data : JSON.stringify(stripEmpty(data), null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const isJsonFile = (file: File) =>
    /\.(json|txt)$/i.test(file.name) || file.type === "application/json" || file.type === "text/plain";

/**
 * Điền tên / mô tả / thẻ của bộ từ JSON vào form tạo bộ: chỉ điền ô còn trống, cắt theo giới hạn của form
 * (tên 100, mô tả 200 ký tự, tối đa 5 thẻ mỗi thẻ 50 ký tự, bỏ trùng).
 */
export function fillEmptySetInfo(
    form: { name: string; description: string; tags: string[] },
    info?: ImportedSetInfo | null,
) {
    if (!info) return;
    if (!form.name.trim() && info.name?.trim()) form.name = info.name.trim().slice(0, 100);
    if (!form.description.trim() && info.description?.trim())
        form.description = info.description.trim().slice(0, 200);
    if (form.tags.length === 0 && info.tags?.length) {
        const tags = info.tags.map((x) => x?.trim()).filter((x): x is string => !!x && x.length <= 50);
        form.tags = [...new Set(tags)].slice(0, 5);
    }
}
