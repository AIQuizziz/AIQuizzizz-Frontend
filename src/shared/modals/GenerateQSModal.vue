<script setup lang="ts">
import type { RequestQuestion } from "@/models/request/question";

import QUESTION_TYPE, { CLASSIC_QUESTION_TYPES } from "@/constants/questionTypes";
import QUESTION_DIFFICULTY from "@/constants/questiondifficulties";
import SUPPORTED_LOCALES from "@/constants/languages";

import { ref, reactive, watch, onMounted, nextTick, h } from "vue";
import { Modal, message } from "ant-design-vue";
import { InboxOutlined, LoadingOutlined, ExclamationCircleFilled } from "@ant-design/icons-vue";

import TextArea from "../components/Common/TextArea.vue";
import RichContent from "../components/Common/RichContent.vue";

import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

const { t } = useI18n();

//#region modal
interface Props {
    title: string;
    numberOfQuestion: number;
}

const props = defineProps<Props>();

const emit = defineEmits<(e: "import", selected: RequestQuestion[]) => void>();

const modal_generate_ai_open = ref(false);
const openGenerateAIModal = () => {
    generateModalState.checkedList = []; //reset checked list
    modal_generate_ai_open.value = true;
};

const closeGenerateAIModal = () => {
    modal_generate_ai_open.value = false;
};

//expose functions to main ref
defineExpose({
    openGenerateAIModal,
});

const handleModalImport = () => {
    if (generateModalState.checkedList.length === 0) {
        message.warning(
            t("message.minimum_question", {
                number: 1,
            }),
        );
        return;
    }
    if (generateModalState.checkedList.length + props.numberOfQuestion > 500) {
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
            number: generateModalState.checkedList.length,
        }),
        okText: t("create_QS.buttons.ok"),
        cancelText: t("create_QS.buttons.cancel"),
        onOk: () => {
            const selectedQuestions = generatedQuestions.value.filter((question) =>
                generateModalState.checkedList.includes(question),
            ) as RequestQuestion[];

            //emit event & params to main
            emit("import", selectedQuestions);
            closeGenerateAIModal();
        },
    });
};
//#endregion

//#region init data
const questionTypeOptions = CLASSIC_QUESTION_TYPES.map((questionType) => ({
    label: t(`create_QS.type.${questionType}`),
    value: questionType,
}));

const questionDifficultyOptions = Object.values(QUESTION_DIFFICULTY).map((difficulty) => ({
    label: difficulty,
    value: difficulty,
}));

const questionMaximumOptions = ref<any>([]);
for (let i = 10; i <= 50; i += 10) {
    questionMaximumOptions.value.push({ label: i, value: i });
}
//#endregion

//#region form state
const generatedQuestions = ref<RequestQuestion[]>([]);

const generateModalState = reactive({
    checkAll: false,
    indeterminate: false,
    checkedList: [] as RequestQuestion[],
});

const generateByAIModalState = reactive({
    file: null as File | null,
    isGenerateExplain: true,
    language: SUPPORTED_LOCALES[0].code,
    questionCount: questionMaximumOptions.value[0].value,
    questionTypes: [questionTypeOptions[0].value],
    // difficulty: questionDifficultyOptions[0].value,
    documentStructureJson: null as string | null,
    selectedPartJson: null as string | null,
    title: "",
});

const onDeselectQuestionType = (value: any) => {
    if (generateByAIModalState.questionTypes.length === 0) {
        message.warning(t("message.minimun_question_type"));

        //keep the item
        generateByAIModalState.questionTypes.push(value);
    }
};

const loading = ref(false);
const indicator = h(LoadingOutlined, {
    style: { fontSize: "100px", color: "var(--main-color)" },
    spin: true,
});

