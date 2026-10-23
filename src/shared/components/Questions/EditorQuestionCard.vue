<script setup lang="ts">
import { computed, ref } from "vue";
import { Form, message } from "ant-design-vue";
import { VueDraggable } from "vue-draggable-plus";
import { useI18n } from "vue-i18n";

import type { RequestQuestion } from "@/models/request/question";
import QUESTION_TYPE from "@/constants/questionTypes";
import { hasContent, isMarkdownFormat, plainTextOf } from "@/services/ContentModeService";
import { mediaPanelOpen, QUESTION_TYPE_ICON, shortAnswerVariants } from "@/services/QuestionEditorService";
import { isQuestionBlank, normalizeScore } from "@/services/QuestionValidator";

import ContentEditor from "../Common/ContentEditor.vue";
import ContentModeSwitch from "../Common/ContentModeSwitch.vue";
import OptionPreview from "../Common/OptionPreview.vue";
import QuestionMediaPicker from "../Media/QuestionMediaPicker.vue";

/*
 * Thẻ câu hỏi đang soạn của trang tạo / sửa bộ câu hỏi (phương án 11): đầu thẻ (nội dung, ảnh / video, loại câu),
 * phần thân theo loại câu, chân thẻ (Giải thích, Điểm, Nhân bản, Xoá, Tuỳ chọn khác).
 * Dữ liệu ghi thẳng vào question (giống các component câu hỏi cũ). Thẻ ghi nhớ ngôn ngữ vẫn dùng LanguageFlashcard.
 */
interface Props {
    question: RequestQuestion;
    index: number;
    allowFlashcard?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "deleteQuestion"): void;
    (e: "changeQuestionType"): void;
    (e: "duplicateQuestion"): void;
}>();

const { t } = useI18n();

const isMarkdown = computed(() => isMarkdownFormat(props.question.textFormat));
const numberWidth = computed(() => `${String(props.index).length * 9.5 + 12}px`);

const typeOptions = computed(() =>
    [
        QUESTION_TYPE.MULTIPLE_CHOICE,
        QUESTION_TYPE.MATCHING,
        QUESTION_TYPE.ORDERING,
        QUESTION_TYPE.SHORT_TEXT,
        ...(props.allowFlashcard ? [QUESTION_TYPE.LANGUAGE_FLASHCARD] : []),
    ].map((value) => ({ value, label: t(`create_QS.type.${value}`) })),
);

//#region kiểm tra nội dung (giống các component cũ)
const lengthRule = (value: string) => {
    const plain = plainTextOf(value, props.question.textFormat); // rich text: editor trả về html trong <p></p>
    if (plain.length > 5000) return Promise.reject(t("create_QS.error_msg.out_of_range", { max_length: 5000 }));
    return Promise.resolve();
};
const { validateInfos } = Form.useForm(props.question, {
    questionText: [
        { required: true, message: t("create_QS.error_msg.required"), trigger: "change" },
        {
            validator: (_rule: string, value: string) =>
                plainTextOf(value, props.question.textFormat)
                    ? lengthRule(value)
                    : Promise.reject(t("create_QS.error_msg.required")),
            trigger: "change",
        },
    ],
    explainText: [{ validator: (_rule: string, value: string) => lengthRule(value), trigger: "change" }],
});

// lỗi của phần đáp án chỉ hiện khi câu đã có nội dung (câu mới thêm còn trống chưa báo lỗi)
const answerError = computed(() => {
    const q = props.question;
    if (isQuestionBlank(q)) return "";
    switch (q.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE:
            if (q.multipleChoices.length < 2) return t("question_editor.card.need_two");
            if (!q.multipleChoices.some((x) => x.isAnswer)) return t("question_editor.card.no_correct");
            return "";
        case QUESTION_TYPE.MATCHING:
            return q.matchingPairs.length < 2 ? t("question_editor.card.need_two") : "";
        case QUESTION_TYPE.ORDERING:
            return q.orderingItems.length < 2 ? t("question_editor.card.need_two") : "";
        default:
            return "";
    }
});
//#endregion

//#region đáp án
const newId = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

const addChoice = () => {
    if (props.question.multipleChoices.length >= 10) {
        message.warning(t("create_QS.error_msg.maximum_options"));
        return;
    }
    props.question.multipleChoices.push({ id: newId(), text: "", isAnswer: false });
};
const removeChoice = (index: number) => {
    if (props.question.multipleChoices.length <= 2) {
        message.warning(t("create_QS.error_msg.minimum_options"));
        return;
    }
    props.question.multipleChoices.splice(index, 1);
};

