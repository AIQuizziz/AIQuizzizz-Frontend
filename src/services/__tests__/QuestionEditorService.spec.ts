import { describe, expect, it } from "vitest";
import type { RequestQuestion } from "@/models/request/question";
import { duplicateQuestion, shortAnswerVariants } from "@/services/QuestionEditorService";

const sample = (): RequestQuestion & { questionId?: string | null } => ({
    id: "11111111-1111-1111-1111-111111111111",
    questionId: "11111111-1111-1111-1111-111111111111",
    type: "MultipleChoice",
    textFormat: "Markdown",
    questionText: "Thủ đô?",
    questionHTML: "",
    explainText: "vì",
    score: 5,
    multipleChoices: [
        { id: "a", text: "Huế", isAnswer: false },
        { id: "b", text: "Hà Nội", isAnswer: true },
    ],
    matchingPairs: [{ id: "p", leftItem: "x", rightItem: "y" }],
    orderingItems: [{ id: "o", text: "một", correctOrder: 0 }],
    shortAnswer: "",
    mediaId: "22222222-2222-2222-2222-222222222222",
    media: { id: "22222222-2222-2222-2222-222222222222" } as RequestQuestion["media"],
});

describe("QuestionEditorService", () => {
    it("duplicateQuestion: câu mới (id new_, không questionId), không mang theo media, giữ nội dung", () => {
        const original = sample();
        const copy = duplicateQuestion(original) as RequestQuestion & { questionId?: string | null };

        expect(copy.id).toMatch(/^new_/);
        expect(copy.id).not.toBe(original.id);
        expect(copy.questionId).toBeNull();
        expect(copy.mediaId).toBeNull();
        expect(copy.media).toBeNull();
        expect(copy.questionText).toBe("Thủ đô?");
        expect(copy.explainText).toBe("vì");
        expect(copy.score).toBe(5);
        expect(copy.textFormat).toBe("Markdown");
        expect(copy.multipleChoices.map((x) => [x.text, x.isAnswer])).toEqual([
            ["Huế", false],
            ["Hà Nội", true],
        ]);
    });

    it("duplicateQuestion: id đáp án mới, bản gốc không bị đổi, hai bản độc lập", () => {
        const original = sample();
        const copy = duplicateQuestion(original);

        expect(copy.multipleChoices.map((x) => x.id)).not.toContain("a");
        expect(new Set(copy.multipleChoices.map((x) => x.id)).size).toBe(2);
        expect(original.multipleChoices.map((x) => x.id)).toEqual(["a", "b"]);
        expect(original.mediaId).not.toBeNull();

        copy.multipleChoices[0].text = "đã sửa";
        expect(original.multipleChoices[0].text).toBe("Huế");
    });

    it("duplicateQuestion: hai lần nhân bản liên tiếp cho id khác nhau", () => {
        const original = sample();
        expect(duplicateQuestion(original).id).not.toBe(duplicateQuestion(original).id);
    });

    it("shortAnswerVariants: các cách viết hoa / thường, bỏ trùng", () => {
        expect(shortAnswerVariants("createIndex")).toEqual(["createindex", "CREATEINDEX", "Createindex"]);
        expect(shortAnswerVariants("42")).toEqual(["42"]);
        expect(shortAnswerVariants("  ")).toEqual([]);
        expect(shortAnswerVariants(null)).toEqual([]);
    });
});