const onGenerateQuestions = async () => {
    try {
        loading.value = true;
        if (!generateByAIModalState.title && generateByAIModalState.isGenerateExplain) {
            message.error(t("message.invalid_reference"));
            return;
        }
        if (
            generateByAIModalState.documentStructureJson === null
            //  || generateByAIModalState.selectedPartJson === null
        ) {
            Modal.error({
                title: t("generate_qs_modal.invalid_structure_modal.title"),
                content: t("generate_qs_modal.invalid_structure_modal.content"),
                centered: true,
            });
            openFileStructureModal();
            return;
        }

        const object_document_structure = JSON.parse(generateByAIModalState.documentStructureJson);
        const object_selected_part = JSON.parse(generateByAIModalState.selectedPartJson || "{}");

        if (generateByAIModalState.isGenerateExplain && generateByAIModalState.title) {
            generateByAIModalState.documentStructureJson = JSON.stringify({
                ...object_document_structure,
                title: generateByAIModalState.title,
            });

            generateByAIModalState.selectedPartJson = JSON.stringify({
                ...object_selected_part,
                title: generateByAIModalState.title,
            });
        }

        const formData = new FormData();
        formData.append("file", files.value[0] as File);
        formData.append(
            "isGenerateExplain",
            generateByAIModalState.isGenerateExplain ? "true" : "false",
        );

        formData.append(
            "language",
            SUPPORTED_LOCALES.find((x) => x.code === generateByAIModalState.language)?.label ||
                SUPPORTED_LOCALES[0].label,
        );

        formData.append("questionCount", generateByAIModalState.questionCount);
        formData.append(
            "questionTypes",
            JSON.stringify(generateByAIModalState.questionTypes.map((x) => x)),
        );

        formData.append("documentStructureJson", generateByAIModalState.documentStructureJson);
        formData.append("selectedPartJson", generateByAIModalState.selectedPartJson || "");

        const result = await ApiAIGenerate.GenerateQuestion(formData);
        if (!result.data.success) {
            message.error("Generate failed!");
            return;
        }

        generatedQuestions.value = [
            ...(generatedQuestions.value || []),
            ...(result.data.data.map((x: any) => ({
                ...x,
                questionId: dayjs().valueOf(),
            })) as RequestQuestion[]),
        ];

        await nextTick();
        generateModalState.checkedList = [];
        generateModalState.indeterminate = false;
        generateModalState.checkAll = false;
    } catch (error) {
        console.log(error);
    } finally {
        loading.value = false;
        modal_confirm_generate_question_open.value = false;
    }
};
//#endregion

//#region cost

const modal_confirm_generate_question_open = ref(false);
const cost = ref<Cost | null>(null);
const getCostToGenerateQuestion = async () => {
    if (cost.value) {
        modal_confirm_generate_question_open.value = true;
        return;
    }
    try {
        loading.value = true;
        const result = await ApiAIGenerate.GetCostToGenerate(files.value[0]);
        if (!result.data.success) {
            Modal.error({
                title: "Error",
                content: result.data.message || t("message.failed_to_get_cost"),
            });
            return null;
        }
        const costResult = result.data.data as Cost;

        if (!costResult) {
            message.error(t("message.failed_to_get_cost"));
            return;
        }

        cost.value = costResult;
        modal_confirm_generate_question_open.value = true;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        loading.value = false;
    }
};

//#endregion

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
        if (file.type !== "application/pdf") {
            message.error(t("message.file_support_only", { fileTypes: "PDF" }));
            return;
        }
        files.value = [];
        generateByAIModalState.documentStructureJson = null;
        generateByAIModalState.selectedPartJson = null;

        // chỉ coi file là đã tải lên sau khi server chấp nhận (đọc được cấu trúc PDF)
        let accepted = false;
        try {
            loading.value = true;
            accepted = !!(await generateFileStructureRef.value?.loadStructure(file));
        } finally {
            loading.value = false;
        }
        if (!accepted) {
            // file lỗi (400 INVALID_FILE_FORMAT...): toast lỗi đã hiển thị ở interceptor, không giữ file
            generateFileStructureRef.value?.clearData();
            return;
        }

        message.success(t("message.uploaded_successfully", { name: file.name }));
        files.value.push(file);

        //get string before dot
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        generateByAIModalState.title = fileNameWithoutExt;

        await nextTick(); //to bind data in modal
        openFileStructureModal();
        return;
    }
    message.error(t("message.uploaded_failed"));
};

const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        onFileChange(file);
        target.value = "";
        cost.value = null;
    }
};

const handleDragEnter = (event: DragEvent) => {
    const types = event.dataTransfer?.types || [];
    if (Array.from(types).includes("files")) {
        isDragging.value = true;
    }
};

const handleDrop = async (event: DragEvent) => {
    const file = event.dataTransfer?.files[0];
    isDragging.value = false;

    if (file) {
        onFileChange(file);
        cost.value = null;
    }
};

