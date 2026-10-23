<script setup lang="ts">
import { computed } from "vue";

import type { RequestQuestion } from "@/models/request/question";
import QUESTION_TYPE from "@/constants/questionTypes";
import { formatScore } from "@/services/QuestionValidator";

import RichContent from "../Common/RichContent.vue";
import QuestionMediaView from "../Media/QuestionMediaView.vue";

/* Xem trước một câu hỏi như học viên thấy: không lộ đáp án đúng, các mục được xáo trộn (xoay vòng cố định để không nhấp nháy) */
const props = defineProps<{ question: RequestQuestion; index: number }>();

const format = computed(() => props.question.textFormat || "Html");
const multiple = computed(() => props.question.multipleChoices.filter((x) => x.isAnswer).length > 1);
const rightItems = computed(() => {
    const items = props.question.matchingPairs.map((x) => x.rightItem);
    return items.length > 1 ? [...items.slice(1), items[0]] : items;
});
const shuffledItems = computed(() => {
    const items = [...props.question.orderingItems].sort((a, b) => a.correctOrder - b.correctOrder);
    return items.length > 1 ? items.reverse() : items;
});
const hasText = computed(() => (props.question.questionText ?? "").replace(/<[^>]*>/g, "").trim().length > 0);
</script>

<template>
    <article class="pv-card">
        <header class="pv-head">
            <div class="pv-text">
                <b>{{ index }}.</b>
                <RichContent v-if="hasText" :content="question.questionText" :format="format" />
                <span v-else class="pv-empty">{{ $t("question_editor.preview.empty") }}</span>
            </div>
            <span class="pv-tag">
                {{ $t("question_editor.outline.points", { number: formatScore(question.score) }) }}
            </span>
        </header>

        <QuestionMediaView v-if="question.media" :media="question.media" />

        <div v-if="question.type === QUESTION_TYPE.MULTIPLE_CHOICE" class="pv-body">
            <div
                v-for="option in question.multipleChoices"
                :key="option.id"
                class="pv-option"
            >
                <span class="pv-mark" :class="{ square: multiple }"></span>
                <RichContent :content="option.text" :format="format" inline />
            </div>
        </div>

        <div v-else-if="question.type === QUESTION_TYPE.MATCHING" class="pv-body pv-match">
            <div class="pv-col">
                <div v-for="pair in question.matchingPairs" :key="pair.id" class="pv-option">
                    <RichContent :content="pair.leftItem" :format="format" inline />
                </div>
            </div>
            <i class="bx bx-link pv-link"></i>
            <div class="pv-col">
                <div v-for="(item, i) in rightItems" :key="i" class="pv-option">
                    <RichContent :content="item" :format="format" inline />
                </div>
            </div>
        </div>

        <div v-else-if="question.type === QUESTION_TYPE.ORDERING" class="pv-body">
            <div v-for="item in shuffledItems" :key="item.id" class="pv-option">
                <i class="bx bx-grid-vertical pv-grip"></i>
                <RichContent :content="item.text" :format="format" inline />
            </div>
        </div>

        <div v-else-if="question.type === QUESTION_TYPE.SHORT_TEXT" class="pv-body">
            <input
                class="pv-input"
                type="text"
                disabled
                :placeholder="$t('question_editor.preview.short_placeholder')"
            />
        </div>
    </article>
</template>

<style scoped>
.pv-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 24px;
    color: var(--ed-text);
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 16px;
}
.pv-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}
.pv-text {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
}
.pv-text b {
    flex: none;
    color: var(--ed-muted);
}
.pv-empty {
    font-style: italic;
    font-weight: 400;
    color: var(--ed-muted);
}
.pv-tag {
    flex: none;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--ed-muted);
    background-color: var(--ed-surface);
    border: 1px solid var(--ed-border);
    border-radius: 6px;
}
.pv-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.pv-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 10px 14px;
    font-size: 14px;
    background-color: var(--ed-surface);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
}
.pv-mark {
    flex: none;
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--ed-grip);
    border-radius: 50%;
}
.pv-mark.square {
    border-radius: 5px;
}
.pv-grip {
    color: var(--ed-grip);
}
.pv-match {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
    align-items: start;
    gap: 12px;
}
.pv-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.pv-link {
    align-self: center;
    font-size: 20px;
    color: var(--ed-primary-text);
}
.pv-input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    color: var(--ed-text);
    background-color: var(--ed-input);
    border: 1px solid var(--ed-border-strong);
    border-radius: 8px;
}
@media (max-width: 575.98px) {
    .pv-card {
        padding: 16px;
    }
    .pv-match {
        grid-template-columns: 1fr;
    }
    .pv-link {
        display: none;
    }
}
</style>
