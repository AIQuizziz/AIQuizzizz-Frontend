<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";

import { copyToClipboard } from "@/services/ClipboardService";
import {
    QUESTION_JSON_TYPES,
    buildQuestionJsonPrompt,
    type PromptDifficulty,
    type PromptLocale,
    type QuestionJsonType,
} from "@/services/QuestionJsonService";

const { t, locale } = useI18n();

const props = defineProps<{ topic?: string }>();

const open = ref(false);
const promptLocale = computed<PromptLocale>(() => (locale.value === "en" ? "en" : "vn"));

const form = reactive({
    topic: "",
    count: 10,
    types: [...QUESTION_JSON_TYPES] as QuestionJsonType[],
    questionLanguage: "",
    difficulty: "mixed" as PromptDifficulty,
    notes: "",
});

const typeOptions = computed(() =>
    QUESTION_JSON_TYPES.map((x) => ({ label: t(`question_json.types.${x}`), value: x })),
);
const difficultyOptions = computed(() =>
    (["mixed", "easy", "medium", "hard"] as PromptDifficulty[]).map((x) => ({
        label: t(`question_json.prompt.difficulty_options.${x}`),
        value: x,
    })),
);

const prompt = computed(() => buildQuestionJsonPrompt(form, promptLocale.value));

const openModal = () => {
    // điền sẵn chủ đề = tên bộ câu hỏi đang soạn (nếu người dùng chưa nhập)
    if (!form.topic.trim() && props.topic?.trim()) form.topic = props.topic.trim();
    if (!form.questionLanguage) form.questionLanguage = t("question_json.prompt.default_language");
    open.value = true;
};

defineExpose({ openModal });

const onCopy = async () => {
    if (form.types.length === 0) {
        message.warning(t("question_json.prompt.select_type"));
        return;
    }
    if (await copyToClipboard(prompt.value)) message.success(t("question_json.prompt.copied"));
    else message.error(t("question_json.prompt.copy_failed"));
};
</script>

<template>
    <a-modal
        v-model:open="open"
        centered
        :width="960"
        :title="$t('question_json.prompt.title')"
        :footer="null"
        wrap-class-name="question-json-prompt-modal"
    >
        <p class="prompt-intro">{{ $t("question_json.prompt.intro") }}</p>
        <div class="prompt-layout">
            <a-form layout="vertical" class="prompt-form">
                <a-form-item :label="$t('question_json.prompt.topic')">
                    <a-input
                        v-model:value="form.topic"
                        :maxlength="200"
                        :placeholder="$t('question_json.prompt.topic_placeholder')"
                    />
                </a-form-item>
                <div class="prompt-form-row">
                    <a-form-item :label="$t('question_json.prompt.count')">
                        <a-input-number v-model:value="form.count" :min="1" :max="100" class="w-100" />
                    </a-form-item>
                    <a-form-item :label="$t('question_json.prompt.difficulty')">
                        <a-select v-model:value="form.difficulty" :options="difficultyOptions" />
                    </a-form-item>
                </div>
                <a-form-item :label="$t('question_json.prompt.question_language')">
                    <a-input v-model:value="form.questionLanguage" :maxlength="50" />
                </a-form-item>
                <a-form-item :label="$t('question_json.prompt.types')">
                    <a-checkbox-group v-model:value="form.types" :options="typeOptions" />
                </a-form-item>
                <a-form-item :label="$t('question_json.prompt.notes')">
                    <a-textarea
                        v-model:value="form.notes"
                        :maxlength="500"
                        :auto-size="{ minRows: 2, maxRows: 4 }"
                        :placeholder="$t('question_json.prompt.notes_placeholder')"
                    />
                </a-form-item>
            </a-form>
            <div class="prompt-preview">
                <div class="prompt-preview-header">
                    <span>{{ $t("question_json.prompt.preview") }}</span>
                    <a-button type="primary" class="main-color-btn" @click="onCopy">
                        <i class="bx bx-copy me-1"></i>
                        {{ $t("question_json.prompt.copy") }}
                    </a-button>
                </div>
                <pre class="prompt-preview-text">{{ prompt }}</pre>
                <ol class="prompt-steps">
                    <li>{{ $t("question_json.prompt.step_1") }}</li>
                    <li>{{ $t("question_json.prompt.step_2") }}</li>
                    <li>{{ $t("question_json.prompt.step_3") }}</li>
                </ol>
            </div>
        </div>
    </a-modal>
</template>

<style>
.question-json-prompt-modal .ant-modal-content {
    padding: 20px 24px 24px;
}
.question-json-prompt-modal .ant-modal-header {
    margin-bottom: 8px;
    padding: 0;
    border-bottom: none;
    background: transparent;
}
.question-json-prompt-modal .ant-modal-title {
    font-size: 20px;
    font-weight: 700;
}
.question-json-prompt-modal .ant-modal-body {
    padding: 0;
}
</style>
<style scoped>
.prompt-intro {
    color: var(--c-text-muted);
    margin-bottom: 16px;
}
.prompt-layout {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 16px;
}
.prompt-form {
    padding: 20px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}
.prompt-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.prompt-form :deep(.ant-form-item) {
    margin-bottom: 14px;
}
.prompt-form :deep(.ant-checkbox-group) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 0;
}
.prompt-preview {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 20px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}
.prompt-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 700;
    color: var(--c-text);
}
.prompt-preview-text {
    flex: 1;
    max-height: 380px;
    overflow: auto;
    margin: 0;
    padding: 12px;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-color);
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-lg);
}
.prompt-steps {
    margin: 10px 0 0;
    padding-left: 18px;
    font-size: 13px;
    color: var(--c-text-muted);
}
@media (max-width: 767.98px) {
    .prompt-layout {
        grid-template-columns: 1fr;
    }
    .prompt-form,
    .prompt-preview {
        padding: 14px;
    }
    .prompt-preview-text {
        max-height: 260px;
    }
}
</style>
