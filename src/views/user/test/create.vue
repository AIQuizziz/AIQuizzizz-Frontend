<script setup lang="ts">
import ApiClass from "@/api/ApiClass";
import ApiTest from "@/api/ApiTest";

import { ref, reactive, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { message, Modal } from "ant-design-vue";
import { hasPendingUploads, toQuestionPayload } from "@/services/QuestionMediaService";

import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";

import type { RequestQuestion } from "@/models/request/question";
import type { ResponseQuestion } from "@/models/response/question";
import type { Folder } from "@/models/response/folder/folder";
import type { Class } from "@/models/response/class/class";

import QUESTION_TYPE from "@/constants/questionTypes";
import TEST_GRADE_ATTEMPT_METHOD from "@/constants/testGradeAttempMethod";
import TEST_GRADE_QUESTION_METHOD from "@/constants/testGradeQuestionMethod";

import MultipleChoice from "@/shared/components/Questions/MultipleChoice.vue";
import Matching from "@/shared/components/Questions/Matching.vue";
import Ordering from "@/shared/components/Questions/Ordering.vue";
import ShortText from "@/shared/components/Questions/ShortText.vue";
const componentMap = {
    MultipleChoice,
    Matching,
    Ordering,
    ShortText,
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

//#region  check class
const isDataValid = ref(true); //to mark whether the test is valid to remove guard
const classData = ref<Class>();
const getClassData = async () => {
    if (!Validator.isValidGuid(formState.classId)) {
        isDataValid.value = false;
        router.push({ name: "404" });
        return;
    }

    const result = await ApiClass.GetById(formState.classId);
    if (!result.data.success) {
        isDataValid.value = false;
        router.push({ name: "404" });
        return;
    }
    classData.value = result.data.data;
};
//#endregion

//#region formState

interface FormState {
    name: string;
    classId: string;
    timeLimit: number;
    startTime: string;
    endTime: string;
    gradeAttemptMethod: string;
    gradeQuestionMethod: string;
    isShowCorrectAnswerInReview: boolean;
    isAllowReviewAfterSubmit: boolean;
    numberOfShuffles: number;
    maxAttempt: number;
    passingScore: number;
    questions: RequestQuestion[];
}

const formRef = ref();
const formState = reactive<FormState>({
    name: "",
    classId: route.params.id.toString() || "",
    timeLimit: 60,
    startTime: "",
    endTime: "",
    gradeAttemptMethod: TEST_GRADE_ATTEMPT_METHOD.HIGHEST_SCORE,
    gradeQuestionMethod: TEST_GRADE_QUESTION_METHOD.PARTIAL,
    isShowCorrectAnswerInReview: true,
    isAllowReviewAfterSubmit: true,
    numberOfShuffles: 2,
    maxAttempt: 2,
    passingScore: 50,
    questions: [],
});

const rules = {
    title: [
        {
            required: "true",
            message: t("message.required"),
            trigger: "change",
        },
        {
            length: 100,
            message: t("message.limit", { limit: 100 }),
            trigger: "change",
        },
    ],
    description: [
        {
            length: 200,
            message: t("message.limit", { limit: 200 }),
            trigger: "change",
        },
    ],
    tags: [
        {
            validator: (rule: string, value: []) => {
                if (value && value.length > 5) {
                    return Promise.reject(t("message.maximum_tag.out_of_range", { tag: 5 }));
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

//#region crud question
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
    if (formState.questions.length >= 100) {
        message.warning(t("message.limit_question", { number: 100 }));
        return;
    }

    formState.questions = [...formState.questions, createQuestionTemplate(formState.questions)];
    nextTick(() => {
        nextTick(() => {
            requestAnimationFrame(() => {
                scrollerRef.value?.lastElementChild?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        });
    });
};

const onRemoveQuestion = (index: number) => {
    if (formState.questions.length <= 1) {
        message.warning(t("message.minimum_question", { number: 1 }));
        return;
    }

    formState.questions = [
        ...formState.questions.slice(0, index),
        ...formState.questions.slice(index + 1),
    ];
};

//#endregion

//#region finish validator
const onFinish = async () => {
    await formRef.value?.validate();
    let isInvalid = false;
    let msg = t("message.invalid_question");
    let invalidQuestion = new Set<RequestQuestion>();

    if (formState.name.trim().length > 100 || formState.name.trim().length === 0) {
        isInvalid = true;
        msg = t("message.invalid_title");
        message.error(msg);
        openSettingModal();
        return;
    }

    const issues = validateQuestions(formState.questions);
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
        title: t("assign_test.modal.valid.title"),
        content: t("assign_test.modal.valid.content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: async () => {
            const result = await ApiTest.Create({
                ...formState,
                questions: formState.questions.map(toQuestionPayload),
            });
            if (result.data.success) {
                isDataValid.value = false; //disable safe guard
                message.success(t("message.created_successfully"));
                router.push({ name: "User_Class_Exam", params: { id: formState.classId } });
            }
        },
    });
};
//#endregion

//#region setting modal
import SettingTestModal from "@/shared/modals/SettingTestModal.vue";
const settingModalRef = ref<InstanceType<typeof SettingTestModal> | null>(null);
const openSettingModal = () => {
    settingModalRef.value?.openTestSettingModal();
};

//#endregion

//#region choose from folder modal
import ChooseFolderModal from "@/shared/modals/ChooseFolderModal.vue";
const folderModalRef = ref<InstanceType<typeof ChooseFolderModal> | null>(null);
const openFolderModal = () => {
    folderModalRef.value?.openModal();
};

const onSwitchToQuestionSet = async () => {
    chosenFolder.value = null;
    folderModalRef.value?.closeModal();
    openQuestionSetModal();
};

const onOpenFolder = async (folder: Folder) => {
    chosenFolder.value = folder;

    await nextTick();

    folderModalRef.value?.closeModal();
    openFolderQuestionSetModal();
};

//#endregion

//#region choose question set from folder modals
const chosenFolder = ref<Folder | null>(null);
const chosenQuestionSetId = ref("");

import ChooseFolderQuestionSetModal from "@/shared/modals/ChooseFolderQuestionSetModal.vue";
const folderQuestionSetModalRef = ref<InstanceType<typeof ChooseFolderQuestionSetModal> | null>(
    null,
);
const openFolderQuestionSetModal = () => {
    folderQuestionSetModalRef.value?.openModal();
};

const onBackToFolderModal = () => {
    chosenFolder.value = null;
    openFolderModal();
};

//#endregion

//#region choose from question set modal
import ChooseQuestionSetModal from "@/shared/modals/ChooseQuestionSetModal.vue";
const questionSetModalRef = ref<InstanceType<typeof ChooseQuestionSetModal> | null>(null);
const openQuestionSetModal = () => {
    questionSetModalRef.value?.openModal();
};

const onSwitchToFolder = () => {
    chosenFolder.value = null;
    questionSetModalRef.value?.closeModal();
    openFolderModal();
};

//use for both case
const onOpenQuestionSet = async (questionSetId: string, folder: Folder | null) => {
    chosenQuestionSetId.value = questionSetId;
    questionSetModalRef.value?.closeModal();
    chosenFolder.value = folder;
    await nextTick();
    openQuestionModal();
};

//#endregion

//#region choose question from question set
import ChooseQuestionModal from "@/shared/modals/ChooseQuestionModal.vue";
import TransferQuestionData from "@/services/TransferQuestionData";
import Validator from "@/services/Validator";
import {
    buildInvalidQuestionContent,
    isQuestionBlank,
    validateQuestions,
} from "@/services/QuestionValidator";
import { canManageClass } from "@/services/ClassPermissionService";
const questionModalRef = ref<InstanceType<typeof ChooseQuestionModal> | null>(null);
const openQuestionModal = () => {
    questionModalRef.value?.openModal();
};

const onBackToFolderQuestionSet = async (folder: Folder) => {
    chosenFolder.value = folder;
    await nextTick();
    openFolderQuestionSetModal();
};

const onBackToQuestionSet = () => {
    openQuestionSetModal();
};

//#endregion

//use for both modal import event
const onModalImport = (selected: ResponseQuestion[]) => {
    const importQuestions = selected.map((x) => TransferQuestionData.transformResponseToRequest(x));

    folderModalRef.value?.closeModal();
    // bỏ câu hỏi mặc định còn trống/chưa chỉnh sửa để không bị lỗi "errors at questions: 1" khi Next
    const keptQuestions = formState.questions.filter((q) => !isQuestionBlank(q));
    formState.questions = [...keptQuestions, ...importQuestions];

    nextTick(() => {
        nextTick(() => {
            requestAnimationFrame(() => {
                scrollerRef.value?.lastElementChild?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        });
    });
    message.success(`${t("message.imported_question", { number: selected.length })}`);
};

//#region leave guard
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

function handleBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = "";
}

onUnmounted(() => {
    // clearInterval(intervalId.value);
    window.removeEventListener("beforeunload", handleBeforeUnload);
});
//#endregion

const scrollerRef = ref<any>(null);

const pageReady = ref(false);
onMounted(async () => {
    // học viên không được tạo test: kiểm tra quyền trước khi render editor
    if (!(await canManageClass(formState.classId))) {
        isDataValid.value = false; //bỏ leave guard
        router.replace({ name: "not-allowed" });
        return;
    }
    pageReady.value = true;

    getClassData();
    formState.questions.push(createQuestionTemplate(formState.questions));
    window.addEventListener("beforeunload", handleBeforeUnload);
    await nextTick();
    openSettingModal();
});
</script>
<template>
    <div v-if="pageReady" class="page-container">
        <div class="title-container">
            <a-row class="w-100 d-flex align-items-center">
                <a-col :span="1">
                    <RouterLink :to="{ name: '' }" @click="openSettingModal">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </RouterLink>
                </a-col>
                <a-col class="main-title" :span="23">
                    <span> {{ $t("assign_test.title", { class_name: classData?.name }) }} </span
                    ><br />
                    <span>{{ $t("assign_test.sub_title") }} </span>
                </a-col>
            </a-row>
        </div>
        <div class="content">
            <a-form layout="vertical" :model="formState" :rules="rules" ref="formRef">
                <div class="content-item">
                    <div class="content-item-title">
                        <div>
                            <span>
                                {{ $t("assign_test.test_question.title") }}
                            </span>
                            <span>{{ $t("assign_test.test_question.sub_title") }} </span>
                        </div>
                        <div class="content-item-buttons">
                            <RouterLink
                                class="import-button"
                                :to="{ name: '' }"
                                @click="openFolderModal"
                            >
                                {{ $t("assign_test.buttons.choose_from_folder") }}
                            </RouterLink>
                            <div class="import-button">
                                {{
                                    $t("create_QS.quiz.total", {
                                        number: formState.questions.length
                                            .toString()
                                            .padStart(3, "0"),
                                    })
                                }}
                            </div>
                            <a-button
                                type="primary"
                                class="main-color-btn"
                                size="large"
                                @click="onFinish"
                            >
                                {{ $t("assign_test.buttons.next") }}
                            </a-button>
                        </div>
                    </div>
                    <div ref="scrollerRef" class="question-list">
                        <div
                            v-for="(item, index) in formState.questions"
                            :key="item.id"
                            class="question-list-item"
                            v-memo="[item, index, item.type]"
                        >
                            <component
                                :is="componentMap[item.type as keyof typeof componentMap]"
                                :question="item"
                                :index="index + 1"
                                :displayScore="true"
                                @deleteQuestion="onRemoveQuestion(index)"
                                @changeQuestionType="onHandleChangeQuestionType(item)"
                            />
                        </div>
                    </div>
                    <div class="add-question-btn" @click="onAddQuestion">
                        <i class="bx bx-plus"></i>
                        {{ $t("create_QS.buttons.add_question") }}
                    </div>
                </div>
            </a-form>
        </div>
    </div>

    <SettingTestModal
        v-if="pageReady"
        ref="settingModalRef"
        :form-ref="formRef"
        :class-name="classData?.name!"
        :form-state="formState"
    />
    <ChooseFolderModal
        ref="folderModalRef"
        @switch-to-question-set="onSwitchToQuestionSet"
        @open-folder="onOpenFolder"
    />
    <ChooseFolderQuestionSetModal
        ref="folderQuestionSetModalRef"
        :folder="chosenFolder"
        @back-to-folder-modal="onBackToFolderModal"
        @open-question-set="onOpenQuestionSet"
    />
    <ChooseQuestionSetModal
        ref="questionSetModalRef"
        @switch-to-folder="onSwitchToFolder"
        @open-question-set="onOpenQuestionSet"
    />
    <ChooseQuestionModal
        ref="questionModalRef"
        :question-set-id="chosenQuestionSetId"
        :folder="chosenFolder"
        @back-to-folder-question-set-modal="onBackToFolderQuestionSet"
        @back-to-question-set-modal="onBackToQuestionSet"
        @import="onModalImport"
    />
</template>
<style scoped>
.content-item {
    padding: 20px;
}

.content-item-title {
    font-size: 20px;
}

.ant-btn {
    box-shadow: none;
}

.content-item-buttons {
    flex-direction: row;
    padding-right: 10px;
}

.import-button {
    height: 40px;
    padding: 0 16px;
    justify-content: center;
    border-width: 1px;
    border-color: var(--main-color);
}

.import-button:nth-child(2),
.import-button:nth-child(3) {
    border-width: 1px;
}

.import-button:first-child:hover {
    background: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-color: var(--main-color);
    color: var(--c-primary-text);
}

.import-button:nth-child(2) {
    background: var(--c-surface-subtle);
    border-color: var(--content-item-border-color);
    color: var(--text-color);
    cursor: default;
}

.question-list {
    padding: 4px 12px;
    border-radius: var(--ui-r-lg);
}

.add-question-btn {
    margin-top: 12px;
    height: 44px;
    border: 1px dashed var(--main-color);
    border-radius: var(--ui-r-md);
    color: var(--c-primary-text);
}

.add-question-btn:hover {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border: 1px dashed var(--main-color);
}
</style>