const onRemoveUploadedFile = () => {
    Modal.confirm({
        title: t("generate_qs_modal.confirm_delete_file_modal.title"),
        content: t("generate_qs_modal.confirm_delete_file_modal.content"),
        onOk: () => {
            files.value = [];
            generateFileStructureRef.value?.clearData();
            generateByAIModalState.documentStructureJson = null;
            generateByAIModalState.selectedPartJson = null;
        },
    });
};

//#endregion

//#region check all
//checkboxes  / checkbox-all for importing question back to the page
const onCheckAll = (event: any) => {
    Object.assign(generateModalState, {
        checkedList: event.target.checked ? generatedQuestions.value : [],
        indeterminate: false,
    });
};

watch(
    () => generateModalState.checkedList,
    (val) => {
        generateModalState.indeterminate =
            !!val.length && val.length < generatedQuestions.value.length; //change to uploadedList when it done
        generateModalState.checkAll =
            val.length > 0 && val.length === generatedQuestions.value.length;
    },
);

//preview uploaded content
const toggleDisplayAnswer = (index: number, button: EventTarget) => {
    let $button = $(button);

    $button.toggleClass("bx-chevron-up bx-chevron-down");

    const answer = $(`#question-item-answer-${index}`);
    if (answer) $(answer).slideToggle();
};
//#endregion

//#region generate file structure
import GenerateFileStructure from "./GenerateFileStructure.vue";
import ApiAIGenerate from "@/api/ApiAIGenerate";
import type Cost from "@/models/response/question_set/cost";
const generateFileStructureRef = ref<InstanceType<typeof GenerateFileStructure> | null>(null);

const openFileStructureModal = () => {
    if (generateFileStructureRef.value) {
        generateFileStructureRef.value.openModal();
    }
};

const handleImportStructure = (document_structure: string, selected_structure: string) => {
    generateByAIModalState.documentStructureJson = document_structure;
    generateByAIModalState.selectedPartJson = selected_structure;
};

//#endregion
onMounted(() => {});
</script>

