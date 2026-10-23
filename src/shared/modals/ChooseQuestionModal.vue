<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";

import type { Folder } from "@/models/response/folder/folder";
import type { ResponseQuestion } from "@/models/response/question";

import QUESTION_TYPE, { CLASSIC_QUESTION_TYPES } from "@/constants/questionTypes";

import { ref, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import { Modal } from "ant-design-vue";
import Input from "@/shared/components/Common/Input.vue";
import QuestionMediaView from "@/shared/components/Media/QuestionMediaView.vue";
import RichContent from "@/shared/components/Common/RichContent.vue";
import { mergeQuestionMedia } from "@/services/QuestionMediaService";

const route = useRoute();

const { t } = useI18n();

interface Props {
    questionSetId: string;
    folder: Folder | null;
}

const props = defineProps<Props>();

// toàn bộ câu của bộ câu hỏi (question_data là danh sách sau khi lọc)
const all_questions = ref<ResponseQuestion[]>([]);
const question_data = ref<ResponseQuestion[]>([]);
const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;
        if (!props.questionSetId) return;
        let result = await ApiQuestionSet.GetQuestionById(props.questionSetId);
        if (result.data.success) {
            // chỉ các loại câu dùng được trong bài kiểm tra (không có thẻ ghi nhớ)
            const questions = (result.data.data as ResponseQuestion[]).filter((q) =>
                (CLASSIC_QUESTION_TYPES as string[]).includes(q.type),
            );
            all_questions.value = questions;
            question_data.value = questions;
        }
    } catch (error) {
        console.log("ERROR: GET questions of question set: " + error);
    } finally {
        loading.value = false;
    }
};

// presigned URL của media hết hạn -> lấy URL mới, chỉ cập nhật media (giữ lựa chọn/bộ lọc hiện tại)
const reloadQuestionMedia = async () => {
    try {
        if (!props.questionSetId) return;
        const result = await ApiQuestionSet.GetQuestionById(props.questionSetId);
        if (result?.data?.success) {
            mergeQuestionMedia([...all_questions.value, ...question_data.value], result.data.data);
        }
    } catch (error) {
        console.log("ERROR: reload question media", error);
    }
};

//#region filter
const questionTypeOptions = CLASSIC_QUESTION_TYPES.map((questionType) => ({
    label: t(`create_QS.type.${questionType}`),
    value: questionType,
}));

const selectedQuestionTypes = ref([...questionTypeOptions.map((x) => x.value)]);
const searchValue = ref("");

const onFilter = () => {
    importModalState.checkedList = [];
    importModalState.checkAll = false;
    importModalState.indeterminate = false;
    let filtered = all_questions.value;
    const search = searchValue.value.trim().toLowerCase();

    filtered = all_questions.value.filter((x) => {
        const matchesSearch = !search || x.questionText.toLowerCase().includes(search);

        const matchesType =
            !selectedQuestionTypes.value.length || selectedQuestionTypes.value.includes(x.type);

        return matchesSearch && matchesType;
    }) as ResponseQuestion[];

    question_data.value = filtered;
};

//#endregion

//#region check all
const importModalState = reactive({
    checkAll: false,
    indeterminate: false,
    checkedList: [] as ResponseQuestion[],
});

// @change của a-checkbox: event.target.checked là trạng thái của chính checkbox (click vào label/span vẫn đúng)
const onCheckAll = (event: any) => {
    const checked = !!event?.target?.checked;
    Object.assign(importModalState, {
        checkAll: checked,
        checkedList: checked ? [...(question_data.value ?? [])] : [],
        indeterminate: false,
    });
};

