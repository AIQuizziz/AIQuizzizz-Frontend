<script setup lang="ts">
import {
    buildInvalidQuestionContent,
    isQuestionBlank,
    validateQuestions,
} from "@/services/QuestionValidator";
import ApiQuestionSet from "@/api/ApiQuestionSet";
import type { RequestQuestion } from "@/models/request/question";

import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message, Modal } from "ant-design-vue";
import { hasPendingUploads, toQuestionPayload } from "@/services/QuestionMediaService";
import { fillEmptySetInfo, type ImportedSetInfo } from "@/services/QuestionJsonService";

import { useRouter, onBeforeRouteLeave } from "vue-router";


import QuestionEditorLayout from "@/shared/components/Questions/QuestionEditorLayout.vue";
import QuestionEditorTopBar from "@/shared/components/Questions/QuestionEditorTopBar.vue";
import QuestionSetInfoCard from "@/shared/components/Questions/QuestionSetInfoCard.vue";
import { duplicateQuestion } from "@/services/QuestionEditorService";

interface FormState {
    name: string;
    description: string;
    tags: string[];
    questions: RequestQuestion[]; // or specify the type if you know it
}

const { t } = useI18n();
const router = useRouter();
const isDataValid = ref(true);

const formRef = ref();

const formState = reactive<FormState>({
    name: "",
    description: "",
    tags: [],
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
            message: t("message.out_of_range", { max_length: 100 }),
            trigger: "change",
        },
    ],
    description: [
        {
            length: 200,
            message: t("message.out_of_range", { max_length: 200 }),
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
                    return Promise.reject(t("message.maximum_tag.limit_question", { number: 500 }));
                }
                return Promise.resolve();
            },
            trigger: "change",
        },
    ],
};



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

const onAddQuestion = async () => {
    if (formState.questions.length >= 500) {
        message.warning(t("message.limit_question", { number: 500 }));
        return;
    }

    formState.questions = [...formState.questions, createQuestionTemplate(formState.questions)];

    editorRef.value?.focusQuestion(formState.questions[formState.questions.length - 1].id);
};

// "Câu hỏi" (soạn) | "Xem trước" (như học viên)
const viewMode = ref<"edit" | "preview">("edit");

const onDuplicateQuestion = (index: number) => {
    if (formState.questions.length >= 500) {
        message.warning(t("message.limit_question", { number: 500 }));
        return;
    }
    const copy = duplicateQuestion(formState.questions[index]);
    formState.questions = [...formState.questions.slice(0, index + 1), copy, ...formState.questions.slice(index + 1)];
    message.success(t("question_editor.card.duplicated"));
    editorRef.value?.focusQuestion(copy.id);
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
        title: t("create_QS.modal.valid.title"),
        content: t("create_QS.modal.valid.content"),
        centered: true,
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            //logic here

            formState.questions = formState.questions.map((x) =>
                x.id.startsWith("new_") ? { ...x, questionId: null } : x,
            );
            let result = await ApiQuestionSet.Create({
                ...formState,
                questions: formState.questions.map(toQuestionPayload),
            });
            // let result = await ApiQuestionSet.Create({
            //     ...formState,
            //     questions: formState.questions.map((x) => ({
            //         questionId: x.id.startsWith("new_") ? null : x.id,
            //         ...x,
            //     })),
            // });
            if (result.data.success) {
                message.success(t("message.created_successfully"));
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

//#region import modal
//import modal
import ImportQSModal from "@/shared/modals/ImportQSModal.vue";
const importModalRef = ref<InstanceType<typeof ImportQSModal> | null>(null);

const onOpenImportModal = () => {
    importModalRef.value?.openImportModal();
};
//#endregion

//#region generate modal
//generate modal
import GenerateQSModal from "@/shared/modals/GenerateQSModal.vue";
import QUESTION_TYPE from "@/constants/questionTypes";
const generateModalRef = ref<InstanceType<typeof GenerateQSModal> | null>(null);

const openGenerateAIModal = () => {
    generateModalRef.value?.openGenerateAIModal();
};

//use for both modal import event
const onModalImport = (selected: RequestQuestion[], setInfo?: ImportedSetInfo | null) => {
    if (selected.length === 0) return;
    // nhập JSON: điền sẵn tên / mô tả / thẻ của bộ nếu người dùng chưa nhập
    fillEmptySetInfo(formState, setInfo);
    // bỏ câu hỏi mặc định còn trống (chưa nhập gì) trước khi thêm câu hỏi import
    formState.questions = formState.questions.filter(
        (q) => !(String(q.id).startsWith("new_") && isQuestionBlank(q)),
    );
    formState.questions.unshift(
        ...selected.map((item, i) => ({
            ...item,
            id: `new_${Date.now()}_${i}`,
            orderingItems: item.orderingItems?.map((x, index) => ({
                ...x,
                correctOrder: index,
            })),
        })),
    );

    editorRef.value?.focusQuestion(formState.questions[0].id);

    message.success(`${t("message.imported_question", { number: selected.length })}`);
};

//#endregion

//#region leave guard
/* auto-save */
// const storage_draft_key = `create_QS_draft_${dayjs().valueOf()}`;
// const intervalId = ref<number>();

// const saveDraft = () => {
//     localStorage.setItem(storage_draft_key, JSON.stringify(formState));
//     message.info("Auto saved");
// };

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
            next();
        },
        onCancel: () => next(false),
    });
});

function handleBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = "";
}

//#endregion

const editorRef = ref<InstanceType<typeof QuestionEditorLayout> | null>(null);

// các trang con của thư viện: highlight mục "Quizzes" ở sidebar
const emit = defineEmits(["updateSidebar"]);

onMounted(() => {
    emit("updateSidebar", "library");
    formState.questions.push(createQuestionTemplate(formState.questions));
    // intervalId.value = setInterval(saveDraft, 60_000); //save each 60s
    window.addEventListener("beforeunload", handleBeforeUnload);
});

onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>
<template>
    <div class="page-container editor-page">
        <QuestionEditorTopBar
            v-model:mode="viewMode"
            :title="$t('create_QS.title')"
            :subtitle="$t('create_QS.sub_title')"
            :save-label="$t('question_editor.topbar.save')"
            @save="onFinish"
        />
        <div class="content">
            <a-form layout="vertical" v-model="formState" :rules="rules" ref="formRef">
                <QuestionEditorLayout
                    ref="editorRef"
                    v-model:questions="formState.questions"
                    :allow-flashcard="true"
                    @add="onAddQuestion"
                    :mode="viewMode"
                    @remove="onRemoveQuestion"
                    @duplicate="onDuplicateQuestion"
                    @change-type="onHandleChangeQuestionType"
                    @import="onOpenImportModal"
                    @generate="openGenerateAIModal"
                >
                    <template #header>
                        <QuestionSetInfoCard
                            v-model:name="formState.name"
                            v-model:description="formState.description"
                            v-model:tags="formState.tags"
                        />
                    </template>
                </QuestionEditorLayout>
            </a-form>
        </div>
    </div>

    <ImportQSModal
        ref="importModalRef"
        :title="formState.name"
        :numberOfQuestion="formState.questions.length"
        @import="onModalImport"
    />
    <GenerateQSModal
        ref="generateModalRef"
        :title="formState.name"
        @import="onModalImport"
        :numberOfQuestion="formState.questions.length"
    />
</template>

<style scoped>
.content-item-buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
}
</style>
