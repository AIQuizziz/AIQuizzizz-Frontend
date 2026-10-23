<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { RequestQuestion } from "@/models/request/question";
import { answerSummary, questionTitle } from "@/services/QuestionOutlineService";
import { formatScore } from "@/services/QuestionValidator";

/* Câu hỏi đang thu gọn trong cột soạn: nội dung, loại, điểm và đáp án đúng. Bấm để mở ra soạn. */
interface Props {
    question: RequestQuestion;
    index: number;
    /** Lý do không hợp lệ (rỗng = hợp lệ) */
    issues?: string[];
}

const props = withDefaults(defineProps<Props>(), { issues: () => [] });
defineEmits<(e: "open") => void>();

const { t } = useI18n();

const title = computed(() => questionTitle(props.question));
const answer = computed(() => answerSummary(props.question));
</script>

<template>
    <div
        :class="['question-summary', issues.length > 0 ? 'invalid' : '']"
        role="button"
        tabindex="0"
        :aria-label="$t('question_editor.summary.open', { number: index })"
        @click="$emit('open')"
        @keydown.enter.self.prevent="$emit('open')"
        @keydown.space.self.prevent="$emit('open')"
    >
        <div class="summary-head">
            <span class="summary-title" :class="{ empty: !title }">
                <b>{{ index }}.</b>{{ title || $t("question_editor.outline.empty") }}
            </span>
            <span class="summary-tag">{{ t(`create_QS.type.${question.type}`) }}</span>
            <span class="summary-tag">
                {{ $t("question_editor.outline.points", { number: formatScore(question.score) }) }}
            </span>
        </div>
        <div v-if="issues.length > 0" class="summary-issues">
            <i class="bx bx-error-circle"></i>
            {{ issues.join("; ") }}
        </div>
        <div v-else-if="answer" class="summary-answer">
            <i class="bx bx-check-circle"></i>
            <span>{{ answer }}</span>
        </div>
    </div>
</template>

<style scoped>
.question-summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 20px;
    cursor: pointer;
    color: var(--ed-text);
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 16px;
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
}
.question-summary:hover {
    border-color: var(--ed-primary);
    box-shadow: var(--ed-shadow);
}
.question-summary:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}
.question-summary.invalid {
    border-color: var(--ed-danger);
}
.summary-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}
.summary-title {
    flex: 1;
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    word-break: break-word;
}
.summary-title b {
    margin-right: 6px;
    font-weight: 700;
    color: var(--ed-muted);
}
.summary-title.empty {
    font-style: italic;
    font-weight: 400;
    color: var(--ed-muted);
}
.summary-tag {
    flex: none;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 500;
    line-height: 17px;
    color: var(--ed-muted);
    background-color: var(--ed-surface);
    border: 1px solid var(--ed-border);
    border-radius: 6px;
    white-space: nowrap;
}
.summary-answer,
.summary-issues {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    line-height: 19px;
    word-break: break-word;
}
.summary-answer {
    color: var(--ed-success);
}
.summary-issues {
    color: var(--ed-danger);
}
.summary-answer i,
.summary-issues i {
    flex: none;
    font-size: 16px;
}
</style>
