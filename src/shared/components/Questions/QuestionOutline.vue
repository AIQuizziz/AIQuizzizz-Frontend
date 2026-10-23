<script setup lang="ts">
import { computed } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import { useI18n } from "vue-i18n";

import type { RequestQuestion } from "@/models/request/question";
import { questionIssueMap, questionTitle } from "@/services/QuestionOutlineService";
import { formatScore } from "@/services/QuestionValidator";

/*
 * Mục lục câu hỏi (cột trái của trang tạo / sửa bộ câu hỏi): thấy toàn bộ bộ câu hỏi, câu đang sửa,
 * câu lỗi (kèm lý do) và kéo thả để đổi thứ tự.
 */
interface Props {
    questions: RequestQuestion[];
    activeId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "update:questions", questions: RequestQuestion[]): void;
    (e: "select", id: string): void;
    (e: "add"): void;
}>();

const { t } = useI18n();

const issues = computed(() => questionIssueMap(props.questions));
const firstIssueId = computed(() => {
    const index = props.questions.findIndex((q) => issues.value.has(q.id));
    return index >= 0 ? props.questions[index].id : null;
});

const typeLabel = (question: RequestQuestion) => t(`create_QS.type.${question.type}`);
</script>

<template>
    <aside class="question-outline" :aria-label="$t('question_editor.outline.title')">
        <div class="outline-header">
            <span class="outline-title">
                {{ $t("question_editor.outline.title", { number: questions.length }) }}
            </span>
            <button
                v-if="issues.size > 0"
                type="button"
                class="outline-error-badge"
                :title="$t('question_editor.outline.go_to_error')"
                @click="firstIssueId && emit('select', firstIssueId)"
            >
                {{ $t("question_editor.outline.errors", { number: issues.size }) }}
            </button>
        </div>

        <VueDraggable
            class="outline-list"
            handle=".outline-grip"
            :animation="150"
            :model-value="questions"
            @update:model-value="(value: RequestQuestion[]) => emit('update:questions', value)"
        >
            <div
                v-for="(question, index) in questions"
                :key="question.id"
                :class="[
                    'outline-row',
                    question.id === activeId ? 'active' : '',
                    issues.has(question.id) ? 'invalid' : '',
                ]"
                role="button"
                tabindex="0"
                @click="emit('select', question.id)"
                @keydown.enter.self.prevent="emit('select', question.id)"
                @keydown.space.self.prevent="emit('select', question.id)"
            >
                <span class="outline-number">{{ index + 1 }}</span>
                <span class="outline-text">
                    <span class="outline-question" :class="{ empty: !questionTitle(question) }">
                        {{ questionTitle(question) || $t("question_editor.outline.empty") }}
                    </span>
                    <span class="outline-meta">
                        <template v-if="issues.has(question.id)">
                            {{ issues.get(question.id)![0] }}
                        </template>
                        <template v-else>
                            {{ typeLabel(question) }} ·
                            {{ $t("question_editor.outline.points", { number: formatScore(question.score) }) }}
                        </template>
                    </span>
                </span>
                <i v-if="issues.has(question.id)" class="bx bx-error-circle outline-alert"></i>
                <i
                    v-else
                    class="bx bx-grid-vertical outline-grip"
                    :title="$t('question_editor.outline.drag')"
                    @click.stop
                ></i>
            </div>
        </VueDraggable>

        <button type="button" class="outline-add" @click="emit('add')">
            <i class="bx bx-plus"></i>
            {{ $t("create_QS.buttons.add_question") }}
        </button>
    </aside>
</template>

<style scoped>
.question-outline {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
    padding: 16px;
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 16px;
}
.outline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 23px;
}
.outline-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--ed-text);
}
.outline-error-badge {
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 600;
    line-height: 17px;
    color: var(--ed-danger);
    background-color: var(--ed-danger-soft);
    border: none;
    border-radius: 6px;
    cursor: pointer;
}
.outline-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    overflow-y: auto;
    padding: 2px;
    margin: -2px;
}
.outline-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    cursor: pointer;
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
    transition:
        border-color 0.15s ease,
        background-color 0.15s ease;
}
.outline-row:hover {
    border-color: var(--ed-border-strong);
}
.outline-row:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 1px;
}
.outline-row.active {
    background-color: var(--ed-primary-soft);
    border-color: var(--ed-primary);
}
.outline-row.invalid {
    border-color: var(--ed-danger);
}
.outline-number {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ed-text);
    background-color: var(--ed-surface);
    border-radius: 8px;
}
.outline-row.active .outline-number {
    color: #fff;
    background-color: var(--ed-primary);
}
.outline-row.invalid .outline-number {
    color: var(--ed-danger);
    background-color: var(--ed-danger-soft);
}
.outline-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.outline-question,
.outline-meta {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.outline-question {
    font-size: 13px;
    font-weight: 500;
    line-height: 18px;
    color: var(--ed-text);
}
.outline-question.empty {
    font-style: italic;
    font-weight: 400;
    color: var(--ed-muted);
}
.outline-meta {
    font-size: 12px;
    line-height: 17px;
    color: var(--ed-muted);
}
.outline-row.invalid .outline-meta {
    color: var(--ed-danger);
}
.outline-grip,
.outline-alert {
    flex: none;
    font-size: 16px;
}
.outline-grip {
    color: var(--ed-grip);
    cursor: grab;
}
.outline-alert {
    color: var(--ed-danger);
}
.outline-add {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
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
.outline-add:hover {
    background-color: var(--ed-primary-soft);
}
.outline-add i {
    font-size: 18px;
}
</style>
