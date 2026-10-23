import { describe, expect, it } from "vitest";
import {
    QUESTION_JSON_EXAMPLE,
    buildQuestionJsonPrompt,
    clampQuestionCount,
    exampleQuestionJson,
    fillEmptySetInfo,
    questionJsonFileName,
    stripEmpty,
} from "@/services/QuestionJsonService";

const baseOptions = {
    topic: "Hệ Mặt Trời",
    count: 15,
    types: ["MultipleChoice", "ShortText"] as const,
    questionLanguage: "Tiếng Việt",
    difficulty: "hard" as const,
};

describe("QuestionJsonService", () => {
    it("file mẫu: đủ 4 dạng câu hỏi, đúng định dạng", () => {
        const parsed = JSON.parse(exampleQuestionJson());
        expect(parsed.format).toBe("aiquizzizz/questions");
        expect(parsed.questions.map((q: { type: string }) => q.type)).toEqual([
            "MultipleChoice",
            "Matching",
            "Ordering",
            "ShortText",
        ]);
        expect(parsed.questions[0].options.some((o: { correct: boolean }) => o.correct)).toBe(true);
    });

    it("prompt: có chủ đề, số câu, độ khó và chỉ khung JSON của dạng được chọn", () => {
        const prompt = buildQuestionJsonPrompt({ ...baseOptions, types: [...baseOptions.types] }, "vn");
        expect(prompt).toContain('soạn 15 câu hỏi về chủ đề: "Hệ Mặt Trời"');
        expect(prompt).toContain("Độ khó: khó");
        expect(prompt).toContain('"type" chỉ nhận: MultipleChoice, ShortText.');
        expect(prompt).toContain('"options"');
        expect(prompt).toContain('"answer"');
        expect(prompt).not.toContain('"pairs"');
        expect(prompt).not.toContain('"type": "Ordering"');
    });

    it("prompt: khung JSON trong prompt là JSON hợp lệ", () => {
        const prompt = buildQuestionJsonPrompt({ ...baseOptions, types: [] }, "en");
        // khối JSON: từ dòng "{" tới dòng "}" đầu tiên (phần quy tắc phía sau cũng có ngoặc nhọn)
        const json = prompt.match(/^\{\n[\s\S]*?\n\}$/m)![0];
        expect(JSON.parse(json).questions).toHaveLength(QUESTION_JSON_EXAMPLE.questions.length);
        expect(prompt).toContain("Create 15 quiz questions");
        // không chọn dạng nào -> dùng cả 4 dạng
        expect(prompt).toContain("MultipleChoice, Matching, Ordering, ShortText");
    });

    it("prompt: chủ đề trống, có yêu cầu thêm", () => {
        const prompt = buildQuestionJsonPrompt(
            { ...baseOptions, types: ["Ordering"], topic: "  ", notes: " mỗi câu có giải thích " },
            "vn",
        );
        expect(prompt).toContain('"(điền chủ đề)"');
        expect(prompt).toContain("- Yêu cầu thêm: mỗi câu có giải thích");
    });

    it("clampQuestionCount: 1..500", () => {
        expect(clampQuestionCount(0)).toBe(1);
        expect(clampQuestionCount(NaN)).toBe(1);
        expect(clampQuestionCount(12.6)).toBe(13);
        expect(clampQuestionCount(9999)).toBe(500);
    });

    it("questionJsonFileName: bỏ dấu, chỉ chữ / số / gạch nối", () => {
        expect(questionJsonFileName("Ôn tập MongoDB 7.x")).toBe("on-tap-mongodb-7-x.json");
        expect(questionJsonFileName("Đề kiểm tra: Địa lý!")).toBe("de-kiem-tra-dia-ly.json");
        expect(questionJsonFileName("")).toBe("questions.json");
        expect(questionJsonFileName("日本語")).toBe("questions.json");
    });

    it("stripEmpty: bỏ null / undefined ở mọi cấp, giữ false / 0 / chuỗi rỗng", () => {
        expect(
            stripEmpty({ a: null, b: 0, c: false, d: "", e: [{ x: null, y: 1 }], f: { g: undefined } }),
        ).toEqual({ b: 0, c: false, d: "", e: [{ y: 1 }], f: {} });
    });

    it("fillEmptySetInfo: chỉ điền ô trống, cắt theo giới hạn form, bỏ thẻ trùng / quá dài", () => {
        const form = { name: "", description: "", tags: [] as string[] };
        fillEmptySetInfo(form, {
            name: " " + "a".repeat(120),
            description: "Mô tả",
            tags: ["x", "x", " y ", "", "z".repeat(51), "1", "2", "3", "4"],
        });
        expect(form.name).toHaveLength(100);
        expect(form.description).toBe("Mô tả");
        expect(form.tags).toEqual(["x", "y", "1", "2", "3"]);

        const filled = { name: "Của tôi", description: "Có rồi", tags: ["giữ"] };
        fillEmptySetInfo(filled, { name: "Khác", description: "Khác", tags: ["khác"] });
        expect(filled).toEqual({ name: "Của tôi", description: "Có rồi", tags: ["giữ"] });

        fillEmptySetInfo(filled, null);
        expect(filled.name).toBe("Của tôi");
    });
});
