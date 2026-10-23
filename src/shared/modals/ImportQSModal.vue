<script setup lang="ts">
import ApiTest from "@/api/ApiTest";
import ApiQuestionSet from "@/api/ApiQuestionSet";

import { ref, reactive, watch, onMounted, computed } from "vue";
import { Modal, message } from "ant-design-vue";
import { InboxOutlined } from "@ant-design/icons-vue";

import { useI18n } from "vue-i18n";

import type { RequestQuestion } from "@/models/request/question";
import QUESTION_TYPE from "@/constants/questionTypes";
import UPLOADED_QUESTION_STATUS from "@/constants/uploadedQuestionStatus";
import RichContent from "@/shared/components/Common/RichContent.vue";
import QuestionJsonPromptModal from "@/shared/modals/QuestionJsonPromptModal.vue";
import {
    QUESTION_JSON_MAX_LENGTH,
    downloadJsonFile,
    exampleQuestionJson,
    isJsonFile,
    type ImportedSetInfo,
} from "@/services/QuestionJsonService";

const { t } = useI18n();

interface Props {
    title: string;
    numberOfQuestion: number;
}

// câu hỏi xem trước: nhập JSON có thêm số thứ tự trong file + lỗi / cảnh báo từng câu
type PreviewQuestion = RequestQuestion & { index?: number; errors?: string[]; warnings?: string[] };

const props = defineProps<Props>();

const emit = defineEmits<
    (e: "import", selected: RequestQuestion[], setInfo?: ImportedSetInfo | null) => void
>();

const modal_import_open = ref(false);
const question_data = ref<PreviewQuestion[]>([]);

const uploadedQuestions = ref<PreviewQuestion[]>([]);
const uploadedInvalidQuestions = ref<PreviewQuestion[]>([]);

// nguồn nhập: tệp Excel theo mẫu hoặc JSON (dán / chọn tệp)
const source = ref<"excel" | "json">("excel");
const sourceOptions = computed(() => [
    { label: "Excel", value: "excel" },
    { label: "JSON", value: "json" },
]);

//#region download link
const download_link = ref("");

const getLink = async () => {
    if (download_link.value) return;
    try {
        const result = await ApiQuestionSet.DownloadFileImport();
        if (result.data.success) {
            download_link.value = result.data.data;
        }
    } catch (error) {
        console.log(error);
    }
};

//#endregion

const importModalState = reactive({
    checkAll: false,
    indeterminate: false,
    checkedList: [] as RequestQuestion[],
});

const openImportModal = async () => {
    await getLink();
    importModalState.checkedList = []; //reset checked list
    modal_import_open.value = true;
};

const closeImportModal = () => {
    modal_import_open.value = false;
};

//expose functions to main ref
defineExpose({
    openImportModal,
});

//#region file
//file-upload customized events
const files = ref<File[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const openFileExplorer = () => {
    fileInput.value?.click();
};

const onFileChange = async (file: File) => {
    if (file) {
        if (
            file.type !== "application/vnd.ms-excel" &&
            file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
            message.error(t("message.file_support_only", { fileTypes: "XLS, XLSX" }));
            return;
        }

        // reset kết quả cũ; file chỉ được coi là "đã tải lên" sau khi server kiểm tra hợp lệ
        files.value = [];
        question_data.value = [];
        uploadedQuestions.value = [];
        uploadedInvalidQuestions.value = [];
        importModalState.checkedList = [];

        let result;
        try {
            result = await ApiTest.ImportFile(file);
        } catch (error) {
            // file hỏng/sai định dạng (400 INVALID_FILE_FORMAT...): toast lỗi đã hiển thị ở interceptor,
            // không giữ file lỗi trong danh sách
            files.value = [];
            console.log("ERROR: import file", error);
            return;
        }

        if (result?.data?.success) {
            files.value.push(file);
            message.success(t("message.uploaded_successfully", { name: file.name }));
            question_data.value = [
                ...result.data.data.validQuestions,
                ...result.data.data.invalidQuestions,
            ];

            uploadedQuestions.value = [
                ...result.data.data.validQuestions,
                ...result.data.data.invalidQuestions,
            ];

            uploadedInvalidQuestions.value = result.data.data.invalidQuestions;
            importModalState.checkedList = []; //reset checked list
        } else {
            files.value = [];
            message.error(t("message.uploaded_failed"));
        }

        return;
    }
    message.error(t("message.uploaded_failed"));
};

const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
        onFileChange(file);
        target.value = "";
    }
};