const addPair = () => {
    if (props.question.matchingPairs.length >= 10) {
        message.warning(t("create_QS.error_msg.maximum_options"));
        return;
    }
    props.question.matchingPairs.push({ id: newId(), leftItem: "", rightItem: "" });
};
const removePair = (index: number) => {
    if (props.question.matchingPairs.length <= 2) {
        message.warning(t("create_QS.error_msg.minimum_options"));
        return;
    }
    props.question.matchingPairs.splice(index, 1);
};
const swapPair = (index: number) => {
    const pair = props.question.matchingPairs[index];
    [pair.leftItem, pair.rightItem] = [pair.rightItem, pair.leftItem];
};

// các mục sắp xếp luôn hiển thị theo thứ tự đúng; kéo thả = đổi thứ tự đúng
const orderedItems = computed(() =>
    [...(props.question.orderingItems ?? [])].sort((a, b) => a.correctOrder - b.correctOrder),
);
const setOrder = (list: RequestQuestion["orderingItems"]) => {
    list.forEach((item, index) => (item.correctOrder = index));
    props.question.orderingItems = [...list];
};
const addItem = () => {
    if (props.question.orderingItems.length >= 10) {
        message.warning(t("create_QS.error_msg.maximum_options"));
        return;
    }
    props.question.orderingItems.push({
        id: newId(),
        text: "",
        correctOrder: props.question.orderingItems.length,
    });
};
const removeItem = (id: string) => {
    if (props.question.orderingItems.length <= 2) {
        message.warning(t("create_QS.error_msg.minimum_options"));
        return;
    }
    setOrder(orderedItems.value.filter((item) => item.id !== id));
};

const variants = computed(() => shortAnswerVariants(props.question.shortAnswer));
//#endregion

//#region ảnh / video, giải thích
const mediaVisible = computed(
    () => mediaPanelOpen.has(props.question.id) || !!props.question.mediaId || !!props.question.media,
);
const toggleMedia = () => {
    if (mediaPanelOpen.has(props.question.id)) mediaPanelOpen.delete(props.question.id);
    else mediaPanelOpen.add(props.question.id);
};

const explainOpen = ref(hasContent(props.question.explainText));
//#endregion
</script>