<template>
    <a-modal
        centered
        width="100%"
        :closable="false"
        wrap-class-name="full-modal"
        :open="modal_generate_ai_open"
        @cancel="closeGenerateAIModal"
    >
        <a-spin :spinning="loading" size="large" :indicator="indicator">
            <div class="modal-container">
                <div class="modal-title-container">
                    <a-row class="w-100 d-flex align-items-center">
                        <a-col :span="1">
                            <RouterLink @click="closeGenerateAIModal" :to="{ name: '' }">
                                <i class="bx bx-chevron-left navigator-back-button"></i>
                            </RouterLink>
                        </a-col>
                        <a-col class="main-title" :span="23">
                            <span> {{ $t("generate_qs_modal.title") }}</span> <br />
                            <span>
                                {{ $t("generate_qs_modal.sub_title") }}
                            </span>
                        </a-col>
                    </a-row>
                </div>
                <div class="modal-content-item">
                    <div class="content-item-section upload-section">
                        <div class="section-title">
                            <span>{{ $t("import_qs_modal.upload_section") }}</span>
                        </div>
                        <div v-if="!files.length" class="section-content mb-2">
                            <input
                                @change="handleFileChange"
                                class="d-none"
                                type="file"
                                ref="fileInput"
                                accept=".pdf"
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
                                    {{ $t("generate_qs_modal.other.upload_hint") }}
                                    <br />
                                    {{ $t("import_qs_modal.upload_area.sub_content") }}
                                </div>
                            </div>
                        </div>
                        <div v-if="files.length" class="file-container">
                            <div class="file-item" v-for="file in files">
                                <div>{{ file.name }}</div>
                                <i
                                    class="bx bx-trash text-danger"
                                    @click="onRemoveUploadedFile()"
                                ></i>
                            </div>
                            <div
                                :class="[
                                    'file-structure',
                                    generateByAIModalState.documentStructureJson
                                        ? 'answer-correct result-correct '
                                        : 'answer-incorrect result-incorrect ',
                                ]"
                                @click="openFileStructureModal"
                            >
                                <i class="bx bx-file"></i>
                                <div>{{ $t("generate_qs_modal.form.structure") }}</div>
                            </div>
                        </div>
                        <a-form layout="vertical" class="generate-ai-form">
                            <a-row class="d-flex justify-content-between">
                                <a-col :span="12">
                                    <a-form-item l :label="t('generate_qs_modal.form.language')">
                                        <a-select
                                            class="language-select"
                                            v-model:value="generateByAIModalState.language"
                                        >
                                            <a-select-option
                                                v-for="locale in SUPPORTED_LOCALES"
                                                :key="`locale-${locale.code}`"
                                                :value="locale.code"
                                            >
                                                {{ locale.label }}
                                            </a-select-option>
                                        </a-select>
                                    </a-form-item>
                                </a-col>
                                <a-col :span="11">
                                    <a-form-item
                                        :label="t('generate_qs_modal.form.maximum_question')"
                                    >
                                        <a-select
                                            v-model:value="generateByAIModalState.questionCount"
                                            style="width: 100%"
                                            :placeholder="'Maximum number of question'"
                                            :options="questionMaximumOptions"
                                        />
                                    </a-form-item>
                                </a-col>
                            </a-row>

                            <a-form-item :label="t('generate_qs_modal.form.question_types')">
                                <a-select
                                    @deselect="onDeselectQuestionType"
                                    v-model:value="generateByAIModalState.questionTypes"
                                    mode="multiple"
                                    style="width: 100%"
                                    :placeholder="'Select multiple'"
                                    :options="questionTypeOptions"
                                />
                            </a-form-item>
                            <a-row class="d-flex justify-content-between">
                                <a-col :span="7">
                                    <a-form-item
                                        :label="t('generate_qs_modal.form.enable_explaination')"
                                    >
                                        <a-switch
                                            v-model:checked="
                                                generateByAIModalState.isGenerateExplain
                                            "
                                        />
                                    </a-form-item>
                                </a-col>
                                <a-col v-if="generateByAIModalState.isGenerateExplain" :span="16">
                                    <a-form-item
                                        :label="t('generate_qs_modal.form.reference_name')"
                                    >
                                        <TextArea
                                            v-model="generateByAIModalState.title"
                                            :is-required="generateByAIModalState.isGenerateExplain"
                                            :max-length="200"
                                            :placeholder="
                                                t(
                                                    'generate_qs_modal.form.reference_name_placeholder',
                                                )
                                            "
                                            :readonly="!generateByAIModalState.isGenerateExplain"
                                        />
                                    </a-form-item>
                                </a-col>
                            </a-row>

                            <a-form-item style="margin-top: 7px" class="generate-ai-btn-container">
                                <a-button
                                    :loading="loading"
                                    size="large"
                                    :class="[
                                        'w-100 main-color-btn generate_ai',
                                        !generateByAIModalState.documentStructureJson
                                            ? 'main-color-btn-disabled'
                                            : '',
                                    ]"
                                    type="primary"
                                    @click="getCostToGenerateQuestion"
                                >
                                    {{ $t("generate_qs_modal.buttons.generate") }}
                                </a-button>
                            </a-form-item>
                        </a-form>
                    </div>
                    <div class="content-item-section preview-section">
                        <div class="section-title">{{ $t("import_qs_modal.preview_section") }}</div>
                        <div class="section-content">
                            <div
                                v-if="generatedQuestions.length > 0"
                                class="section-content-header"
                            >
                                <a-checkbox
                                    :class="[
                                        'header-item',
                                        generateModalState.checkAll ? 'check-all' : '',
                                    ]"
                                    @click="onCheckAll"
                                    v-model:checked="generateModalState.checkAll"
                                    :indeterminate="generateModalState.indeterminate"
                                >
                                    {{
                                        $t("share_modal.buttons.check_all", {
                                            number: generateModalState.checkedList.length,
                                        })
                                    }}
                                </a-checkbox>

                                <div class="header-item">
                                    {{
                                        $t("import_qs_modal.other.total_question", {
                                            number: generatedQuestions.length,
                                        })
                                    }}
                                </div>
                            </div>
                            <a-checkbox-group v-model:value="generateModalState.checkedList">
                                <div class="preview-question-container">
                                    <div
                                        class="preview-question-item"
                                        v-for="(question, index) in generatedQuestions"
                                    >
                                        <a-checkbox :value="question"></a-checkbox>
                                        <div class="question-item-content">
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
                                                        question.type ===
                                                        QUESTION_TYPE.MULTIPLE_CHOICE
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
                                                                <span>#{{ index + 1 }}</span>
                                                                -
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
                                                    v-if="
                                                        question.type === QUESTION_TYPE.SHORT_TEXT
                                                    "
                                                >
                                                    <span>Answer:</span>
                                                    <div class="short-text-answer">
                                                        <RichContent
                                                            :content="question.shortAnswer"
                                                            :format="question.textFormat || 'PlainText'"
                                                            inline
                                                        />
                                                    </div>
                                                </template>
                                            </div>
                                        </div>
                                        <div class="question-item-toogle-btn">
                                            <i
                                                class="bx bx-chevron-up"
                                                @click="
                                                    toggleDisplayAnswer(
                                                        index,
                                                        $event.currentTarget!,
                                                    )
                                                "
                                            ></i>
                                        </div>
                                    </div>
                                </div>
                            </a-checkbox-group>
                        </div>
                        <div class="modal-generate-by-ai-warning">
                            <span>
                                <i class="bx bx-info-circle"></i>
                                {{ $t("generate_qs_modal.other.ai_warning") }}
                            </span>
                        </div>
                        <div class="w-100 d-flex justify-content-end">
                            <a-button
                                class="main-color-btn"
                                key="submit"
                                type="primary"
                                size="large"
                                @click="handleModalImport"
                            >
                                {{ $t("import_qs_modal.buttons.import") }}
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>
        </a-spin>
        <template #footer></template>
    </a-modal>

    <a-modal
        wrap-class-name="medium-modal"
        centered
        :open="modal_confirm_generate_question_open"
        :closable="false"
    >
        <div class="confirm-modal-container">
            <div class="d-flex align-items-center">
                <ExclamationCircleFilled class="fs-4 me-3 text-warning" />
                <div class="fs-6 fw-bold">
                    {{ $t("generate_qs_modal.confirm_modal.title") }}
                </div>
            </div>
            <div class="fs-6 ms-5 mt-3">
                {{ $t("generate_file_structure.confirm_modal.content") }}
                <span class="fw-bold text-danger">{{ cost?.miniumPointToGenerate }}</span>
                {{ $t("generate_file_structure.confirm_modal.content_tail") }}
            </div>
        </div>
        <template #footer>
            <a-button
                :class="['main-color-btn-ghost', loading ? 'main-color-btn-disabled' : '']"
                type="ghost"
                @click="modal_confirm_generate_question_open = false"
            >
                {{ $t("sidebar.buttons.cancel") }}
            </a-button>
            <a-button
                :loading="loading"
                class="main-color-btn"
                type="primary"
                @click="onGenerateQuestions"
            >
                {{ $t("generate_file_structure.buttons.confirm") }}
            </a-button>
        </template>
    </a-modal>

    <GenerateFileStructure
        :file="files[0]"
        ref="generateFileStructureRef"
        @import="handleImportStructure"
    />