const handleDragEnter = (event: DragEvent) => {
    const types = event.dataTransfer?.types || [];
    if (Array.from(types).includes("files")) {
        isDragging.value = true;
    }
};

const handleDrop = (event: DragEvent) => {
    const file = event.dataTransfer?.files[0];

    isDragging.value = false;

    if (file) {
        onFileChange(file);
    }
};

const resetPreview = () => {
    importModalState.checkedList = [];
    question_data.value = [];
    uploadedInvalidQuestions.value = [];
    uploadedQuestions.value = [];
    jsonSetInfo.value = null;
    selected_option.value = UPLOADED_QUESTION_STATUS.ALL;
};

const onRemoveUploadedFile = (index: number) => {
    files.value?.splice(index, 1);
    resetPreview();
};

const onChangeSource = () => {
    files.value = [];
    resetPreview();
};
//#endregion

//#region json
const jsonText = ref("");
const jsonFileInput = ref<HTMLInputElement | null>(null);
const checkingJson = ref(false);
const jsonSetInfo = ref<ImportedSetInfo | null>(null);
const promptModalRef = ref<InstanceType<typeof QuestionJsonPromptModal> | null>(null);

const readJsonFile = async (file?: File | null) => {
    if (!file) return;
    if (!isJsonFile(file)) {
        message.error(t("message.file_support_only", { fileTypes: "JSON" }));
        return;
    }
    if (file.size > QUESTION_JSON_MAX_LENGTH * 2) {
        message.error(t("ERROR_CODE.QUESTION_JSON_TOO_LARGE"));
        return;
    }
    jsonText.value = await file.text();
    await onCheckJson();
};

const handleJsonFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = "";
    await readJsonFile(file);
};

const handleJsonDrop = async (event: DragEvent) => {
    isDragging.value = false;
    await readJsonFile(event.dataTransfer?.files[0]);
};

const onCheckJson = async () => {
    const json = jsonText.value.trim();
    if (!json) {
        message.warning(t("question_json.import.empty"));
        return;
    }
    if (json.length > QUESTION_JSON_MAX_LENGTH) {
        message.error(t("ERROR_CODE.QUESTION_JSON_TOO_LARGE"));
        return;
    }

    resetPreview();
    checkingJson.value = true;
    try {
        const result = await ApiQuestionSet.ImportJson(json);
        if (!result?.data?.success) return;
        const data = result.data.data;
        question_data.value = [...data.validQuestions, ...data.invalidQuestions].sort(
            (a: PreviewQuestion, b: PreviewQuestion) => (a.index ?? 0) - (b.index ?? 0),
        );
        uploadedQuestions.value = question_data.value;
        uploadedInvalidQuestions.value = question_data.value.filter((x) => x.errors?.length);
        jsonSetInfo.value = data.questionSet ?? null;
        // chọn sẵn mọi câu hợp lệ
        importModalState.checkedList = question_data.value.filter((x) => !x.errors?.length);

        if (data.invalidQuestions.length > 0)
            message.warning(
                t("question_json.import.checked_with_errors", {
                    valid: data.validQuestions.length,
                    invalid: data.invalidQuestions.length,
                }),
            );
        else message.success(t("question_json.import.checked", { number: data.validQuestions.length }));
    } catch (error) {
        // JSON sai cú pháp / rỗng / quá nhiều câu: toast lỗi đã hiển thị ở interceptor
        console.log("ERROR: import json", error);
    } finally {
        checkingJson.value = false;
    }
};

const onDownloadJsonExample = () => downloadJsonFile("aiquizzizz-mau.json", exampleQuestionJson());

const onOpenPromptModal = () => promptModalRef.value?.openModal();
//#endregion

//#region filter select

const optionKeys = Object.values(UPLOADED_QUESTION_STATUS);
const select_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`import_qs_modal.uploaded_question_status.${key}`),
        value: key,
    })),
);
const selected_option = ref(select_options.value[0].value);