<template>
    <a-form :layout="'vertical'" :rules="validateInfos" :model="question" class="ed-card">
        <div class="ed-head">
            <div class="ed-title" :class="{ 'is-markdown': isMarkdown }" :style="{ '--num-w': numberWidth }">
                <span v-if="!isMarkdown" class="ed-num" aria-hidden="true">{{ index }}.</span>
                <ContentEditor
                    v-model="question.questionText"
                    v-model:validateStatus="validateInfos.questionText.validateStatus"
                    v-model:help="validateInfos.questionText.help"
                    :format="question.textFormat"
                    :name="'questionText'"
                    :placeholder="t('create_QS.question.text_placeholder')"
                    :is-required="true"
                />
            </div>
            <a-tooltip :title="$t('question_editor.card.media')">
                <button
                    type="button"
                    class="ed-square-btn"
                    :class="{ active: mediaVisible }"
                    :aria-label="$t('question_editor.card.media')"
                    @click="toggleMedia"
                >
                    <i class="bx bx-image"></i>
                </button>
            </a-tooltip>
            <div class="ed-type">
                <i class="bx ed-type-icon" :class="QUESTION_TYPE_ICON[question.type]"></i>
                <a-select
                    v-model:value="question.type"
                    :options="typeOptions"
                    :aria-label="$t('create_QS.type.All')"
                    @change="emit('changeQuestionType')"
                />
            </div>
        </div>

        <div v-if="mediaVisible" class="ed-media">
            <QuestionMediaPicker :question="question" />
        </div>

        <!-- Trắc nghiệm -->
        <template v-if="question.type === QUESTION_TYPE.MULTIPLE_CHOICE">
            <div class="ed-hint">
                <i class="bx bx-info-circle"></i>{{ $t("question_editor.card.hint_choice") }}
            </div>
            <VueDraggable
                v-model="question.multipleChoices"
                class="ed-rows"
                handle=".ed-grip"
                :animation="150"
            >
                <div
                    v-for="(option, i) in question.multipleChoices"
                    :key="option.id"
                    class="ed-opt"
                    :class="{ correct: option.isAnswer }"
                >
                    <i class="bx bx-grid-vertical ed-grip"></i>
                    <input
                        v-model="option.isAnswer"
                        type="checkbox"
                        class="ed-check"
                        :aria-label="$t('question_editor.card.mark_correct')"
                    />
                    <div class="ed-opt-field">
                        <a-textarea
                            v-model:value="option.text"
                            class="ed-input"
                            :auto-size="{ minRows: 1, maxRows: 6 }"
                            :maxlength="1000"
                            :placeholder="$t('create_QS.question.answer_option_placeholder')"
                        />
                        <OptionPreview :text="option.text" :format="question.textFormat" />
                    </div>
                    <button
                        type="button"
                        class="ed-del"
                        :aria-label="$t('question_editor.card.remove')"
                        @click="removeChoice(i)"
                    >
                        <i class="bx bx-trash"></i>
                    </button>
                </div>
            </VueDraggable>
            <div v-if="answerError" class="ed-error"><i class="bx bx-error-circle"></i>{{ answerError }}</div>
            <button type="button" class="ed-add" @click="addChoice">
                <i class="bx bx-plus"></i>{{ $t("question_editor.card.add_answer") }}
            </button>
        </template>

        <!-- Nối -->
        <template v-else-if="question.type === QUESTION_TYPE.MATCHING">
            <div class="ed-hint">
                <i class="bx bx-info-circle"></i>{{ $t("question_editor.card.hint_matching") }}
            </div>
            <div class="ed-pair ed-pair-head">
                <span></span>
                <span class="ed-col-label">{{ $t("question_editor.card.left") }}</span>
                <span></span>
                <span class="ed-col-label">{{ $t("question_editor.card.right") }}</span>
                <span></span>
            </div>
            <VueDraggable
                v-model="question.matchingPairs"
                class="ed-rows ed-rows-plain"
                handle=".ed-grip"
                :animation="150"
            >
                <div v-for="(pair, i) in question.matchingPairs" :key="pair.id" class="ed-pair">
                    <i class="bx bx-grid-vertical ed-grip"></i>
                    <div class="ed-opt-field">
                        <a-textarea
                            v-model:value="pair.leftItem"
                            class="ed-input"
                            :auto-size="{ minRows: 1, maxRows: 6 }"
                            :maxlength="1000"
                            :placeholder="$t('create_QS.question.answer_option_placeholder')"
                        />
                        <OptionPreview :text="pair.leftItem" :format="question.textFormat" />
                    </div>
                    <button
                        type="button"
                        class="ed-link"
                        :title="$t('question_editor.card.swap')"
                        :aria-label="$t('question_editor.card.swap')"
                        @click="swapPair(i)"
                    >
                        <i class="bx bx-link"></i>
                    </button>
                    <div class="ed-opt-field">
                        <a-textarea
                            v-model:value="pair.rightItem"
                            class="ed-input"
                            :auto-size="{ minRows: 1, maxRows: 6 }"
                            :maxlength="1000"
                            :placeholder="$t('create_QS.question.answer_option_placeholder')"
                        />
                        <OptionPreview :text="pair.rightItem" :format="question.textFormat" />
                    </div>
                    <button
                        type="button"
                        class="ed-del"
                        :aria-label="$t('question_editor.card.remove')"
                        @click="removePair(i)"
                    >
                        <i class="bx bx-trash"></i>
                    </button>
                </div>
            </VueDraggable>
            <div v-if="answerError" class="ed-error"><i class="bx bx-error-circle"></i>{{ answerError }}</div>
            <button type="button" class="ed-add" @click="addPair">
                <i class="bx bx-plus"></i>{{ $t("question_editor.card.add_pair") }}
            </button>
        </template>

        <!-- Sắp xếp -->
        <template v-else-if="question.type === QUESTION_TYPE.ORDERING">
            <div class="ed-hint">
                <i class="bx bx-info-circle"></i>{{ $t("question_editor.card.hint_ordering") }}
            </div>
            <VueDraggable
                class="ed-rows"
                handle=".ed-grip"
                :animation="150"
                :model-value="orderedItems"
                @update:model-value="setOrder"
            >
                <div v-for="(item, i) in orderedItems" :key="item.id" class="ed-opt">
                    <i class="bx bx-grid-vertical ed-grip"></i>
                    <span class="ed-order-no">{{ i + 1 }}</span>
                    <div class="ed-opt-field">
                        <a-textarea
                            v-model:value="item.text"
                            class="ed-input"
                            :auto-size="{ minRows: 1, maxRows: 6 }"
                            :maxlength="1000"
                            :placeholder="$t('create_QS.question.answer_option_placeholder')"
                        />
                        <OptionPreview :text="item.text" :format="question.textFormat" />
                    </div>
                    <button
                        type="button"
                        class="ed-del"
                        :aria-label="$t('question_editor.card.remove')"
                        @click="removeItem(item.id)"
                    >
                        <i class="bx bx-trash"></i>
                    </button>
                </div>
            </VueDraggable>
            <div v-if="answerError" class="ed-error"><i class="bx bx-error-circle"></i>{{ answerError }}</div>
            <button type="button" class="ed-add" @click="addItem">
                <i class="bx bx-plus"></i>{{ $t("question_editor.card.add_item") }}
            </button>
        </template>

        <!-- Trả lời ngắn -->
        <template v-else-if="question.type === QUESTION_TYPE.SHORT_TEXT">
            <div class="ed-label">{{ $t("question_editor.card.accepted_answer") }}</div>
            <div class="ed-opt-field">
                <a-textarea
                    v-model:value="question.shortAnswer"
                    class="ed-input"
                    :auto-size="{ minRows: 1, maxRows: 6 }"
                    :maxlength="1000"
                    :placeholder="$t('create_QS.question.answer_text_placeholder')"
                />
                <OptionPreview :text="question.shortAnswer" :format="question.textFormat" />
            </div>
            <div v-if="variants.length > 1" class="ed-variants">
                <span class="ed-variants-label">{{ $t("question_editor.card.accepted_variants") }}</span>
                <span v-for="variant in variants" :key="variant" class="ed-chip">
                    <i class="bx bx-check"></i>{{ variant }}
                </span>
            </div>
        </template>

        <div class="ed-foot">
            <button
                type="button"
                class="ed-add ed-explain-btn"
                :class="{ active: explainOpen }"
                :aria-expanded="explainOpen"
                @click="explainOpen = !explainOpen"
            >
                <i class="bx bx-pencil"></i>{{ $t("question_editor.card.explain") }}
            </button>
            <span class="ed-grow"></span>
            <label class="ed-score">
                {{ $t("question_editor.card.score") }}
                <a-input-number
                    v-model:value="question.score"
                    :min="0"
                    :max="999"
                    :step="1"
                    :controls="false"
                    class="ed-score-input"
                    @blur="question.score = normalizeScore(question.score)"
                />
            </label>
            <a-tooltip :title="$t('question_editor.card.duplicate')">
                <button
                    type="button"
                    class="ed-icon-btn"
                    :aria-label="$t('question_editor.card.duplicate')"
                    @click="emit('duplicateQuestion')"
                >
                    <i class="bx bx-copy"></i>
                </button>
            </a-tooltip>
            <a-popconfirm :title="$t('create_QS.quiz.confirm')" @confirm="emit('deleteQuestion')">
                <button
                    type="button"
                    class="ed-icon-btn danger"
                    :aria-label="$t('question_editor.card.delete')"
                >
                    <i class="bx bx-trash"></i>
                </button>
            </a-popconfirm>
            <a-dropdown :trigger="['click']" placement="topRight">
                <button
                    type="button"
                    class="ed-icon-btn"
                    :aria-label="$t('question_editor.card.more')"
                >
                    <i class="bx bx-dots-vertical-rounded"></i>
                </button>
                <template #overlay>
                    <div class="ed-more">
                        <div class="ed-more-label">{{ $t("question_editor.card.content_mode") }}</div>
                        <ContentModeSwitch :question="question" />
                    </div>
                </template>
            </a-dropdown>
        </div>

        <div v-if="explainOpen" class="ed-explain">
            <ContentEditor
                v-model="question.explainText"
                v-model:validateStatus="validateInfos.explainText.validateStatus"
                v-model:help="validateInfos.explainText.help"
                :format="question.textFormat"
                :name="'explainText'"
                :label="t('question_editor.card.explain')"
                :placeholder="t('create_QS.question.explain_text_placeholder')"
            />
        </div>
    </a-form>