watch(
    () => importModalState.checkedList,
    (val) => {
        const total = question_data.value?.length ?? 0;
        importModalState.indeterminate = !!val.length && val.length < total;
        // rỗng thì KHÔNG được coi là "đã chọn hết"
        importModalState.checkAll = val.length > 0 && val.length === total;
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

//#region modal
const emit = defineEmits<{
    (e: "import", selected: ResponseQuestion[]): void;
    (e: "backToFolderQuestionSetModal", folder: Folder): void;
    (e: "backToQuestionSetModal"): void;
}>();
const modal_open = ref(false);

const openModal = async () => {
    //reset
    importModalState.checkAll = false;
    importModalState.checkedList = [];
    importModalState.indeterminate = false;

    modal_open.value = true;
    await getData();
};

const closeModal = () => {
    modal_open.value = false;
    if (props.folder !== null) {
        emit("backToFolderQuestionSetModal", props.folder);
    } else {
        emit("backToQuestionSetModal");
    }
};

//expose functions to main ref
defineExpose({
    openModal,
    closeModal,
});

const handleModalImport = () => {
    // không cho import khi chưa chọn câu hỏi nào
    if (importModalState.checkedList.length === 0) return;

    Modal.confirm({
        title: t("create_test_modals.import_confirm_title"),
        content: t("create_test_modals.import_confirm_content", {
            number: importModalState.checkedList.length,
        }),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: () => {
            const selectedQuestions = question_data.value?.filter((question) =>
                importModalState.checkedList.includes(question),
            ) as ResponseQuestion[];

            //emit event & params to main
            emit("import", selectedQuestions);
            modal_open.value = false;
        },
    });
};
//#endregion
</script>
<template>
    <a-modal
        centered
        width="100%"
        wrap-class-name="medium-modal large"
        :open="modal_open"
        @cancel="closeModal"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="1">
                        <RouterLink @click="closeModal" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="22">
                        <span>{{ $t("create_test_modals.choose_question") }}</span>
                    </a-col>
                </a-row>
            </div>
            <div class="modal-content-item">
                <div class="content-item-section preview-section">
                    <div class="section-content">
                        <div class="section-content-header" v-if="question_data.length > 0">
                            <a-checkbox
                                :class="[
                                    'header-item',
                                    importModalState.checkAll ? 'check-all' : '',
                                ]"
                                :checked="importModalState.checkAll"
                                @change="onCheckAll"
                                :indeterminate="importModalState.indeterminate"
                            >
                                {{
                                    $t("share_modal.buttons.check_all", {
                                        number: importModalState.checkedList.length,
                                    })
                                }}
                            </a-checkbox>
                            <!-- <div class="header-item">
                                Selected:
                                {{ importModalState.checkedList.length }}
                            </div> -->
                            <div class="choose-filter d-flex flex-fill align-items-center justify-content-end">
                                <a-select
                                    size="large"
                                    class="me-3"
                                    mode="multiple"
                                    v-model:value="selectedQuestionTypes"
                                    :placeholder="t('generate_qs_modal.form.question_types')"
                                    style="width: fit-content; min-width: 300px"
                                    @change="onFilter"
                                >
                                    <a-select-option
                                        v-for="option in questionTypeOptions"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </a-select-option>
                                </a-select>
                                <div class="choose-search" style="width: 250px">
                                    <Input
                                        @input="onFilter"
                                        v-model="searchValue"
                                        :placeholder="t('question_sets_index.search_placeholder')"
                                    >
                                        <template #icon>
                                            <i class="bx bx-search"></i>
                                        </template>
                                    </Input>
                                </div>
                            </div>
                        </div>

                        <a-checkbox-group v-model:value="importModalState.checkedList">
                            <div v-if="loading" class="preview-question-container">
                                <a-skeleton :loading="loading"></a-skeleton>
                                <a-skeleton :loading="loading"></a-skeleton>
                                <a-skeleton :loading="loading"></a-skeleton>
                            </div>
                            <div v-else class="preview-question-container">
                                <template v-if="question_data.length > 0">
                                    <div
                                        class="preview-question-item"
                                        v-for="(question, index) in question_data"
                                    >
                                        <a-checkbox :value="question"></a-checkbox>

                                        <div class="question-item-content">
                                            <RichContent
                                                class="question-html"
                                                :content="question.questionText"
                                                :format="question.textFormat"
                                            />
                                            <QuestionMediaView
                                                :media="question.media"
                                                compact
                                                @reload="reloadQuestionMedia"
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
                                                                v-for="option in question
                                                                    .questionData.multipleChoice"
                                                            >
                                                                <RichContent
                                                                    :content="option.text"
                                                                    :format="question.textFormat"
                                                                    inline
                                                                />
                                                                <span
                                                                    class="text-success"
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
                                                        v-for="option in question.questionData
                                                            .matching?.matches"
                                                    >
                                                        <span class="pair-answer-item">
                                                            <RichContent
                                                                :content="
                                                                    question.questionData.matching?.leftItems.find(
                                                                        (x) => x.id === option.leftId,
                                                                    )?.text
                                                                "
                                                                :format="question.textFormat"
                                                                inline
                                                            />
                                                        </span>
                                                        <i class="bx bx-right-arrow-alt"></i>
                                                        <span class="pair-answer-item">
                                                            <RichContent
                                                                :content="
                                                                    question.questionData.matching?.rightItems.find(
                                                                        (x) => x.id === option.rightId,
                                                                    )?.text
                                                                "
                                                                :format="question.textFormat"
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
                                                                v-for="option in question
                                                                    .questionData.ordering"
                                                            >
                                                                <RichContent
                                                                    :content="option.text"
                                                                    :format="question.textFormat"
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
                                                                ) in question.questionData.ordering?.sort(
                                                                    (asc, desc) =>
                                                                        asc.correctOrder -
                                                                        desc.correctOrder,
                                                                )"
                                                            >
                                                                <span
                                                                    >#{{ index + 1 }}</span
                                                                >
                                                                -
                                                                <RichContent
                                                                    :content="option.text"
                                                                    :format="question.textFormat"
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
                                                    <div class="short-text-answer">
                                                        <RichContent
                                                            :content="question.questionData.shortText"
                                                            :format="question.textFormat"
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
                                </template>
                                <template v-else>
                                    <div class="w-100 d-flex justify-content-center">
                                        <a-empty>
                                            <template #description>
                                                <span>
                                                    {{
                                                        $t("class_index.other.no_data_matches")
                                                    }}</span
                                                >
                                            </template>
                                        </a-empty>
                                    </div>
                                </template>
                            </div>
                        </a-checkbox-group>
                    </div>
                </div>
            </div>
        </div>
        <template #footer>
            <a-button
                class="main-color-btn"
                size="large"
                key="submit"
                type="primary"
                :disabled="importModalState.checkedList.length === 0"
                @click="handleModalImport"
            >
                {{ $t("import_qs_modal.buttons.import") }}
            </a-button>
        </template>
    </a-modal>
</template>
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

/* unique no remove */
::v-deep(.ant-select-selection-item) {
    background-color: var(--form-item-border-color) !important;
}
:deep(.ant-select-multiple .ant-select-selection-item) {
    border-radius: var(--ui-r-xs);
}
@media (max-width: 767.98px) {
    .content-item-section {
        padding: 14px;
    }
}
</style>