const onFilter = () => {
    importModalState.checkedList = [];

    let filtered_data = question_data.value;
    switch (selected_option.value) {
        case UPLOADED_QUESTION_STATUS.VALID: {
            filtered_data = question_data.value?.filter(
                (x) => !uploadedInvalidQuestions.value?.includes(x),
            );
            break;
        }
        case UPLOADED_QUESTION_STATUS.IN_VALID: {
            filtered_data = question_data.value?.filter((x) =>
                uploadedInvalidQuestions.value?.includes(x),
            );
            break;
        }
        default: {
            break;
        }
    }
    uploadedQuestions.value = filtered_data || [];
};
//#endregion

//checkboxes  / checkbox-all for importing question back to the page
const onCheckAll = (event: any) => {
    Object.assign(importModalState, {
        checkedList: event.target.checked ? uploadedQuestions.value : [],
        indeterminate: false,
    });
};

watch(
    () => importModalState.checkedList,
    (val) => {
        importModalState.indeterminate =
            !!val.length && val.length < uploadedQuestions.value!.length; //change to uploadedList when it done
        importModalState.checkAll = val.length > 0 && val.length === uploadedQuestions.value?.length;
    },
);

//preview uploaded content
const toggleDisplayAnswer = (index: number, button: EventTarget) => {
    let $button = $(button);

    $button.toggleClass("bx-chevron-up bx-chevron-down");

    const answer = $(`#question-item-answer-${index}`);
    if (answer) $(answer).slideToggle();
};

const handleModalImport = () => {
    if (importModalState.checkedList.length === 0) {
        message.warning(
            t("message.minimum_question", {
                number: 1,
            }),
        );
        return;
    }
    if (importModalState.checkedList.length + props.numberOfQuestion > 500) {
        message.warning(
            t("message.limit_question", {
                number: 500,
            }),
        );
        return;
    }
    Modal.confirm({
        title: t("import_qs_modal.confirm_modal.title"),
        content: t("import_qs_modal.confirm_modal.content", {
            number: importModalState.checkedList.length,
        }),
        okText: t("create_QS.buttons.ok"),
        cancelText: t("create_QS.buttons.cancel"),
        onOk: () => {
            const selectedQuestions = uploadedQuestions.value?.filter((question) =>
                importModalState.checkedList.includes(question),
            ) as RequestQuestion[];

            //emit event & params to main
            emit("import", selectedQuestions, source.value === "json" ? jsonSetInfo.value : null);
            closeImportModal();
        },
    });
};

const onDownloadTemplate = async () => {
    window.open(download_link.value, "_blank");
};

onMounted(() => {});
</script>