</template>

<style scoped>
.ed-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 24px;
    color: var(--ed-text);
    background-color: var(--ed-card);
    border: 2px solid var(--ed-primary);
    border-radius: 16px;
    box-shadow: var(--ed-shadow);
}

/* ---- đầu thẻ ---- */
.ed-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}
.ed-title {
    position: relative;
    flex: 1;
    min-width: 0;
}
.ed-num {
    position: absolute;
    top: 12px;
    left: 14px;
    z-index: 1;
    font-size: 16px;
    font-weight: 500;
    line-height: 25px;
    color: var(--ed-text);
    pointer-events: none;
}
.ed-title :deep(.ant-form-item) {
    margin: 0;
}
.ed-title :deep(.ant-form-item-control-input-content) {
    display: flex;
    flex-direction: column;
}
.ed-title :deep(.ProseMirror) {
    order: 1;
    min-height: 49px;
    padding: 12px 14px 12px calc(14px + var(--num-w));
    font-size: 16px;
    font-weight: 500;
    line-height: 25px;
    color: var(--ed-text);
    background-color: var(--ed-surface);
    border: none;
    border-bottom: 2px solid var(--ed-primary);
    border-radius: 8px;
}
.ed-title :deep(.ProseMirror.invalid) {
    border-bottom-color: var(--ed-danger) !important;
}
/* thanh định dạng chỉ hiện khi đang gõ, nằm dưới ô nội dung */
.ed-title :deep(.toolbar) {
    order: 2;
    display: none;
    justify-content: flex-start;
    gap: 2px;
    margin-top: 6px;
    padding: 4px;
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
}
.ed-title:focus-within :deep(.toolbar) {
    display: flex;
}
.ed-title :deep(.toolbar-button) {
    margin: 0;
    padding: 6px 8px;
    background-color: transparent;
    color: var(--ed-text);
}
.ed-title :deep(.toolbar-button:hover),
.ed-title :deep(.toolbar-button.is-active) {
    color: #fff;
    background-color: var(--ed-primary);
}
.ed-title :deep(.toolbar-button.is-disabled) {
    color: var(--ed-grip);
    background-color: transparent;
}
.ed-title :deep(.toolbar-button i) {
    font-size: 18px;
}
.ed-title.is-markdown :deep(.md-textarea) {
    background-color: var(--ed-surface);
    border-color: var(--ed-border);
    border-radius: 8px;
}

