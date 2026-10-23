<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";
import ApiTag from "@/api/ApiTag";
import ERROR from "@/constants/errors";
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message, Modal } from "ant-design-vue";
import { hasPendingUploads, toQuestionPayload } from "@/services/QuestionMediaService";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import type Tag from "@/models/response/tag/tag";

import type { RequestQuestion } from "@/models/request/question";
import type { ResponseQuestion } from "@/models/response/question";
import QUESTION_TYPE from "@/constants/questionTypes";

import TranferQuestionData from "@/services/TransferQuestionData";
import Validator from "@/services/Validator";
import {
    buildInvalidQuestionContent,
    isQuestionBlank,
    validateQuestions,
} from "@/services/QuestionValidator";

import Input from "@/shared/components/Common/Input.vue";
import TextArea from "@/shared/components/Common/TextArea.vue";

import QuestionEditorLayout from "@/shared/components/Questions/QuestionEditorLayout.vue";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

//#region interface
interface FormState {
    name: string;
    description: string;
    createUpdateQuestions: RequestQuestion[];
    deleteQuestionIds: string[];

    tags: string[];
}

interface QuestionSetDetail {
    id: string;
    name: string;
    description: string;
    tags: Tag[];
}

//#endregion

//#region get question set detail data
const loading = ref(false);
const questionSetId = ref(route.params.id as string);
const questionSetDetail = ref<QuestionSetDetail>({
    id: "",
    name: "",
    description: "",
    tags: [],
});

const questionSetQuestions = ref<ResponseQuestion[]>([]);

const isDataValid = ref(true); //to mark whether question set is valid to remove guard

const getTestTemplate = async () => {
    loading.value = true;

    if (!Validator.isValidGuid(questionSetId.value)) {
        isDataValid.value = false;
        router.push({ name: "404" });
        return;
    }

    // chỉ owner/editor mới được vào editor: kiểm tra quyền trước khi render
    try {
        const permission_result = await ApiQuestionSet.GetPermissions(questionSetId.value);
        if (!permission_result.data.success || !permission_result.data.data?.canEdit) {
            isDataValid.value = false;
            router.replace({ name: "not-allowed" });
            return;
        }
    } catch (error) {
        isDataValid.value = false;
        console.log("ERROR: GetPermissions", error);
        router.replace({ name: "not-allowed" });
        return;
    }

    let detail_result, question_result;
    try {
        detail_result = await ApiQuestionSet.GetDetailById(questionSetId.value);
        question_result = await ApiQuestionSet.GetQuestionById(questionSetId.value);
    } catch (error: any) {
        // bộ câu hỏi đã bị xoá / không tải được: toast lỗi đã hiện ở interceptor -> không render editor rỗng
        isDataValid.value = false;
        const notFound = ERROR.QUESTION_SET_NOT_FOUND in (error?.response?.data?.errors ?? {});
        router.replace(notFound ? { name: "404" } : { name: "User_Library" });
        return;
    }

    if (!detail_result.data.success || !question_result.data.success) {
        isDataValid.value = false;
        router.push({ name: "404" });
        return;
    }

    questionSetDetail.value = detail_result.data.data;
    questionSetQuestions.value = question_result.data.data;

    formState.name = questionSetDetail.value.name;
    formState.description = questionSetDetail.value.description;
    formState.createUpdateQuestions = questionSetQuestions.value.map((x) =>
        TranferQuestionData.transformResponseToRequest(x),
    );

    formState.tags = questionSetDetail.value.tags.map((x) => x.name);
    loading.value = false;
    window.addEventListener("beforeunload", handleBeforeUnload);
};
//#endregion

//#region form
const formRef = ref();

const formState = reactive<FormState>({
    name: "",
    description: "",
    createUpdateQuestions: [],
    deleteQuestionIds: [],

    tags: [],
});

const rules = {
    title: [
        {
            required: "true",
            message: "This field is required",
            trigger: "change",
        },
        {
            length: 100,
            message: "Limit 100",
            trigger: "change",
        },
    ],
    description: [
        {
            length: 200,
            message: "Limit 200",
            trigger: "change",
        },
    ],
    tags: [
        {
            validator: (rule: string, value: []) => {
                if (value && value.length > 5) {
                    return Promise.reject("You can only add up to 5 tags.");
                }
                return Promise.resolve();
            },
            trigger: "change",
        },
    ],
    questions: [
        {
            validator: (rule: string, value: []) => {
                if (value && value.length > 500) {
                    return Promise.reject("You can only add up to 5 questions.");
                }
                return Promise.resolve();
            },
            trigger: "change",
        },
    ],
};