<template>
    <a-modal
        centered
        width="100%"
        wrap-class-name="full-modal"
        :open="modal_import_open"
        @cancel="closeImportModal"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="1">
                        <RouterLink @click="closeImportModal" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="23">
                        <span> {{ $t("import_qs_modal.title") }}</span> <br />
                        <span>
                            {{ $t("import_qs_modal.sub_title") }}
                        </span>
                    </a-col>
                </a-row>
            </div>
            <div class="modal-content-item">
                <div class="content-item-section upload-section">
                    <a-radio-group
                        v-model:value="source"
                        button-style="solid"
                        class="import-source-switch"
                        @change="onChangeSource"
                    >
                        <a-radio-button v-for="option in sourceOptions" :value="option.value">
                            {{ option.label }}
                        </a-radio-button>
                    </a-radio-group>
                    <div v-if="source === 'excel'" class="section-title">
                        <span>{{ $t("import_qs_modal.upload_section") }}</span>
                        <a-button class="main-color-btn" type="primary" @click="onDownloadTemplate">
                            {{ $t("import_qs_modal.buttons.download") }}
                        </a-button>
                    </div>
                    <template v-else>
                        <div class="section-title">
                            <span>{{ $t("question_json.import.title") }}</span>
                        </div>
                        <div class="json-actions">
                            <a-button type="primary" class="main-color-btn" @click="onOpenPromptModal">
                                <i class="bx bx-bot me-1"></i>
                                {{ $t("question_json.import.open_prompt") }}
                            </a-button>
                            <a-button @click="onDownloadJsonExample">
                                <i class="bx bx-download me-1"></i>
                                {{ $t("question_json.import.download_example") }}
                            </a-button>
                        </div>
                        <input
                            @change="handleJsonFileChange"
                            class="d-none"
                            type="file"
                            ref="jsonFileInput"
                            accept=".json,.txt,application/json,text/plain"
                        />
                        <div
                            :class="['json-input-area', isDragging ? 'is-dragging' : '']"
                            @dragenter="handleDragEnter"
                            @dragover.prevent="isDragging = true"
                            @dragleave="isDragging = false"
                            @drop.prevent="handleJsonDrop"
                        >
                            <a-textarea
                                v-model:value="jsonText"
                                class="json-textarea"
                                spellcheck="false"
                                :rows="14"
                                :placeholder="$t('question_json.import.placeholder')"
                            />
                        </div>
                        <div class="json-hint">{{ $t("question_json.import.hint") }}</div>
                        <div class="json-actions">
                            <a-button @click="jsonFileInput?.click()">
                                <i class="bx bx-file me-1"></i>
                                {{ $t("question_json.import.choose_file") }}
                            </a-button>
                            <a-button
                                type="primary"
                                class="main-color-btn"
                                :loading="checkingJson"
                                @click="onCheckJson"
                            >
                                {{ $t("question_json.import.check") }}
                            </a-button>
                        </div>
                    </template>
                    <div v-if="source === 'excel'" class="section-content">
                        <input
                            @change="handleFileChange"
                            class="d-none"
                            type="file"
                            ref="fileInput"
                            accept=".xls,.xlsx"
                        />
                        <div
                            :class="['customized-file-upload', isDragging ? 'is-dragging' : '']"
                            @click="openFileExplorer"
                            @dragenter="handleDragEnter"
                            @dragover.prevent="isDragging = true"
                            @dragleave="isDragging = false"
                            @drop.prevent="handleDrop"
                        >
                            <div class="customized-file-upload-icons">
                                <i
                                    :class="[
                                        'bx',
                                        'bx-down-arrow-alt',
                                        'bx-fade-up',
                                        !isDragging ? 'd-none' : '',
                                    ]"
                                ></i>
                                <InboxOutlined :class="[isDragging ? 'd-none' : '']" />
                            </div>
                            <div class="customized-file-upload-ins">
                                {{ $t("import_qs_modal.upload_area.title") }}
                            </div>
                            <div class="customized-file-upload-hint">
                                {{ $t("import_qs_modal.upload_area.content") }}
                                <br />
                                {{ $t("import_qs_modal.upload_area.sub_content") }}
                            </div>
                        </div>
                    </div>
                    <div v-if="source === 'excel'" class="file-container">
                        <div class="file-item" v-for="(file, index) in files">
                            <span>{{ file.name }}</span>
                            <i
                                class="bx bx-trash text-danger"
                                @click="onRemoveUploadedFile(index)"
                            ></i>
                        </div>
                    </div>
                </div>
                <div class="content-item-section preview-section">
                    <div class="section-title">{{ $t("import_qs_modal.preview_section") }}</div>
                    <div class="section-content">
                        <div v-if="question_data.length > 0" class="section-content-header">
                            <a-checkbox
                                :class="[
                                    'header-item',
                                    importModalState.checkAll ? 'check-all' : '',
                                ]"
                                @click="onCheckAll"
                                v-model:checked="importModalState.checkAll"
                                :indeterminate="importModalState.indeterminate"
                            >
                                {{
                                    $t("share_modal.buttons.check_all", {
                                        number: importModalState.checkedList.length,
                                    })
                                }}
                            </a-checkbox>

                            <div class="d-flex">
                                <a-select
                                    size="large"
                                    class="me-3"
                                    v-model:value="selected_option"
                                    style="width: 200px"
                                    @change="onFilter"
                                >
                                    <a-select-option
                                        v-for="option in select_options"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </a-select-option>
                                </a-select>
                            </div>
                        </div>
                        <a-checkbox-group v-model:value="importModalState.checkedList">
                            <div class="preview-question-container">
                                <div
                                    :class="[
                                        'preview-question-item',
                                        uploadedInvalidQuestions?.includes(question)
                                            ? 'invalid'
                                            : '',
                                    ]"
                                    v-for="(question, index) in uploadedQuestions"
                                >
                                    <a-checkbox :value="question"></a-checkbox>
                                    <div class="question-item-content">
                                        <div v-if="question.index" class="question-item-index">
                                            {{ $t("question_json.import.question_index", { index: question.index }) }}
                                        </div>
                                        <RichContent
                                            class="question-html"
                                            :content="question.questionHTML || question.questionText"
                                            :format="question.textFormat || 'PlainText'"
                                        />
                                        <div
                                            class="question-item-answer"
                                            :id="`question-item-answer-${index}`"
                                        >
                                            <template
                                                v-if="
                                                    question.type === QUESTION_TYPE.MULTIPLE_CHOICE
                                                "
                                            >
                                                <div class="multiple-choice-answer">
                                                    <ul>
                                                        <li
                                                            v-for="option in question.multipleChoices"
                                                        >
                                                            <RichContent
                                                                :content="option.text"
                                                                :format="question.textFormat || 'PlainText'"
                                                                inline
                                                            />
                                                            <span
                                                                class="result-correct"
                                                                v-if="option.isAnswer"
                                                            >
                                                                ({{ option.isAnswer }})
                                                            </span>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </template>
                                            <template
                                                v-if="question.type === QUESTION_TYPE.MATCHING"
                                            >
                                                <div
                                                    class="pair-answer"
                                                    v-for="option in question.matchingPairs"
                                                >
                                                    <span class="pair-answer-item">
                                                        <RichContent
                                                            :content="option.leftItem"
                                                            :format="question.textFormat || 'PlainText'"
                                                            inline
                                                        />
                                                    </span>
                                                    <i class="bx bx-right-arrow-alt"></i>
                                                    <span class="pair-answer-item">
                                                        <RichContent
                                                            :content="option.rightItem"
                                                            :format="question.textFormat || 'PlainText'"
                                                            inline
                                                        />
                                                    </span>
                                                </div>
                                            </template>
                                            <template
                                                v-if="question.type === QUESTION_TYPE.ORDERING"
                                            >
                                                <div class="ordering-answer">
                                                    <div class="ordering-answer-item">
                                                        <div
                                                            v-for="option in question.orderingItems"
                                                        >
                                                            <RichContent
                                                                :content="option.text"
                                                                :format="question.textFormat || 'PlainText'"
                                                                inline
                                                            />
                                                        </div>
                                                    </div>
                                                    <i class="bx bx-right-arrow-alt"></i>
                                                    <div class="ordering-answer-item">
                                                        <div
                                                            class="ordering-answer-item"
                                                            v-for="(
                                                                option, index
                                                            ) in question.orderingItems"
                                                        >
                                                            <span>#{{ index + 1 }}</span> -
                                                            <RichContent
                                                                :content="option.text"
                                                                :format="question.textFormat || 'PlainText'"
                                                                inline
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </template>
                                            <template
                                                v-if="question.type === QUESTION_TYPE.SHORT_TEXT"
                                            >
                                                <div class="short-text-answer">
                                                    <RichContent
                                                        :content="question.shortAnswer"
                                                        :format="question.textFormat || 'PlainText'"
                                                        inline
                                                    />
                                                </div>
                                            </template>
                                        </div>
                                        <ul
                                            v-if="question.errors?.length || question.warnings?.length"
                                            class="question-item-issues"
                                        >
                                            <li v-for="error in question.errors" class="issue-error">
                                                <i class="bx bx-error-circle"></i> {{ error }}
                                            </li>
                                            <li v-for="warning in question.warnings" class="issue-warning">
                                                <i class="bx bx-info-circle"></i> {{ warning }}
                                            </li>
                                        </ul>
                                    </div>
                                    <div class="question-item-toogle-btn">
                                        <i
                                            class="bx bx-chevron-up"
                                            @click="
                                                toggleDisplayAnswer(index, $event.currentTarget!)
                                            "
                                        ></i>
                                    </div>
                                </div>
                            </div>
                        </a-checkbox-group>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="mt-4 d-flex align-items-center">
                <div class="header-item">
                    {{
                        $t("import_qs_modal.other.total_question", {
                            number: importModalState.checkedList.length,
                        })
                    }}
                </div>
                <a-button
                    class="main-color-btn"
                    size="large"
                    key="submit"
                    type="primary"
                    @click="handleModalImport"
                >
                    {{ $t("import_qs_modal.buttons.import") }}
                </a-button>
            </div>
        </template>
    </a-modal>
    <QuestionJsonPromptModal ref="promptModalRef" :topic="props.title" />
