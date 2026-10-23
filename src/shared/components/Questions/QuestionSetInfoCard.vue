<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";

import ApiTag from "@/api/ApiTag";
import type Tag from "@/models/response/tag/tag";

/*
 * Thẻ thông tin bộ câu hỏi ở đầu cột soạn: tiêu đề lớn gạch chân, mô tả, các thẻ (gợi ý thẻ có sẵn khi gõ).
 * Giới hạn khớp trang cũ: tiêu đề 100 ký tự, mô tả 250 ký tự, tối đa 5 thẻ, mỗi thẻ 50 ký tự.
 */
const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 50;

const { t } = useI18n();

const name = defineModel<string>("name", { default: "" });
const description = defineModel<string>("description", { default: "" });
const tags = defineModel<string[]>("tags", { default: () => [] });

const nameTouched = ref(false);

//#region thẻ
const adding = ref(false);
const draft = ref("");
const suggestions = ref<Tag[]>([]);
const inputRef = ref<{ focus: () => void } | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchSeq = 0;

const openAdd = async () => {
    adding.value = true;
    await nextTick();
    inputRef.value?.focus();
};

const closeAdd = () => {
    adding.value = false;
    draft.value = "";
    suggestions.value = [];
    clearTimeout(searchTimer);
};

const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return false;
    if (tags.value.length >= MAX_TAGS) {
        message.warning(t("message.maximum_tag", { tag: MAX_TAGS }));
        return false;
    }
    if (tags.value.includes(value)) {
        message.warning(t("message.duplicate_tag"));
        return false;
    }
    if (value.length > MAX_TAG_LENGTH) {
        message.warning(t("message.invalid_tag_content"));
        return false;
    }
    tags.value = [...tags.value, value];
    return true;
};

const commit = () => {
    if (addTag(draft.value)) closeAdd();
};

const pick = (tag: Tag) => {
    if (addTag(tag.name)) closeAdd();
};

const removeTag = (index: number) => {
    tags.value = tags.value.filter((_, i) => i !== index);
};

watch(draft, (value) => {
    clearTimeout(searchTimer);
    const keyword = value.trim();
    if (!keyword || keyword.length >= MAX_TAG_LENGTH) {
        suggestions.value = [];
        return;
    }
    searchTimer = setTimeout(async () => {
        const seq = ++searchSeq;
        try {
            const result = await ApiTag.GetAllByLimit({ name: keyword, pageSize: 10 });
            // bỏ kết quả của lần gõ cũ trả về muộn
            if (seq === searchSeq && result.data.success) suggestions.value = result.data.data;
        } catch {
            suggestions.value = [];
        }
    }, 250);
});

onBeforeUnmount(() => clearTimeout(searchTimer));
//#endregion
</script>

<template>
    <section class="info-card">
        <div class="info-accent"></div>
        <div class="info-body">
            <input
                v-model="name"
                class="info-title"
                :class="{ invalid: nameTouched && !name.trim() }"
                type="text"
                :maxlength="100"
                :placeholder="$t('question_editor.info.title_placeholder')"
                :aria-label="$t('create_QS.quiz.title')"
                @blur="nameTouched = true"
            />
            <div class="info-rule" :class="{ invalid: nameTouched && !name.trim() }"></div>
            <a-textarea
                v-model:value="description"
                class="info-desc"
                :bordered="false"
                :auto-size="{ minRows: 1, maxRows: 4 }"
                :maxlength="250"
                :placeholder="$t('question_editor.info.description_placeholder')"
                :aria-label="$t('create_QS.quiz.description')"
            />
            <div class="info-tags">
                <span v-for="(tag, index) in tags" :key="tag" class="info-tag">
                    {{ tag }}
                    <button
                        type="button"
                        :aria-label="$t('question_editor.info.remove_tag', { tag })"
                        @click="removeTag(index)"
                    >
                        <i class="bx bx-x"></i>
                    </button>
                </span>
                <div v-if="adding" class="info-tag-add">
                    <a-input
                        ref="inputRef"
                        v-model:value="draft"
                        size="small"
                        class="info-tag-input"
                        :maxlength="MAX_TAG_LENGTH"
                        :placeholder="$t('question_editor.info.tag_placeholder')"
                        @pressEnter="commit"
                        @keydown.esc="closeAdd"
                        @blur="closeAdd"
                    />
                    <ul v-if="suggestions.length > 0" class="info-tag-suggest">
                        <li
                            v-for="tag in suggestions"
                            :key="tag.name"
                            @mousedown.prevent="pick(tag)"
                        >
                            <span>{{ tag.name }}</span>
                            <small>{{ tag.questionSetCount }}</small>
                        </li>
                    </ul>
                </div>
                <button v-else type="button" class="info-add-tag" @click="openAdd">
                    <i class="bx bx-purchase-tag-alt"></i>
                    {{ $t("question_editor.info.add_tag") }}
                </button>
            </div>
        </div>
    </section>
</template>

<style scoped>
.info-card {
    position: relative;
    overflow: visible;
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 16px;
}
.info-accent {
    height: 8px;
    background-color: var(--ed-primary);
    border-radius: 15px 15px 0 0;
}
.info-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 28px 24px;
}
.info-title {
    width: 100%;
    padding: 0;
    font-size: 30px;
    font-weight: 700;
    line-height: 44px;
    color: var(--ed-text);
    background: transparent;
    border: none;
    outline: none;
}
.info-title::placeholder {
    color: var(--ed-grip);
}
.info-rule {
    height: 2px;
    background-color: var(--ed-primary);
}
.info-title.invalid::placeholder,
.info-rule.invalid {
    color: var(--ed-danger);
    background-color: var(--ed-danger);
}
.info-desc {
    padding: 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--ed-muted);
    background: transparent;
    resize: none;
}
.info-desc:focus {
    box-shadow: none;
}
.info-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 40px;
}
.info-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px 4px 10px;
    font-size: 13px;
    font-weight: 500;
    line-height: 17px;
    color: var(--c-primary-text);
    background-color: var(--ed-primary-soft);
    border-radius: 999px;
}
.info-tag button {
    display: inline-flex;
    padding: 0;
    font-size: 15px;
    color: inherit;
    background: transparent;
    border: none;
    cursor: pointer;
}
.info-add-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--c-primary-text);
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}
.info-add-tag i {
    font-size: 18px;
}
.info-add-tag:hover {
    background-color: var(--ed-primary-soft);
}
.info-tag-add {
    position: relative;
}
.info-tag-input {
    width: 220px;
}
.info-tag-suggest {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    width: 260px;
    max-height: 240px;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    list-style: none;
    background-color: var(--ed-card);
    border: 1px solid var(--ed-border);
    border-radius: 10px;
    box-shadow: var(--ed-shadow);
}
.info-tag-suggest li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--ed-text);
    border-radius: 8px;
    cursor: pointer;
}
.info-tag-suggest li:hover {
    background-color: var(--ed-primary-soft);
}
.info-tag-suggest small {
    color: var(--ed-muted);
}
button:focus-visible,
input:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}
.info-title:focus-visible {
    outline: none;
}
@media (max-width: 575.98px) {
    .info-body {
        padding: 16px 16px 18px;
    }
    .info-title {
        font-size: 24px;
        line-height: 34px;
    }
}
</style>