//#endregion

//#region logic edit question
import ChangeQuestionType from "@/services/ChangeQuestionType";
import { defaultNewQuestionFormat } from "@/services/ContentModeService";
// câu hỏi mới mặc định là Rich text, trừ khi cả danh sách hiện tại đều là Markdown
const createQuestionTemplate = (existing: RequestQuestion[] = []): RequestQuestion => ({
    id: "new_" + Date.now().toString(),
    type: "MultipleChoice",
    textFormat: defaultNewQuestionFormat(existing),
    questionText: "",
    questionHTML: "",
    explainText: "",
    score: 10,
    multipleChoices: ChangeQuestionType.defaultMultipleChoices(),
    matchingPairs: ChangeQuestionType.defaultMatchingPairs(),
    orderingItems: ChangeQuestionType.defaultOrderingItems(),
    shortAnswer: "",
    mediaId: null,
    media: null,
});

const onHandleChangeQuestionType = (question: RequestQuestion) => {
    ChangeQuestionType.onChangeQuestionType(question);
};

const onAddQuestion = () => {
    if (formState.createUpdateQuestions.length >= 500) {
        message.warning(t("maximum_tag.limit_question", { number: 500 }));
        return;
    }

    formState.createUpdateQuestions = [
        ...formState.createUpdateQuestions,
        createQuestionTemplate(formState.createUpdateQuestions),
    ];

    editorRef.value?.focusQuestion(formState.createUpdateQuestions[formState.createUpdateQuestions.length - 1].id);
};

const onRemoveQuestion = (index: number) => {
    if (formState.createUpdateQuestions.length <= 1) {
        message.warning(t("maximum_tag.minimum_question", { number: 1 }));
        return;
    }
    //add to delete existing question only
    //ignore new question
    const questionId = formState.createUpdateQuestions[index].id;
    if (!questionId.startsWith("new_") && questionId) formState.deleteQuestionIds.push(questionId);

    formState.createUpdateQuestions = [
        ...formState.createUpdateQuestions.slice(0, index),
        ...formState.createUpdateQuestions.slice(index + 1),
    ];
};

const onFinish = () => {
    let isInvalid = false;
    let msg = t("message.invalid_question");
    let invalidQuestion = new Set<RequestQuestion>();

    if (formState.name.trim().length > 100 || formState.name.trim().length === 0) {
        isInvalid = true;
        msg = t("message.invalid_title");
        message.error(msg);
        return;
    }

    if (formState.description.trim().length > 250) {
        isInvalid = true;
        msg = t("message.invalid_description");
        message.error(msg);
        return;
    }

    const issues = validateQuestions(formState.createUpdateQuestions);
    isInvalid = issues.length > 0;

    if (isInvalid) {
        Modal.error({
            title: t("create_QS.modal.invalid.title"),
            content: buildInvalidQuestionContent(issues, t("create_QS.modal.invalid.content")),
            okText: t("sidebar.buttons.ok"),
            cancelText: t("sidebar.buttons.cancel"),
        });
    } else {
        showModalConfirmation();
    }
};

const showModalConfirmation = () => {
    // file media đang upload/xử lý thì chưa có mediaId -> không cho lưu
    if (hasPendingUploads()) {
        message.warning(t("question_media.wait_for_upload"));
        return;
    }
    Modal.confirm({
        title: t("update_QS.modal.valid.title"),
        content: t("create_QS.modal.valid.content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: async () => {
            // formState.createUpdateQuestions = formState.createUpdateQuestions.map((x) =>
            //     x.id.startsWith("new_") ? { ...x, id: "" } : x,
            // );

            // // let result = await ApiQuestionSet.Update(questionSetId.value, formState);
            // let result = await ApiQuestionSet.Update(questionSetId.value, {
            //     ...formState,
            //     createUpdateQuestions: formState.createUpdateQuestions.map((x) => ({
            //         questionId: x.id,
            //         ...x,
            //     })),
            // });

            let result = await ApiQuestionSet.Update(questionSetId.value, {
                ...formState,
                createUpdateQuestions: formState.createUpdateQuestions.map((x) => ({
                    questionId: x.id.startsWith("new_") ? null : x.id,
                    ...toQuestionPayload(x),
                })),
            });

            if (result.data.success) {
                message.success(t("message.updated_successfully"));
                isDataValid.value = false;
                router.push({
                    name: "User_QuestionSet_Detail",
                    params: { id: result.data.data },
                });
            }
            // localStorage.removeItem(storage_draft_key);
        },
    });
};
//#endregion

