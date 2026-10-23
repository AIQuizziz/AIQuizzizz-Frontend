<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import type { RequestQuestion } from "@/models/request/question";
import QUESTION_TYPE from "@/constants/questionTypes";
import { mediaPanelOpen } from "@/services/QuestionEditorService";
import { questionIssueMap } from "@/services/QuestionOutlineService";

import EditorQuestionCard from "@/shared/components/Questions/EditorQuestionCard.vue";
import LanguageFlashcard from "@/shared/components/Questions/LanguageFlashcard.vue";
import QuestionOutline from "@/shared/components/Questions/QuestionOutline.vue";
import QuestionPreviewCard from "@/shared/components/Questions/QuestionPreviewCard.vue";
import QuestionSummaryCard from "@/shared/components/Questions/QuestionSummaryCard.vue";

/*
 * Bố cục soạn bộ câu hỏi (trang tạo / sửa, phương án 11): mục lục câu hỏi cố định bên trái, cột soạn ở giữa
 * (thẻ thông tin bộ ở slot "header", mỗi lúc chỉ mở một câu, các câu khác thu gọn), thanh công cụ nổi bên phải.
 * Chế độ "preview": xem như học viên. Trang cha giữ dữ liệu và các thao tác thêm / xoá / nhập: component chỉ phát sự kiện.
 */
interface Props {
    questions: RequestQuestion[];
    allowFlashcard?: boolean;
    /** Đang tải câu hỏi (trang sửa): hiện khung chờ thay cho danh sách */
    loading?: boolean;
    mode?: "edit" | "preview";
}

