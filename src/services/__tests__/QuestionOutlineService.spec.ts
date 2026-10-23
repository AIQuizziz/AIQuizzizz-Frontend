import { describe, expect, it } from "vitest";
import type { RequestQuestion } from "@/models/request/question";
import { answerSummary, questionIssueMap, questionTitle, toPlainLine } from "@/services/QuestionOutlineService";

const make = (patch: Partial<RequestQuestion>): RequestQuestion => ({
    id: "q1",
    type: "MultipleChoice",
    textFormat: "Html",
    questionText: "",
    questionHTML: "",
    explainText: "",
    score: 10,
    multipleChoices: [
        { id: "a", text: "", isAnswer: false },
        { id: "b", text: "", isAnswer: false },
    ],
    matchingPairs: [],
    orderingItems: [],
    shortAnswer: "",
    ...patch,
});

describe("QuestionOutlineService", () => {
    it("toPlainLine: bỏ thẻ HTML của editor, giải mã ký tự, gộp khoảng trắng", () => {
        expect(toPlainLine("<p>Xin&nbsp;chào <strong>bạn</strong></p><p>a &lt; b &amp; c</p>", "Html")).toBe(
            "Xin chào bạn a < b & c",
        );
        expect(toPlainLine("line1<br>line2", "Html")).toBe("line1 line2");
        expect(toPlainLine(null)).toBe("");
    });

    it("toPlainLine: Markdown giữ nguyên ký tự (không coi là HTML)", () => {
        expect(toPlainLine("Dùng `a < b` và <div>", "Markdown")).toBe("Dùng `a < b` và <div>");
    });

    it("questionTitle: cắt ngắn nội dung quá dài, thẻ ngôn ngữ là chữ thuần", () => {
        const long = make({ questionText: "<p>" + "a".repeat(300) + "</p>" });
        expect(questionTitle(long)).toHaveLength(140);
        expect(questionTitle(long).endsWith("…")).toBe(true);
        expect(questionTitle(make({ type: "LanguageFlashcard", questionText: "<b>run</b>" }))).toBe("<b>run</b>");
        expect(questionTitle(make({}))).toBe("");
    });

    it("answerSummary: đáp án đúng theo từng loại", () => {
        expect(
            answerSummary(
                make({
                    multipleChoices: [
                        { id: "a", text: "<p>Sai</p>", isAnswer: false },
                        { id: "b", text: "Đúng 1", isAnswer: true },
                        { id: "c", text: "Đúng 2", isAnswer: true },
                    ],
                }),
            ),
        ).toBe("Đúng 1 · Đúng 2");

        expect(
            answerSummary(
                make({
                    type: "Matching",
                    textFormat: "PlainText",
                    matchingPairs: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), leftItem: `L${n}`, rightItem: `R${n}` })),
                }),
            ),
        ).toBe("L1 ↔ R1 · L2 ↔ R2 · L3 ↔ R3 · +2");

        expect(
            answerSummary(
                make({
                    type: "Ordering",
                    orderingItems: [
                        { id: "1", text: "hai", correctOrder: 1 },
                        { id: "2", text: "một", correctOrder: 0 },
                        { id: "3", text: "ba", correctOrder: 2 },
                    ],
                }),
            ),
        ).toBe("một › hai › ba");

        expect(answerSummary(make({ type: "ShortText", shortAnswer: " createIndex " }))).toBe("createIndex");
        expect(answerSummary(make({ type: "LanguageFlashcard" }))).toBe("");
        expect(answerSummary(make({}))).toBe("");
    });

    it("questionIssueMap: câu trống hoàn toàn chưa tính lỗi, câu dở dang báo lý do theo id", () => {
        const blank = make({ id: "blank" });
        const noAnswer = make({
            id: "bad",
            questionText: "<p>Câu hỏi</p>",
            multipleChoices: [
                { id: "a", text: "A", isAnswer: false },
                { id: "b", text: "B", isAnswer: false },
            ],
        });
        const good = make({
            id: "good",
            questionText: "<p>Câu hỏi</p>",
            multipleChoices: [
                { id: "a", text: "A", isAnswer: true },
                { id: "b", text: "B", isAnswer: false },
            ],
        });

        const map = questionIssueMap([blank, noAnswer, good]);
        expect([...map.keys()]).toEqual(["bad"]);
        expect(map.get("bad")!.length).toBeGreaterThan(0);
    });
});