.ed-square-btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-top: 6px;
    font-size: 18px;
    color: var(--ed-text);
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
    cursor: pointer;
}
.ed-square-btn:hover,
.ed-square-btn.active {
    color: var(--ed-primary-text);
    border-color: var(--ed-primary);
}
.ed-type {
    position: relative;
    flex: none;
    margin-top: 6px;
}
.ed-type-icon {
    position: absolute;
    top: 50%;
    left: 12px;
    z-index: 1;
    font-size: 16px;
    color: var(--ed-primary-text);
    transform: translateY(-50%);
    pointer-events: none;
}
.ed-type :deep(.ant-select) {
    min-width: 150px;
}
.ed-type :deep(.ant-select-selector) {
    height: 37px !important;
    padding: 0 12px 0 36px !important;
    font-size: 13px;
    font-weight: 500;
    background-color: var(--ed-card) !important;
    border-color: var(--ed-border) !important;
    border-radius: 8px !important;
}
.ed-type :deep(.ant-select-selection-item) {
    line-height: 35px !important;
    color: var(--ed-text);
}

.ed-media {
    padding: 12px;
    background-color: var(--ed-surface);
    border: 1px dashed var(--ed-border-strong);
    border-radius: 10px;
}

/* ---- thân thẻ ---- */
.ed-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 17px;
    color: var(--ed-muted);
}
.ed-hint i {
    font-size: 14px;
}
.ed-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--ed-text);
}
.ed-rows {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.ed-rows-plain {
    gap: 14px;
}
.ed-opt {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 12px;
    background-color: var(--ed-surface);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
}
.ed-opt.correct {
    background-color: var(--ed-success-soft);
    border-color: var(--ed-success);
}
.ed-opt > .ed-grip,
.ed-opt > .ed-check,
.ed-opt > .ed-order-no,
.ed-opt > .ed-del {
    margin-top: 10px;
}
.ed-grip {
    flex: none;
    font-size: 16px;
    color: var(--ed-grip);
    cursor: grab;
}
.ed-check {
    flex: none;
    position: relative;
    width: 20px;
    height: 20px;
    margin-left: 0;
    margin-right: 0;
    background-color: var(--ed-input);
    border: 1.5px solid var(--ed-grip);
    border-radius: 6px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
}
.ed-check:checked {
    background-color: var(--ed-success);
    border-color: var(--ed-success);
}
.ed-check:checked::after {
    position: absolute;
    top: 2px;
    left: 6px;
    width: 5px;
    height: 10px;
    content: "";
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}
.ed-check:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}
.ed-order-no {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ed-primary-text);
    background-color: var(--ed-primary-soft);
    border-radius: 7px;
}
.ed-opt-field {
    flex: 1;
    min-width: 0;
}
.ed-input {
    padding: 8px 12px;
    font-size: 14px;
    line-height: 20px;
    color: var(--ed-text);
    background-color: var(--ed-input);
    border: 1px solid var(--ed-border-strong);
    border-radius: 8px;
    resize: none;
}
.ed-input:hover,
.ed-input:focus {
    border-color: var(--ed-primary);
    box-shadow: none;
}
.ed-opt.correct .ed-input {
    font-weight: 500;
    border-color: var(--ed-success);
}
.ed-del {
    flex: none;
    display: inline-flex;
    padding: 2px;
    font-size: 18px;
    color: var(--ed-muted);
    background: transparent;
    border: none;
    cursor: pointer;
}
.ed-del:hover {
    color: var(--ed-danger);
}
.ed-error {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ed-danger);
}
.ed-add {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--ed-primary-text);
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}
.ed-add i {
    font-size: 18px;
}
.ed-add:hover,
.ed-add.active {
    background-color: var(--ed-primary-soft);
}

