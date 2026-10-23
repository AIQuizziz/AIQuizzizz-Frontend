<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import type { RequestQuestion } from "@/models/request/question";
import { questionIssueMap } from "@/services/QuestionOutlineService";

import MultipleChoice from "@/shared/components/Questions/MultipleChoice.vue";
import Matching from "@/shared/components/Questions/Matching.vue";
import Ordering from "@/shared/components/Questions/Ordering.vue";
import ShortText from "@/shared/components/Questions/ShortText.vue";
import LanguageFlashcard from "@/shared/components/Questions/LanguageFlashcard.vue";
import QuestionOutline from "@/shared/components/Questions/QuestionOutline.vue";
import QuestionSummaryCard from "@/shared/components/Questions/QuestionSummaryCard.vue";

/*
 * Bố cục soạn bộ câu hỏi (trang tạo / sửa): mục lục câu hỏi cố định bên trái, cột soạn ở giữa
 * (thẻ thông tin bộ ở slot "header", mỗi lúc chỉ mở một câu, các câu khác thu gọn), thanh công cụ nổi bên phải.
 * Trang cha giữ dữ liệu và các thao tác thêm / xoá / nhập: component chỉ phát sự kiện.
 */
interface Props {
    questions: RequestQuestion[];
    allowFlashcard?: boolean;
    /** Đang tải câu hỏi (trang sửa): hiện khung chờ thay cho danh sách */
    loading?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "update:questions", questions: RequestQuestion[]): void;
    (e: "add"): void;
    (e: "remove", index: number): void;
    (e: "changeType", question: RequestQuestion): void;
    (e: "import"): void;
    (e: "generate"): void;
}>();

const componentMap = {
    MultipleChoice,
    Matching,
    Ordering,
    ShortText,
    LanguageFlashcard,
};

const rootRef = ref<HTMLElement | null>(null);
const activeId = ref<string | null>(null);
const issues = computed(() => questionIssueMap(props.questions));

// luôn có một câu đang mở: câu đầu tiên khi mới vào / khi câu đang mở bị xoá
watch(
    () => props.questions.map((q) => q.id).join("|"),
    () => {
        if (props.questions.length === 0) activeId.value = null;
        else if (!props.questions.some((q) => q.id === activeId.value)) activeId.value = props.questions[0].id;
    },
    { immediate: true },
);

/** Mở câu hỏi để soạn và cuộn tới đầu câu đó (kể cả khi vừa mới thêm vào danh sách) */
const focusQuestion = (id: string) => {
    activeId.value = id;
    // đợi DOM đổi (câu cũ thu gọn, câu mới mở ra) rồi mới tính vị trí cuộn
    nextTick(() => {
        nextTick(() => {
            requestAnimationFrame(() => {
                const items = rootRef.value?.querySelectorAll<HTMLElement>("[data-question-id]");
                const target = Array.from(items ?? []).find((el) => el.dataset.questionId === id);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    });
};

defineExpose({ focusQuestion });
</script>

<template>
    <div ref="rootRef" class="editor-layout" @keydown.ctrl.enter.prevent="emit('add')">
        <div class="editor-outline">
            <QuestionOutline
                :questions="questions"
                :active-id="activeId"
                @update:questions="(value) => emit('update:questions', value)"
                @select="focusQuestion"
                @add="emit('add')"
            />
        </div>

        <div class="editor-main">
            <slot name="header"></slot>

            <div v-if="loading" class="editor-list">
                <a-skeleton v-for="n in 3" :key="n" :loading="true" :active="false" />
            </div>
            <div v-else class="editor-list">
                <div
                    v-for="(item, index) in questions"
                    :key="item.id"
                    class="editor-item"
                    :data-question-id="item.id"
                >
                    <component
                        v-if="item.id === activeId"
                        :is="componentMap[item.type]"
                        :question="item"
                        :index="index + 1"
                        :displayScore="true"
                        :allowFlashcard="allowFlashcard"
                        @deleteQuestion="emit('remove', index)"
                        @changeQuestionType="emit('changeType', item)"
                    />
                    <QuestionSummaryCard
                        v-else
                        :question="item"
                        :index="index + 1"
                        :issues="issues.get(item.id)"
                        @open="focusQuestion(item.id)"
                    />
                </div>
            </div>

            <div v-if="!loading" class="add-question-btn" @click="emit('add')">
                <i class="bx bx-plus"></i>
                {{ $t("create_QS.buttons.add_question") }}
            </div>
        </div>

        <div class="editor-toolbar" role="toolbar" :aria-label="$t('question_editor.toolbar.label')">
            <a-tooltip placement="left" :title="$t('question_editor.toolbar.add')">
                <button type="button" class="toolbar-btn" @click="emit('add')">
                    <i class="bx bx-plus"></i>
                </button>
            </a-tooltip>
            <a-tooltip placement="left" :title="$t('create_QS.buttons.import')">
                <button type="button" class="toolbar-btn" @click="emit('import')">
                    <i class="bx bx-download"></i>
                </button>
            </a-tooltip>
            <a-tooltip placement="left" :title="$t('create_QS.buttons.generated_by_ai')">
                <button type="button" class="toolbar-btn" @click="emit('generate')">
                    <i class="bx bx-bot"></i>
                </button>
            </a-tooltip>
        </div>
    </div>
</template>

<style scoped>
.editor-layout {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding: 8px 8px 32px;
}
.editor-outline {
    flex: none;
    width: 300px;
    position: sticky;
    top: 8px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 120px);
}
.editor-outline > :deep(.question-outline) {
    flex: 1;
    min-height: 0;
}
.editor-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.editor-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.editor-item {
    scroll-margin-top: 8px;
}
.editor-toolbar {
    flex: none;
    position: sticky;
    top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background-color: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 22px;
    color: var(--c-primary-text);
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}
.toolbar-btn:hover {
    background-color: color-mix(in srgb, var(--main-color) 14%, transparent);
}
.toolbar-btn:focus-visible {
    outline: 2px solid var(--c-focus-ring);
}

/* màn hình hẹp: mục lục xếp trên cột soạn, thanh công cụ nổi ở góc dưới bên phải */
@media (max-width: 1099.98px) {
    .editor-layout {
        flex-direction: column;
        align-items: stretch;
    }
    .editor-outline {
        position: static;
        width: 100%;
        max-height: 280px;
    }
    .editor-toolbar {
        position: fixed;
        top: auto;
        right: 16px;
        bottom: 16px;
        z-index: 20;
        flex-direction: row;
    }
}
</style>
