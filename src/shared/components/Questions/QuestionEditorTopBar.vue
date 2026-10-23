<script setup lang="ts">
/*
 * Thanh tiêu đề của trang tạo / sửa bộ câu hỏi: nút quay lại, tên trang + dòng phụ,
 * công tắc "Câu hỏi | Xem trước" và nút lưu.
 */
defineProps<{
    title: string;
    subtitle?: string;
    saveLabel: string;
    saving?: boolean;
}>();

const mode = defineModel<"edit" | "preview">("mode", { default: "edit" });
defineEmits<(e: "save") => void>();
</script>

<template>
    <header class="editor-topbar">
        <div class="topbar-left">
            <RouterLink
                class="topbar-back"
                :to="{ name: 'User_Library' }"
                :aria-label="$t('question_editor.topbar.back')"
            >
                <i class="bx bx-chevron-left"></i>
            </RouterLink>
            <div class="topbar-title">
                <h1>{{ title }}</h1>
                <span v-if="subtitle">{{ subtitle }}</span>
            </div>
        </div>
        <div class="topbar-actions">
            <div class="topbar-segmented" role="tablist">
                <button
                    type="button"
                    role="tab"
                    :aria-selected="mode === 'edit'"
                    :class="{ active: mode === 'edit' }"
                    @click="mode = 'edit'"
                >
                    {{ $t("question_editor.topbar.questions") }}
                </button>
                <button
                    type="button"
                    role="tab"
                    :aria-selected="mode === 'preview'"
                    :class="{ active: mode === 'preview' }"
                    @click="mode = 'preview'"
                >
                    {{ $t("question_editor.topbar.preview") }}
                </button>
            </div>
            <button type="button" class="topbar-save" :disabled="saving" @click="$emit('save')">
                <i class="bx bx-save"></i>
                {{ saveLabel }}
            </button>
        </div>
    </header>
</template>

<style scoped>
.editor-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 74px;
    padding: 14px 32px;
    background-color: var(--ed-card);
    border-bottom: 1px solid var(--ed-border);
}
.topbar-left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}
.topbar-back {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 22px;
    color: var(--ed-text);
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
}
.topbar-back:hover {
    border-color: var(--ed-primary);
    color: var(--ed-primary-text);
}
.topbar-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.topbar-title h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 26px;
    color: var(--ed-text);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.topbar-title span {
    font-size: 12px;
    line-height: 17px;
    color: var(--ed-muted);
}
.topbar-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
}
.topbar-segmented {
    display: flex;
    gap: 2px;
    padding: 3px;
    background-color: var(--ed-surface);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
}
.topbar-segmented button {
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    line-height: 19px;
    color: var(--ed-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
}
.topbar-segmented button.active {
    font-weight: 600;
    color: var(--ed-text);
    background-color: var(--ed-card);
    border-color: var(--ed-border);
}
.topbar-save {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: #fff;
    background-color: var(--ed-primary);
    border: none;
    border-radius: 10px;
    cursor: pointer;
}
.topbar-save i {
    font-size: 18px;
}
.topbar-save:hover {
    background-color: var(--main-sub-color);
}
.topbar-save:disabled {
    opacity: 0.6;
    cursor: default;
}
button:focus-visible,
a:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}
@media (max-width: 767.98px) {
    .editor-topbar {
        flex-wrap: wrap;
        padding: 12px 16px;
    }
}
</style>