const props = withDefaults(defineProps<Props>(), { mode: "edit" });
const emit = defineEmits<{
    (e: "update:questions", questions: RequestQuestion[]): void;
    (e: "add"): void;
    (e: "remove", index: number): void;
    (e: "duplicate", index: number): void;
    (e: "changeType", question: RequestQuestion): void;
    (e: "import"): void;
    (e: "generate"): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const activeId = ref<string | null>(null);
const issues = computed(() => questionIssueMap(props.questions));

// "Thu gọn tất cả": không câu nào mở cho tới khi người dùng mở một câu
const collapsedAll = ref(false);

// luôn có một câu đang mở (trừ khi vừa "Thu gọn tất cả"): câu đầu tiên khi mới vào / khi câu đang mở bị xoá
watch(
    () => props.questions.map((q) => q.id).join("|"),
    () => {
        if (props.questions.length === 0) {
            activeId.value = null;
            return;
        }
        const stillThere = props.questions.some((q) => q.id === activeId.value);
        if (!stillThere && !collapsedAll.value) activeId.value = props.questions[0].id;
    },
    { immediate: true },
);

const collapseAll = () => {
    collapsedAll.value = true;
    activeId.value = null;
};

const scrollToQuestion = (id: string) =>
    nextTick(() => {
        nextTick(() => {
            requestAnimationFrame(() => {
                const items = rootRef.value?.querySelectorAll<HTMLElement>("[data-question-id]");
                const target = Array.from(items ?? []).find((el) => el.dataset.questionId === id);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    });

/** Mở câu hỏi để soạn và cuộn tới đầu câu đó (kể cả khi vừa mới thêm vào danh sách) */
const focusQuestion = (id: string) => {
    collapsedAll.value = false;
    activeId.value = id;
    // đợi DOM đổi (câu cũ thu gọn, câu mới mở ra) rồi mới tính vị trí cuộn
    scrollToQuestion(id);
};

/** Mở khung ảnh / video của câu đang mở (nút "ảnh" trên thanh công cụ) */
const openMediaOfActive = () => {
    const id = activeId.value ?? props.questions[0]?.id;
    if (!id) return;
    mediaPanelOpen.add(id);
    focusQuestion(id);
};

defineExpose({ focusQuestion });
</script>

<template>
    <div
        ref="rootRef"
        class="editor-layout"
        :class="{ 'is-preview': mode === 'preview' }"
        @keydown.ctrl.enter.prevent="emit('add')"
    >
        <div v-if="mode === 'edit'" class="editor-outline">
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

            <p v-if="mode === 'preview'" class="editor-preview-note">
                <i class="bx bx-show"></i>{{ $t("question_editor.preview.note") }}
            </p>

            <div v-if="loading" class="editor-list">
                <a-skeleton v-for="n in 3" :key="n" :loading="true" :active="false" />
            </div>
            <div v-else-if="mode === 'preview'" class="editor-list">
                <QuestionPreviewCard
                    v-for="(item, index) in questions"
                    :key="item.id"
                    :question="item"
                    :index="index + 1"
                />
            </div>
            <div v-else class="editor-list">
                <div
                    v-for="(item, index) in questions"
                    :key="item.id"
                    class="editor-item"
                    :data-question-id="item.id"
                >
                    <template v-if="item.id === activeId">
                        <div v-if="item.type === QUESTION_TYPE.LANGUAGE_FLASHCARD" class="editor-legacy">
                            <LanguageFlashcard
                                :question="item"
                                :index="index + 1"
                                :displayScore="true"
                                :allowFlashcard="allowFlashcard"
                                @deleteQuestion="emit('remove', index)"
                                @changeQuestionType="emit('changeType', item)"
                            />
                        </div>
                        <EditorQuestionCard
                            v-else
                            :question="item"
                            :index="index + 1"
                            :allow-flashcard="allowFlashcard"
                            @deleteQuestion="emit('remove', index)"
                            @changeQuestionType="emit('changeType', item)"
                            @duplicateQuestion="emit('duplicate', index)"
                        />
                    </template>
                    <QuestionSummaryCard
                        v-else
                        :question="item"
                        :index="index + 1"
                        :issues="issues.get(item.id)"
                        @open="focusQuestion(item.id)"
                    />
                </div>
            </div>
        </div>

        <div
            v-if="mode === 'edit'"
            class="editor-toolbar"
            role="toolbar"
            :aria-label="$t('question_editor.toolbar.label')"
        >
            <a-tooltip placement="left" :title="$t('question_editor.toolbar.add')">
                <button
                    type="button"
                    class="toolbar-btn"
                    :aria-label="$t('question_editor.toolbar.add')"
                    @click="emit('add')"
                >
                    <i class="bx bx-plus"></i>
                </button>
            </a-tooltip>
            <a-tooltip placement="left" :title="$t('create_QS.buttons.import')">
                <button
                    type="button"
                    class="toolbar-btn"
                    :aria-label="$t('create_QS.buttons.import')"
                    @click="emit('import')"
                >
                    <i class="bx bx-download"></i>
                </button>
            </a-tooltip>
            <a-tooltip placement="left" :title="$t('create_QS.buttons.generated_by_ai')">
                <button
                    type="button"
                    class="toolbar-btn"
                    :aria-label="$t('create_QS.buttons.generated_by_ai')"
                    @click="emit('generate')"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
                    </svg>
                </button>
            </a-tooltip>
            <a-tooltip placement="left" :title="$t('question_editor.toolbar.media')">
                <button
                    type="button"
                    class="toolbar-btn"
                    :aria-label="$t('question_editor.toolbar.media')"
                    @click="openMediaOfActive"
                >
                    <i class="bx bx-image"></i>
                </button>
            </a-tooltip>
            <a-tooltip placement="left" :title="$t('question_editor.toolbar.collapse')">
                <button
                    type="button"
                    class="toolbar-btn"
                    :aria-label="$t('question_editor.toolbar.collapse')"
                    @click="collapseAll"
                >
                    <i class="bx bx-layer"></i>
                </button>
            </a-tooltip>
        </div>
    </div>
</template>

<style scoped>
.editor-layout {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    padding: 28px 32px;
}
.editor-layout.is-preview {
    justify-content: center;
}
.editor-outline {
    flex: none;
    width: 300px;
    position: sticky;
    top: 102px;
    height: calc(100vh - 156px);
    min-height: 320px;
}
.editor-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.is-preview .editor-main {
    max-width: 974px;
}
.editor-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.editor-item {
    scroll-margin-top: 102px;
}
.editor-legacy {
    padding: 8px 12px 12px;
    background-color: var(--ed-card);
    border: 2px solid var(--ed-primary);
    border-radius: 16px;
    box-shadow: var(--ed-shadow);
}
.editor-preview-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    color: var(--ed-muted);
}
.editor-toolbar {
    flex: none;
    position: sticky;
    top: 102px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 14px;
    box-shadow: var(--ed-shadow);
}
.toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 20px;
    color: var(--ed-primary-text);
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}
.toolbar-btn:hover {
    background-color: var(--ed-primary-soft);
}
.toolbar-btn:focus-visible {
    outline: 2px solid var(--c-focus-ring);
}

/* màn hình hẹp: mục lục xếp trên cột soạn, thanh công cụ thành nút nổi góc dưới bên phải */
@media (max-width: 1099.98px) {
    .editor-layout {
        flex-direction: column;
        align-items: stretch;
        padding: 20px 16px 88px;
    }
    .editor-outline {
        position: static;
        width: 100%;
        height: auto;
        min-height: 0;
    }
    .editor-outline :deep(.question-outline) {
        height: auto;
        max-height: 300px;
    }
    .editor-toolbar {
        position: fixed;
        top: auto;
        right: 16px;
        bottom: 16px;
        z-index: 20;
        flex-direction: row;
    }
    .editor-item {
        scroll-margin-top: 90px;
    }
}
</style>