//#region logic edit tag
//tag
const tagContent = ref("");
const addTag = () => {
    if (formState.tags.length >= 5) {
        message.warning(t("message.maximum_tag", { tag: 5 }));
        return;
    }

    if (formState.tags.includes(tagContent.value.trim())) {
        message.warning(t("message.duplicate_tag"));
        return;
    }
    if (tagContent.value && tagContent.value.trim().length <= 50) {
        formState.tags.push(tagContent.value);
        tagContent.value = "";
    } else {
        message.warning(t("message.invalid_tag_content"));
    }
};

const removeTag = (index: number) => {
    formState.tags.splice(index, 1);
};

const appendTagContent = (name: string) => {
    tagContent.value = name;
    addTag();
};

const tag_search_data = ref<Tag[]>([]);

/* use this for tracking whether mouse is in search components */
const searchResultRef = ref<HTMLElement | null>(null);

/* use this for temporary when mouse leave */
const lastSearchResult = ref<Tag[]>([]);
function handleMouseClickOutside(event: MouseEvent) {
    if (!searchTagPageParams.name || !searchResultRef.value?.contains(event.target as Node)) {
        tag_search_data.value = [];
    } else {
        tag_search_data.value = [...lastSearchResult.value];
    }
}

const searchTagPageParams = reactive({
    name: tagContent.value,
    pageSize: 10,
});

watch(
    () => tagContent.value,
    () => {
        searchTagPageParams.name = tagContent.value;
        getSearchTagData();
    },
);

const getSearchTagData = async () => {
    if (tagContent.value.trim().length >= 50) {
        return;
    }
    const result = await ApiTag.GetAllByLimit(searchTagPageParams);
    if (result.data.success) {
        tag_search_data.value = result.data.data;
        lastSearchResult.value = result.data.data;
        if (tagContent.value.trim().length === 0) {
            tag_search_data.value = [];
        }
    }
};
//#endregion

//#region import modal
import ImportQSModal from "@/shared/modals/ImportQSModal.vue";
const importModalRef = ref<InstanceType<typeof ImportQSModal> | null>(null);

const onOpenImportModal = () => {
    importModalRef.value?.openImportModal();
};

//#endregion

//#region generate modal
import GenerateQSModal from "@/shared/modals/GenerateQSModal.vue";
const generateModalRef = ref<InstanceType<typeof GenerateQSModal> | null>(null);

const openGenerateAIModal = () => {
    generateModalRef.value?.openGenerateAIModal();
};
//use for both modal import event
const onModalImport = (selected: RequestQuestion[]) => {
    if (selected.length === 0) return;
    // bỏ câu hỏi mặc định còn trống (chưa nhập gì) trước khi thêm câu hỏi import
    formState.createUpdateQuestions = formState.createUpdateQuestions.filter(
        (q) => !(String(q.id).startsWith("new_") && isQuestionBlank(q)),
    );
    formState.createUpdateQuestions.unshift(
        ...selected.map((item, i) => ({
            ...item,
            id: `new_${Date.now()}_${i}`,
            orderingItems: item.orderingItems?.map((x, index) => ({
                ...x,
                correctOrder: index,
            })),
        })),
    );

    editorRef.value?.focusQuestion(formState.createUpdateQuestions[0].id);

    message.success(`Imported ${selected.length} questions`);
};
//#endregion

//#region auto save
// const storage_draft_key = `create_QS_draft_${dayjs().valueOf()}`;
// const intervalId = ref<number>();

// const saveDraft = () => {
//     // localStorage.setItem(storage_draft_key, JSON.stringify(formState));
//     message.info("Auto saved");
// };
//#endregion

//#region  safe guard before leave
function handleBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = "";
}

onBeforeRouteLeave((to, from, next) => {
    if (!isDataValid.value) {
        next();
        return;
    }

    Modal.confirm({
        title: t("create_QS.modal.leave.title"),
        content: t("create_QS.modal.leave.content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: () => {
            // localStorage.removeItem(storage_draft_key);
            next();
        },
        onCancel: () => next(false),
    });
});

onUnmounted(() => {
    // clearInterval(intervalId.value);
    window.removeEventListener("beforeunload", handleBeforeUnload);
});
//#endregion

const editorRef = ref<InstanceType<typeof QuestionEditorLayout> | null>(null);

// các trang con của thư viện: highlight mục "Quizzes" ở sidebar
const emit = defineEmits(["updateSidebar"]);

