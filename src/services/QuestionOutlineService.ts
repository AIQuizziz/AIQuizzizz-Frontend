import type { RequestQuestion } from "@/models/request/question";
import QUESTION_TYPE from "@/constants/questionTypes";
import { normalizeTextFormat } from "@/services/RichContentService";
import { isQuestionBlank, validateQuestions } from "@/services/QuestionValidator";

/** Mục lục / thẻ thu gọn của trang tạo, sửa bộ câu hỏi: tóm tắt một dòng của câu hỏi, đáp án đúng và lỗi */

const TITLE_MAX = 140;

const ENTITIES: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
};

/** Chữ thuần một dòng, gộp khoảng trắng. Chỉ nội dung HTML (Rich text, mặc định) mới bỏ thẻ; PlainText / Markdown giữ nguyên ký tự */
export const toPlainLine = (value: string | null | undefined, format?: string | null): string => {
    const raw = value ?? "";
    const isHtml = (normalizeTextFormat(format) ?? "Html") === "Html";
    const text = !isHtml
        ? raw
        : raw
              .replace(/<\/(p|div|li|h[1-6]|pre|blockquote)>/gi, " ")
              .replace(/<br\s*\/?>/gi, " ")
              .replace(/<[^>]+>/g, "")
              .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
    return text.replace(/\s+/g, " ").trim();
};

const clip = (text: string, max = TITLE_MAX) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);

/** Nội dung câu hỏi một dòng (rỗng nếu chưa nhập) */
export const questionTitle = (question: RequestQuestion): string => {
    const flashcard = question.type === QUESTION_TYPE.LANGUAGE_FLASHCARD;
    return clip(toPlainLine(question.questionText, flashcard ? "PlainText" : question.textFormat));
};

/** Đáp án đúng ngắn gọn để rà soát nhanh khi câu hỏi đang thu gọn (rỗng nếu không có / chưa nhập) */
export const answerSummary = (question: RequestQuestion): string => {
    const line = (value: string | null | undefined) => toPlainLine(value, question.textFormat);
    switch (question.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE:
            return clip(
                (question.multipleChoices ?? [])
                    .filter((x) => x.isAnswer)
                    .map((x) => line(x.text))
                    .filter(Boolean)
                    .join(" · "),
            );
        case QUESTION_TYPE.MATCHING: {
            const pairs = (question.matchingPairs ?? []).filter((x) => line(x.leftItem) || line(x.rightItem));
            const shown = pairs.slice(0, 3).map((x) => `${line(x.leftItem)} ↔ ${line(x.rightItem)}`);
            return clip(shown.join(" · ") + (pairs.length > 3 ? ` · +${pairs.length - 3}` : ""));
        }
        case QUESTION_TYPE.ORDERING:
            return clip(
                [...(question.orderingItems ?? [])]
                    .sort((a, b) => a.correctOrder - b.correctOrder)
                    .map((x) => line(x.text))
                    .filter(Boolean)
                    .join(" › "),
            );
        case QUESTION_TYPE.SHORT_TEXT:
            return clip(line(question.shortAnswer));
        default:
            return "";
    }
};

/** Lý do không hợp lệ theo id câu hỏi. Câu còn trống hoàn toàn (mới thêm) chưa tính là lỗi, chỉ báo khi lưu */
export const questionIssueMap = (questions: RequestQuestion[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const issue of validateQuestions(questions)) {
        const question = questions[issue.index - 1];
        if (question && !isQuestionBlank(question)) map.set(question.id, issue.reasons);
    }
    return map;
};
