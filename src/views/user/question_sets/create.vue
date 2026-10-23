<script setup lang="ts">
import {
    buildInvalidQuestionContent,
    isQuestionBlank,
    validateQuestions,
} from "@/services/QuestionValidator";
import ApiQuestionSet from "@/api/ApiQuestionSet";
import ApiTag from "@/api/ApiTag";
import type { RequestQuestion } from "@/models/request/question";
import type Tag from "@/models/response/tag/tag";

import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message, Modal } from "ant-design-vue";
import { hasPendingUploads, toQuestionPayload } from "@/services/QuestionMediaService";
import { fillEmptySetInfo, type ImportedSetInfo } from "@/services/QuestionJsonService";

import { useRouter, onBeforeRouteLeave } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";
import TextArea from "@/shared/components/Common/TextArea.vue";

import MultipleChoice from "@/shared/components/Questions/MultipleChoice.vue";
import Matching from "@/shared/components/Questions/Matching.vue";
import Ordering from "@/shared/components/Questions/Ordering.vue";
import ShortText from "@/shared/components/Questions/ShortText.vue";
import LanguageFlashcard from "@/shared/components/Questions/LanguageFlashcard.vue";

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

const componentMap = {
    MultipleChoice,
    Matching,
    Ordering,
    ShortText,
    LanguageFlashcard,
};

//#region tag
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

    nextTick(() => {
        nextTick(() => {
            requestAnimationFrame(() => {
                scrollerRef.value?.firstElementChild?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        });
    });

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

const scrollerRef = ref<any>(null);

// các trang con của thư viện: highlight mục "Quizzes" ở sidebar
const emit = defineEmits(["updateSidebar"]);

onMounted(() => {
    emit("updateSidebar", "library");
    document.addEventListener("click", handleMouseClickOutside);
    formState.questions.push(createQuestionTemplate(formState.questions));
    // intervalId.value = setInterval(saveDraft, 60_000); //save each 60s
    window.addEventListener("beforeunload", handleBeforeUnload);
});

onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <a-row class="w-100 d-flex align-items-center">
                <a-col :span="1">
                    <RouterLink :to="{ name: 'User_Library' }">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </RouterLink>
                </a-col>
                <a-col class="main-title" :span="23">
                    <span> {{ $t("create_QS.title") }}</span> <br />
                    <span>
                        {{ $t("create_QS.sub_title") }}
                    </span>
                </a-col>
            </a-row>
        </div>
        <div class="content">
            <a-form layout="vertical" v-model="formState" :rules="rules" ref="formRef">
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
                <div class="content-item">
                    <div class="content-item-title">
                        <div>
                            <span>{{ $t("create_QS.quiz.question_question_title") }}</span>
                            <span>{{ $t("create_QS.quiz.question_question_sub_title") }}</span>
                        </div>
                        <div class="content-item-buttons">
                            <RouterLink
                                @click="onOpenImportModal"
                                class="import-button"
                                :to="{ name: '' }"
                            >
                                {{ $t("create_QS.buttons.import") }} <i class="bx bx-download"></i>
                            </RouterLink>
                            <RouterLink
                                @click="openGenerateAIModal"
                                class="import-button"
                                :to="{ name: '' }"
                            >
                                {{ $t("create_QS.buttons.generated_by_ai") }}
                                <i class="bx bx-upload"></i>
                            </RouterLink>
                            <div class="import-button" @click="onFinish">
                                {{ $t("create_QS.buttons.create") }}
                            </div>
                            <div class="import-button">
                                {{
                                    $t("create_QS.quiz.total", {
                                        number: formState.questions.length
                                            .toString()
                                            .padStart(3, "0"),
                                    })
                                }}
                            </div>
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
                                :is="componentMap[item.type]"
                                :question="item"
                                :index="index + 1"
                                :displayScore="true"
                                :allowFlashcard="true"
                                :key="item.id"
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
