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
    testId: string;
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
    createUpdateQuestions: RequestQuestion[];
    deleteQuestionIds: string[];
}

const formRef = ref();
const formState = reactive<FormState>({
    testId: route.params.id?.toString() || "",
    name: "",
    classId: "",
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
    createUpdateQuestions: [],
    deleteQuestionIds: [],
});

const rules = {
    questions: [
        {
            validator: (rule: string, value: []) => {
                if (value && value.length > 500) {
                    return Promise.reject(t("message.maximum_tag.limit_question", { number: 500 }));
                }
                return Promise.resolve();
            },
            trigger: "change",
        },
    ],
};

//#endregion

//#region init data
const loading = ref(false);
const isDataValid = ref(true); //to mark whether the test is valid to remove guard
/** @returns true nếu tải được test để sửa; false nếu đã chuyển hướng (404 / not-allowed) */
const getData = async (): Promise<boolean> => {
    try {
        loading.value = true;
        if (!Validator.isValidGuid(formState.testId)) {
            isDataValid.value = false;
            router.replace({ name: "404" });
            return false;
        }

        const result = await ApiTest.GetById(formState.testId, true);
        if (!result.data.success) {
            isDataValid.value = false;
            router.replace({ name: "404" });
            return false;
        }

        formState.classId = result.data.data.classId;
        formState.testId = result.data.data.testId;
        formState.name = result.data.data.name;
        formState.startTime = result.data.data.startTime;
        formState.endTime = result.data.data.endTime;
        formState.gradeAttemptMethod = result.data.data.gradeAttemptMethod;
        formState.gradeQuestionMethod = result.data.data.gradeQuestionMethod;
        formState.isAllowReviewAfterSubmit = result.data.data.isAllowReviewAfterSubmit;
        formState.isShowCorrectAnswerInReview = result.data.data.isShowCorrectAnswerInReview;
        formState.maxAttempt = result.data.data.maxAttempt;
        formState.numberOfShuffles = result.data.data.numberOfShuffles;
        formState.passingScore = result.data.data.passingScore;
        formState.timeLimit = result.data.data.timeLimit;

        formState.createUpdateQuestions = result.data.data.questions.map((x: ResponseQuestion) =>
            TransferQuestionData.transformResponseToRequest(x),
        );
        sourceInfo.value = Object.fromEntries(
            result.data.data.questions.map((x: ResponseQuestion) => [x.id, toSourceInfo(x)]),
        );
        return true;
    } catch (error: any) {
        isDataValid.value = false;
        const errorKeys = Object.keys(error?.response?.data?.errors ?? {});
        router.replace({
            name: errorKeys.includes(ERROR.USER_NOT_HAVE_PERMISSION_IN_TEST)
                ? "not-allowed"
                : "404",
        });
        return false;
    } finally {
        loading.value = false;
    }
};
//#endregion

//#region câu gốc trong bộ câu hỏi (bản sao trong bài test)
interface SourceInfo {
    sourceVersion: number | null;
    latestSourceVersion: number | null;
    sourceQuestionSetName: string | null;
}
const sourceInfo = ref<Record<string, SourceInfo>>({});
const syncingId = ref("");

const toSourceInfo = (question: ResponseQuestion): SourceInfo => ({
    sourceVersion: question.sourceVersion ?? null,
    latestSourceVersion: question.latestSourceVersion ?? null,
    sourceQuestionSetName: question.sourceQuestionSetName ?? null,
});

// câu gốc đã được sửa sau khi chép vào đề
const hasNewerSource = (questionId: string) => {
    const info = sourceInfo.value[questionId];
    return !!info && info.sourceVersion != null && info.latestSourceVersion != null
        && info.latestSourceVersion > info.sourceVersion;
};