onMounted(async () => {
    emit("updateSidebar", "library");
    document.addEventListener("click", handleMouseClickOutside);
    // intervalId.value = setInterval(saveDraft, 60_000); //save each 60s
    await getTestTemplate();
});
</script>
<template>
    <div class="page-container editor-page">
        <div class="title-container">
            <a-row class="w-100 d-flex align-items-center">
                <a-col :span="1">
                    <RouterLink :to="{ name: 'User_Library' }">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </RouterLink>
                </a-col>
                <a-col class="main-title" :span="18">
                    <span> {{ $t("update_QS.title", { name: formState.name }) }}</span> <br />
                    <span>
                        {{ $t("create_QS.sub_title") }}
                    </span>
                </a-col>
                <a-col :span="5" class="title-actions">
                    <a-button type="primary" class="main-color-btn" size="large" @click="onFinish">
                        <i class="bx bx-save"></i>
                        {{ $t("update_QS.buttons.update") }}
                    </a-button>
                </a-col>
            </a-row>
        </div>
        <div class="content">
            <a-form layout="vertical" v-model="formState" :rules="rules" ref="formRef">
                <QuestionEditorLayout
                    ref="editorRef"
                    v-model:questions="formState.createUpdateQuestions"
                    :allow-flashcard="true"
                    :loading="loading"
                    @add="onAddQuestion"
                    @remove="onRemoveQuestion"
                    @change-type="onHandleChangeQuestionType"
                    @import="onOpenImportModal"
                    @generate="openGenerateAIModal"
                >
                    <template #header>
                        <div class="content-item quiz-details">
                            <div class="content-item-title">
                                <div>
                                    <span>{{ $t("create_QS.quiz.question_detail_title") }}</span>
                                    <span>{{ $t("create_QS.quiz.question_detail_sub_title") }}</span>
                                </div>
                            </div>
                            <Input
                                class="question-input-item"
                                v-model="formState.name"
                                :isRequired="true"
                                :placeholder="t('create_QS.other.title_placeholder')"
                                :label="t('create_QS.quiz.title')"
                                :max-length="100"
                            />
                            <div class="qd-row">
                                <TextArea
                                    class="question-input-item qd-description"
                                    v-model="formState.description"
                                    :placeholder="t('create_QS.other.description_placeholder')"
                                    :max-length="250"
                                    :label="t('create_QS.quiz.description')"
                                />
                                <div class="form-item qd-tags">
                                    <label>{{ $t("create_QS.quiz.tag") }}</label>
                                    <div class="tag-container">
                                        <div
                                            class="tag-item"
                                            v-for="(tag, index) in formState.tags"
                                            :key="index"
                                        >
                                            {{ tag }}
                                            <i class="bx bx-x" @click="removeTag(index)"></i>
                                        </div>
                                    </div>
                                    <div class="tag-inputter">
                                        <!-- <Input
                                            v-model="tagContent"
                                            :placeholder="t('create_QS.other.tag_content_placeholder')"
                                            :max-length="50"
                                        >
                                            <template #icon>
                                                <i class="bx bx-purchase-tag-alt"></i>
                                            </template>
                                        </Input> -->
                                        <div class="search-bar" ref="searchResultRef">
                                            <Input
                                                @input="getSearchTagData"
                                                v-model="tagContent"
                                                :placeholder="t('create_QS.other.tag_content_placeholder')"
                                                :max-length="50"
                                            >
                                                <template #icon>
                                                    <i class="bx bx-purchase-tag-alt"></i>
                                                </template>
                                            </Input>
                                            <div
                                                v-if="tag_search_data.length > 0"
                                                :class="['search-result-container']"
                                            >
                                                <div class="search-result">
                                                    <div
                                                        class="search-result-tag"
                                                        v-for="tag in tag_search_data"
                                                    >
                                                        <div class="result-tag">
                                                            {{ tag.name }}
                                                            <div class="result-tag-qs-count">
                                                                {{ tag.questionSetCount }}
                                                            </div>
                                                        </div>
                                                        <div class="result-item-action">
                                                            <a-button
                                                                type="primary"
                                                                class="main-color-btn"
                                                                size="small"
                                                                @click="appendTagContent(tag.name)"
                                                            >
                                                                <i class="bx bx-plus"></i>
                                                            </a-button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <i class="bx bx-plus tag-inputter-button" @click="addTag"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </QuestionEditorLayout>
            </a-form>
        </div>
    </div>

    <ImportQSModal
        ref="importModalRef"
        :title="formState.name"
        :number-of-question="formState.createUpdateQuestions.length"
        @import="onModalImport"
    />
    <GenerateQSModal
        ref="generateModalRef"
        :title="formState.name"
        @import="onModalImport"
        :number-of-question="formState.createUpdateQuestions.length"
    />
</template>

<style scoped>
.content-item-buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
}
</style>
