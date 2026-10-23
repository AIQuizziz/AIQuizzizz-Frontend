import { reactive } from "vue";
import type { RequestQuestion } from "@/models/request/question";
import QUESTION_TYPE from "@/constants/questionTypes";

/** Trạng thái giao diện của trình soạn câu hỏi (trang tạo / sửa bộ câu hỏi) */

/** Id các câu hỏi đang mở khung chọn ảnh / video (câu đã có media luôn hiện khung này) */
export const mediaPanelOpen = reactive(new Set<string>());

/** Icon boxicons của từng loại câu hỏi (ô chọn loại ở đầu thẻ) */
export const QUESTION_TYPE_ICON: Record<string, string> = {
    [QUESTION_TYPE.MULTIPLE_CHOICE]: "bx-check-circle",
    [QUESTION_TYPE.MATCHING]: "bx-link",
    [QUESTION_TYPE.ORDERING]: "bx-sort-alt-2",
    [QUESTION_TYPE.SHORT_TEXT]: "bx-edit-alt",
    [QUESTION_TYPE.LANGUAGE_FLASHCARD]: "bx-card",
};

/**
 * Bản sao của một câu hỏi để chèn ngay sau câu gốc: id mới (câu mới, chưa lưu), id đáp án mới.
 * Không sao chép ảnh / video (mỗi media thuộc về một câu hỏi).
 */
export const duplicateQuestion = (question: RequestQuestion): RequestQuestion => {
    const copy = JSON.parse(JSON.stringify(question)) as RequestQuestion & { questionId?: string | null };
    const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    copy.id = `new_${stamp}`;
    copy.questionId = null;
    copy.mediaId = null;
    copy.media = null;
    for (const list of [copy.multipleChoices, copy.matchingPairs, copy.orderingItems]) {
        list?.forEach((item, index) => {
            item.id = `${stamp}_${index}`;
        });
    }
    return copy;
};

/** Các cách viết hoa / thường của đáp án ngắn (bỏ trùng), hiện dưới ô đáp án của câu Tự luận ngắn */
export const shortAnswerVariants = (answer?: string | null): string[] => {
    const value = (answer ?? "").trim();
    if (!value) return [];
    const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    return [...new Set([value.toLowerCase(), value.toUpperCase(), capitalized])];
};