</template>
<style>
.import-source-switch {
    display: flex;
    margin-bottom: 16px;
}
.import-source-switch .ant-radio-button-wrapper {
    flex: 1;
    height: 40px;
    line-height: 38px;
    text-align: center;
    font-weight: 600;
}
.import-source-switch .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked) {
    color: var(--c-text);
    background-color: var(--c-surface);
    border-color: var(--c-border-strong);
}
.import-source-switch .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled),
.import-source-switch .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled):hover {
    color: var(--text-color-contrast);
    background-color: var(--main-color);
    border-color: var(--main-color);
}
.import-source-switch .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled)::before {
    background-color: var(--main-color);
}
.import-source-switch .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked):hover {
    color: var(--main-color);
}
.json-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
}
.json-input-area {
    border-radius: var(--ui-r-sm);
}
.json-textarea.ant-input {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
}
.json-hint {
    margin: 6px 0 10px;
    font-size: 12px;
    color: var(--text-color-grey);
}
.question-item-index {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-grey);
}
.question-item-issues {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    font-size: 13px;
}
.question-item-issues li {
    display: flex;
    gap: 6px;
    align-items: baseline;
}
.question-item-issues .issue-error {
    color: var(--c-danger-text);
}
.question-item-issues .issue-warning {
    color: var(--c-warning-text);
}
</style>