</template>
<style>
.ant-spin-nested-loading .ant-spin {
    max-width: 100% !important;
}
.ant-spin-nested-loading > div > .ant-spin {
    max-height: 100% !important;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ant-spin-nested-loading > div > .ant-spin .ant-spin-dot {
    inset-inline-start: auto !important;
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

.main-color-btn.generate_ai {
    display: block;
    box-shadow: none;
}
:deep(.ant-select-multiple .ant-select-selection-item) {
    border-radius: var(--ui-r-xs);
}
.preview-section .section-content {
    height: 550px;
    max-height: 550px;
    max-width: 1000px;
    overflow-x: auto;
}

::v-deep(.ant-form-item-control-input-content textarea) {
    height: 95px;
    resize: none;
}
.generate-modal-info {
    color: var(--c-primary-text) !important;
}

.file-structure {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100px;
    width: 100px;
    padding: 10px;
    border: 1px solid;
    border-radius: var(--ui-r-lg);
    /* color: var(--main-color); */
    font-weight: 500;
    transition: all 0.2s ease-in-out;
    cursor: pointer;
}

.file-structure i {
    font-size: 50px;
}

.file-structure:hover {
    background-color: var(--main-color);
    border-color: var(--main-color);
    color: var(--text-color-contrast);
}
.loading-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: absolute;
}

.question-text {
    text-wrap: wrap;
    margin-bottom: 10px;
}
@media (max-width: 767.98px) {
    .content-item-section {
        padding: 14px;
    }
}
</style>