const onSyncWithSource = (index: number) => {
    const question = formState.createUpdateQuestions[index];
    if (!question) return;
    Modal.confirm({
        title: t("update_test.source.sync_confirm_title"),
        content: t("update_test.source.sync_confirm_content"),
        centered: true,
        okText: t("update_test.source.sync"),
        cancelText: t("create_QS.buttons.cancel"),
        onOk: async () => {
            try {
                syncingId.value = question.id;
                const result = await ApiTest.SyncWithSource(formState.testId, question.id);
                if (!result?.data?.success) return;
                const synced = result.data.data as ResponseQuestion;
                formState.createUpdateQuestions[index] = TransferQuestionData.transformResponseToRequest(synced);
                sourceInfo.value = { ...sourceInfo.value, [synced.id]: toSourceInfo(synced) };
                message.success(t("update_test.source.synced"));
            } catch (error) {
                // lỗi (câu gốc đã xoá / hết quyền...) đã hiện toast ở interceptor
                console.log("ERROR: sync test question with source", error);
            } finally {
                syncingId.value = "";
            }
        },
    });
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
    if (formState.createUpdateQuestions.length >= 100) {
        message.warning(t("message.limit_question", { number: 100 }));
        return;
    }

    formState.createUpdateQuestions = [
        ...formState.createUpdateQuestions,
        createQuestionTemplate(formState.createUpdateQuestions),
    ];

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
    if (formState.createUpdateQuestions.length <= 1) {
        message.warning(t("message.minimum_question", { number: 1 }));
        return;
    }
    const questionId = formState.createUpdateQuestions[index].id;
    if (!questionId.startsWith("new_") && questionId) formState.deleteQuestionIds.push(questionId);

    formState.createUpdateQuestions = [
        ...formState.createUpdateQuestions.slice(0, index),
        ...formState.createUpdateQuestions.slice(index + 1),
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

    const issues = validateQuestions(formState.createUpdateQuestions);
    isInvalid = issues.length > 0;

    if (isInvalid) {
        Modal.error({
            title: t("update_test.modal.invalid.title"),
            content: buildInvalidQuestionContent(issues, t("update_test.modal.invalid.content")),
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
        title: t("update_test.modal.valid.title"),
        content: t("update_test.modal.valid.content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: async () => {
            // formState.createUpdateQuestions = formState.createUpdateQuestions.map((x) =>
            //     x.id.startsWith("new_") ? { ...x, id: "" } : x,
            // ); //remove new question id

            //const result = await ApiTest.Update(formState);
            let result = await ApiTest.Update({
                ...formState,
                createUpdateQuestions: formState.createUpdateQuestions.map((x) => ({
                    questionId: x.id.startsWith("new_") ? null : x.id,
                    ...toQuestionPayload(x),
                })),
            });

            if (result.data.success) {
                isDataValid.value = false; //disable safe guard
                router.push({ name: "User_Class_Exam", params: { id: formState.classId } });
                message.success("Updated successfully!");
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

const onSwitchToQuestionSet = () => {
    chosenFolder.value = null;
    folderModalRef.value?.closeModal();
    openQuestionSetModal();
};

const onOpenFolder = async (folder: Folder) => {
    chosenFolder.value = folder;

    // chờ prop `folder` của modal con cập nhật rồi mới mở (như trang tạo test)
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
import { buildInvalidQuestionContent, validateQuestions } from "@/services/QuestionValidator";
import { canManageClass } from "@/services/ClassPermissionService";
import ERROR from "@/constants/errors";
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
    const importQuestions = selected
        .map((x) => TransferQuestionData.transformResponseToRequest(x))
        .map((item, i) => ({
            ...item,
            id: `new_${formState.createUpdateQuestions.length + i}`,
        }));

    folderModalRef.value?.closeModal();
    formState.createUpdateQuestions = [...formState.createUpdateQuestions, ...importQuestions];

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
    if (!(await getData())) return;

    // học viên không được sửa test: kiểm tra quyền (theo lớp của test) trước khi render editor
    if (!(await canManageClass(formState.classId))) {
        isDataValid.value = false; //bỏ leave guard
        router.replace({ name: "not-allowed" });
        return;
    }
    pageReady.value = true;

    await getClassData();
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
                    <span> {{ $t("update_test.title", { test_name: formState.name }) }} </span
                    ><br />
                    <span>{{ $t("update_test.sub_title") }} </span>
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
                                        number: formState.createUpdateQuestions.length
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
                    <div v-if="loading">
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                    </div>
                    <div v-else ref="scrollerRef" class="question-list">
                        <div
                            v-for="(item, index) in formState.createUpdateQuestions"
                            :key="item.id"
                            class="question-list-item"
                            v-memo="[item, index, item.type, sourceInfo[item.id], syncingId === item.id]"
                        >
                            <div v-if="hasNewerSource(item.id)" class="source-update-banner" role="status">
                                <i class="bx bx-git-compare" aria-hidden="true"></i>
                                <span>
                                    {{
                                        $t("update_test.source.newer", {
                                            name: sourceInfo[item.id].sourceQuestionSetName,
                                            current: sourceInfo[item.id].sourceVersion,
                                            latest: sourceInfo[item.id].latestSourceVersion,
                                        })
                                    }}
                                </span>
                                <a-button
                                    size="small"
                                    :loading="syncingId === item.id"
                                    @click="onSyncWithSource(index)"
                                >
                                    {{ $t("update_test.source.sync") }}
                                </a-button>
                            </div>
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
<style></style>

<style scoped>
.source-update-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 8px;
    padding: 8px 12px;
    border: 1px solid var(--c-warning);
    border-left-width: 3px;
    border-radius: var(--ui-r-md);
    background-color: color-mix(in srgb, var(--c-warning) 10%, transparent);
    color: var(--c-text);
    font-size: 14px;
}
.source-update-banner > i {
    font-size: 18px;
    color: var(--c-warning-text);
}
.source-update-banner > span {
    flex: 1 1 240px;
}

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