<style scoped>
.modal-title-container {
    margin-bottom: 16px;
}
.modal-title-container .main-title span:nth-child(1) {
    font-size: 20px;
    font-weight: 700;
}
.modal-title-container .main-title span:nth-child(3) {
    font-size: 14px;
    font-weight: 400;
}
.modal-content-item {
    gap: 16px;
    padding: 0;
    background-color: transparent;
    border: none;
}
.content-item-section {
    padding: 20px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}
.section-title {
    margin-bottom: 12px;
    align-items: center;
    font-size: 18px;
    font-weight: 700;
}
.section-content {
    padding: 0;
    border: none;
    border-radius: var(--ui-r-lg);
}
.preview-section .section-content {
    padding: 0 12px 4px;
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    box-shadow: none;
}
.section-content-header {
    padding: 12px 0;
    background-color: var(--c-surface);
}
.header-item {
    height: 40px;
    margin-right: 10px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 600;
    background-color: var(--c-surface);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--ui-r-md);
}
.header-item.check-all {
    background-color: var(--main-color);
    border-color: var(--main-color);
    color: var(--text-color-contrast);
}

/* khung kéo thả tệp */
.customized-file-upload {
    padding: 24px 16px;
    background-color: var(--c-surface);
    border: 1px dashed var(--c-border-strong);
    border-radius: var(--ui-r-lg);
    transition:
        background-color 0.15s,
        border-color 0.15s;
}
.customized-file-upload:hover,
.customized-file-upload.is-dragging {
    background-color: color-mix(in srgb, var(--main-color) 10%, var(--c-surface));
    border-color: var(--main-color);
}
.customized-file-upload-ins {
    margin-bottom: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--c-text);
    text-align: center;
}
.customized-file-upload-hint {
    font-size: 13px;
    color: var(--c-text-muted);
}
.json-input-area.is-dragging {
    background-color: transparent;
    outline: 2px dashed var(--main-color);
    outline-offset: 2px;
}
.file-container {
    margin: 12px 0 0;
}
.file-item {
    padding: 6px 10px;
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}

/* hàng câu hỏi xem trước */
.preview-question-item {
    margin: 0 0 10px;
    padding: 10px;
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    transition:
        background-color 0.15s,
        border-color 0.15s;
}
.preview-question-item:hover {
    border-color: var(--main-color);
}
.preview-question-item:has(.ant-checkbox-wrapper-checked) {
    background-color: color-mix(in srgb, var(--main-color) 8%, var(--c-surface));
    border-color: var(--main-color);
}
.preview-question-item.invalid,
.preview-question-item.invalid:hover,
.preview-question-item.invalid:has(.ant-checkbox-wrapper-checked) {
    border-color: var(--c-danger);
}
.preview-question-item.invalid {
    background-color: color-mix(in srgb, var(--c-danger) 6%, var(--c-surface));
}
.question-item-toogle-btn i {
    width: 32px;
    height: 32px;
    align-items: center;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--ui-r-sm);
}
.pair-answer-item {
    padding: 6px 10px;
    background-color: var(--c-surface-subtle);
    border-color: var(--content-item-border-color);
    border-radius: var(--ui-r-sm);
}
.json-actions {
    margin-bottom: 12px;
}
.json-hint {
    margin: 8px 0 12px;
}
@media (max-width: 767.98px) {
    .content-item-section {
        padding: 14px;
    }
}
</style>