/* nối */
.ed-pair {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) 18px minmax(0, 1fr) 18px;
    gap: 10px;
    align-items: start;
}
.ed-pair > .ed-grip,
.ed-pair > .ed-link,
.ed-pair > .ed-del {
    margin-top: 10px;
}
.ed-pair-head {
    margin-bottom: -6px;
}
.ed-col-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ed-muted);
}
.ed-link {
    display: inline-flex;
    padding: 0;
    font-size: 18px;
    color: var(--ed-primary-text);
    background: transparent;
    border: none;
    cursor: pointer;
}

/* trả lời ngắn */
.ed-variants {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.ed-variants-label {
    font-size: 12px;
    color: var(--ed-muted);
}
.ed-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px 4px 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ed-success);
    background-color: var(--ed-success-soft);
    border: 1px solid var(--ed-success);
    border-radius: 999px;
}

/* ---- chân thẻ ---- */
.ed-foot {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--ed-border);
}
.ed-grow {
    flex: 1;
}
.ed-explain-btn {
    align-self: auto;
}
.ed-score {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--ed-muted);
}
.ed-score-input {
    width: 46px;
    height: 33px;
    color: var(--ed-text);
    background-color: var(--ed-input);
    border: 1px solid var(--ed-border);
    border-radius: 8px;
}
.ed-score-input :deep(.ant-input-number-input) {
    height: 31px;
    font-weight: 600;
    text-align: center;
}
.ed-icon-btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 18px;
    color: var(--ed-muted);
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}
.ed-icon-btn:hover {
    color: var(--ed-text);
    background-color: var(--ed-surface);
}
.ed-icon-btn.danger {
    color: var(--ed-danger);
}
.ed-icon-btn.danger:hover {
    background-color: var(--ed-danger-soft);
}
.ed-explain :deep(.ant-form-item) {
    margin-bottom: 0;
}
.ed-explain :deep(.ProseMirror) {
    min-height: 80px;
    color: var(--ed-text);
    background-color: var(--ed-surface);
    border-color: var(--ed-border);
    border-radius: 0 0 10px 10px;
}
.ed-explain :deep(.toolbar) {
    background-color: var(--ed-card);
    border-color: var(--ed-border);
    border-radius: 10px 10px 0 0;
}
.ed-explain :deep(.ant-form-item-label > label) {
    font-size: 13px;
    color: var(--ed-text);
}

button:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}

@media (max-width: 575.98px) {
    .ed-card {
        padding: 16px;
    }
    .ed-head {
        flex-wrap: wrap;
    }
    .ed-title {
        flex-basis: 100%;
    }
    .ed-pair {
        grid-template-columns: 16px minmax(0, 1fr) 18px;
    }
    .ed-pair-head {
        display: none;
    }
}
</style>

<style>
/* popup của a-dropdown nằm ngoài .editor-page nên dùng biến chung của app */
.ed-more {
    min-width: 220px;
    padding: 12px;
    color: var(--c-text);
    background-color: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.ed-more-label {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--c-text-muted);
}
</style>
