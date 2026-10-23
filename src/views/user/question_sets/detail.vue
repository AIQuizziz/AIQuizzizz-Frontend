<script setup lang="ts">
import user_image from "@/assets/user.png";

import ApiQuestionSet from "@/api/ApiQuestionSet";
import type { RequestQuestion } from "@/models/request/question";
import type QuestionSet from "@/models/response/question_set/questionSet";
import type Tag from "@/models/response/tag/tag";
import QUESTION_TYPE from "@/constants/questionTypes";

import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";
import { message, Modal } from "ant-design-vue";
import TransferQuestionData from "@/services/TransferQuestionData";
import { mergeQuestionMedia } from "@/services/QuestionMediaService";
import { downloadJsonFile, questionJsonFileName } from "@/services/QuestionJsonService";
import QuestionMediaView from "@/shared/components/Media/QuestionMediaView.vue";
import RichContent from "@/shared/components/Common/RichContent.vue";
import FlashcardBack from "@/shared/components/Flashcard/FlashcardBack.vue";
import Validator from "@/services/Validator";

import { useI18n } from "vue-i18n";
import dayjs from "dayjs";

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

//#region init data
const loading = ref(false);
const question_set_id = ref(route.params.id);

const quiz = ref<QuestionSet>({
    id: "",
    name: "",
    description: "",
    totalQuestionCount: 0,
    completedQuestionCount: 0,
    ratingCount: 0,
    ratingAverage: 0,
    createBy: "",
    createdAt: "",
    createdById: "",
    tags: [],
    lastAccessByMe: "",
    visibilityMode: "",
});
const quiz_questions = ref<RequestQuestion[]>([]);
const questions = ref<RequestQuestion[]>([]);

const optionKeys = [
    "All",
    QUESTION_TYPE.MULTIPLE_CHOICE,
    QUESTION_TYPE.MATCHING,
    QUESTION_TYPE.ORDERING,
    QUESTION_TYPE.SHORT_TEXT,
    QUESTION_TYPE.LANGUAGE_FLASHCARD,
];

const question_type_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`create_QS.type.${key}`),
        value: key,
    })),
);

const selected_type_option = ref(question_type_options.value[0].value);
const searchValue = ref("");

const getData = async () => {
    try {
        loading.value = true;
        if (!Validator.isValidGuid(question_set_id.value.toString())) {
            router.push({ name: "404" });
            return;
        }

        const question_set_result = await ApiQuestionSet.GetDetailById(
            question_set_id.value.toString(),
        );

        const question_result = await ApiQuestionSet.GetQuestionById(
            question_set_id.value.toString(),
        );

        if (!question_set_result.data.success || !question_result.data.success) {
            router.push({ name: "User_Library" });
            return;
        }

        quiz.value = question_set_result.data.data;
        quiz.value.createBy = question_set_result.data.data.createdBy.fullName;
        quiz_questions.value = question_result.data.data.map((x: ResponseQuestion) =>
            TransferQuestionData.transformResponseToRequest(x),
        );
        questions.value = quiz_questions.value;

        await getPermission();
        await nextTick();
    } catch (error: any) {
        if (ERROR.QUESTION_SET_NOT_FOUND in (error.response?.data?.errors || {})) {
            router.push({ name: "404" });
        }
    } finally {
        loading.value = false;
    }
};

// presigned URL của media hết hạn -> lấy lại URL mới, chỉ cập nhật media (không reset trang)
const reloadQuestionMedia = async () => {
    try {
        const result = await ApiQuestionSet.GetQuestionById(question_set_id.value.toString());
        if (result?.data?.success) {
            mergeQuestionMedia(quiz_questions.value, result.data.data);
        }
    } catch (error) {
        console.log("ERROR: reload question media", error);
    }
};

//preview uploaded content
const toggleDisplayAnswer = (index: number, button: EventTarget) => {
    let $button = $(button);

    $button.toggleClass("bx-chevron-up bx-chevron-down");

    const answer = $(`#question-item-answer-${index}`);
    if (answer) $(answer).slideToggle();
};

//#endregion

//#region share modal

//share quiz
import ShareModal from "@/shared/modals/ShareModal.vue";
import type { ResponseQuestion } from "@/models/response/question";
import VISIBILITY from "@/constants/visibility";
import ERROR from "@/constants/errors";
const shareModalRef = ref<InstanceType<typeof ShareModal> | null>(null);

const onOpenShareModal = () => {
    shareModalRef.value?.openModal();
};

const onUpdateVisibility = (visibility: string) => {
    quiz.value.visibilityMode = visibility;
};

//#endregion

//#region share class modal
const shareClassModalRef = ref<InstanceType<typeof ShareModal> | null>(null);

const onOpenShareClassModal = () => {
    shareClassModalRef.value?.openModal();
};
//#endregion

//#region redirect
const onRedirectToLearn = () => {
    router.push({ name: "User_QuestionSet_Learn", params: { id: quiz.value.id } });
};

const onRedirectToTest = () => {
    router.push({ name: "User_QuestionSet_Test", params: { id: quiz.value.id } });
};

const onRedirectToEdit = () => {
    router.push({ name: "User_QuestionSet_Update", params: { id: quiz.value.id } });
};
//#endregion

//#region rating
const modal_rate_open = ref(false);
const rateValue = ref(0);

const getRating = async () => {
    const result = await ApiQuestionSet.GetRating(quiz.value.id);
    if (result.data.success) {
        rateValue.value = result.data.data.rating;
    }
};

const updateRating = async () => {
    const result = await ApiQuestionSet.UpdateRating(quiz.value.id, {
        questionSetId: quiz.value.id,
        rating: rateValue.value,
    });
    if (result.data.success) {
        message.success(t("message.updated_successfully"));
        modal_rate_open.value = false;
        await getData();
    } else {
        message.error(t("message.updated_failed"));
    }
};

//#endregion

//#region thêm bộ câu hỏi vào thư mục (thành viên thư mục xem được bộ và dùng câu hỏi để tạo đề)
import ShareToFolder from "@/shared/modals/ShareToFolder.vue";
import ApiFolder from "@/api/ApiFolder";
import type { Folder } from "@/models/response/folder/folder";
const shareToFolderModalRef = ref<InstanceType<typeof ShareToFolder> | null>(null);
const openFolderModal = () => {
    shareToFolderModalRef.value?.openModal();
};

const onAddToFolder = (folder: Folder) => {
    Modal.confirm({
        title: t("detail_QS.modal.add_to_folder_title"),
        content: t("detail_QS.modal.add_to_folder_content", { name: quiz.value.name, folder_name: folder.name }),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: async () => {
            try {
                const result = await ApiFolder.AddQuestionSet(folder.folderTestId, quiz.value.id);
                if (result?.data?.success) {
                    message.success(t("detail_QS.modal.add_to_folder_success", { folder_name: folder.name }));
                    shareToFolderModalRef.value?.closeModal();
                }
            } catch (error) {
                // lỗi (đã có trong thư mục / không có quyền) đã hiện toast ở interceptor
                console.log("ERROR: add question set to folder", error);
            }
        },
    });
};
//#endregion

//#region permission
const permission = ref({
    canEdit: false,
    canDelete: false,
});
const getPermission = async () => {
    const result = await ApiQuestionSet.GetPermissions(quiz.value.id);
    if (result.data.success) {
        permission.value = result.data.data;
    }
};
//#endregion

//#region export json
const exportingJson = ref(false);
const onExportJson = async () => {
    if (exportingJson.value) return;
    exportingJson.value = true;
    try {
        const result = await ApiQuestionSet.ExportJson(quiz.value.id);
        if (result.data.success) {
            downloadJsonFile(questionJsonFileName(quiz.value.name), result.data.data);
            message.success(t("question_json.export.success"));
        }
    } catch (error) {
        // không có quyền / gói không cho phép: toast lỗi đã hiển thị ở interceptor
        console.log("ERROR: export json", error);
    } finally {
        exportingJson.value = false;
    }
};
//#endregion

const onDelete = () => {
    Modal.confirm({
        title: t("detail_QS.modal.delete_title"),
        content: t("detail_QS.modal.delete_content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            const result = await ApiQuestionSet.Delete(quiz.value.id);
            if (!result.data.success) {
                message.error(t("message.deleted_failed"));
                return;
            }
            message.success(t("message.deleted_successfully"));
            router.push({ name: "User_Library" });
        },
    });
};

const onRedirectToSearch = (tag: Tag) => {
    const array = [tag];
    sessionStorage.setItem("selected_tags", JSON.stringify(array));
    router.push({ name: "User_QuestionSet_Search" });
};

// bỏ thẻ HTML + chuẩn hoá khoảng trắng để tìm kiếm trên nội dung hiển thị
const toSearchableText = (html: string | undefined | null) =>
    (html ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/s+/g, " ")
        .trim()
        .toLowerCase();

const onFilter = () => {
    let filtered = quiz_questions.value;
    const keyword = toSearchableText(searchValue.value);
    filtered = quiz_questions.value.filter((x) => {
        const matches = toSearchableText(x.questionText).includes(keyword);

        const correctType =
            selected_type_option.value === "All" || selected_type_option.value === x.type;

        return matches && correctType;
    });
    questions.value = filtered;
};

// các trang con của thư viện: highlight mục "Quizzes" ở sidebar
const emit = defineEmits(["updateSidebar"]);

onMounted(async () => {
    emit("updateSidebar", "library");
    //get api quiz + check visibility to current user
    //format url
    await getData();
    // getData thất bại (không có id) thì không gọi rating -> tránh GET QuestionSet//Rating
    if (quiz.value.id) getRating();
});
</script>
<template>
    <div class="content">
        <RouterLink
            class="navigator-back-link d-flex align-items-center p-2"
            :to="{ name: 'User_Library' }"
        >
            <i class="me-1 bx bx-chevron-left"></i>
            {{ $t("detail_QS.other.library") }}
        </RouterLink>
        <div class="content-item">
            <div v-if="loading">
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
            </div>
            <div v-else>
                <div class="content-item-title">
                    <div>
                        <span>{{ quiz.name }}</span>
                        <span>{{ quiz.description }}</span>
                    </div>
                    <div
                        v-if="permission.canEdit || permission.canDelete"
                        class="d-flex flex-row align-items-center quiz-header-functions"
                    >
                        <a-tooltip>
                            <template #title>
                                {{ $t("question_sets_index.buttons.edit") }}
                            </template>
                            <i
                                v-if="permission.canEdit"
                                class="bx bx-edit"
                                @click="onRedirectToEdit"
                            ></i>
                        </a-tooltip>
                        <a-tooltip v-if="permission.canEdit">
                            <template #title>
                                {{ $t("question_json.export.button") }}
                            </template>
                            <i
                                :class="['bx', exportingJson ? 'bx-loader-alt bx-spin' : 'bx-export']"
                                @click="onExportJson"
                            ></i>
                        </a-tooltip>
                        <a-tooltip>
                            <template #title>
                                {{ $t("question_sets_index.buttons.delete") }}
                            </template>
                            <i
                                v-if="permission.canDelete"
                                class="text-danger bx bx-trash-alt"
                                @click="onDelete"
                            ></i>
                        </a-tooltip>
                    </div>
                </div>
                <div class="quiz-info">
                    <div class="quiz-rating" @click="modal_rate_open = true">
                        {{ quiz.ratingAverage }} ⭐️ ({{ quiz.ratingCount }}
                        {{ $t("detail_QS.other.reviews") }})
                    </div>
                    <div class="quiz-tag-container">
                        <div
                            class="quiz-tag-item"
                            v-for="tag in quiz.tags"
                            @click="onRedirectToSearch(tag)"
                        >
                            {{ tag.name }}
                        </div>
                    </div>
                </div>
                <div v-if="permission.canEdit || permission.canDelete" class="quiz-credit">
                    <div class="share-btn-container">
                        <a-button
                            class="share-btn"
                            @click="openFolderModal"
                        >
                            <i class="bx bx-folder-plus"></i>
                            {{ $t("detail_QS.buttons.add_to_folder") }}
                        </a-button>
                    </div>
                    <div v-if="permission.canDelete" class="share-btn-container">
                        <a-button
                            type="primary"
                            class="main-color-btn share-btn"
                            @click="onOpenShareClassModal"
                        >
                            <i class="bx bx-share-alt"></i>
                            {{ $t("detail_QS.buttons.share_class") }}
                        </a-button>
                    </div>
                    <div v-if="permission.canDelete" class="share-btn-container">
                        <a-button
                            type="primary"
                            class="main-color-btn share-btn"
                            @click="onOpenShareModal"
                        >
                            <i class="bx bx-share-alt"></i>
                            {{ $t("detail_QS.buttons.share_quiz") }}
                        </a-button>
                    </div>
                </div>
                <div class="action-container">
                    <div class="credit-user">
                        <img class="user-image" :src="user_image" alt="" />
                        <div class="credit-user-info">
                            <span>
                                {{
                                    $t("detail_QS.other.created_by", {
                                        username: quiz.createBy,
                                    })
                                }}
                            </span>
                            <span>{{ dayjs(quiz.createdAt).format("DD/MM/YYYY") }}</span>
                        </div>
                    </div>
                    <div class="d-flex">
                        <div class="action-item" @click="onRedirectToLearn">
                            {{ $t("detail_QS.buttons.learn") }}
                            <i class="bx bx-analyse"></i>
                        </div>
                        <div class="action-item" @click="onRedirectToTest">
                            {{ $t("detail_QS.buttons.test") }}
                            <i class="bx bx-detail"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="content-item">
            <div class="content-item-title list-title">
                <div>
                    <span>
                        {{ $t("detail_QS.other.questions", { number: quiz_questions.length }) }}
                    </span>
                </div>
            </div>
            <div class="content-item-functions">
                <a-select
                    class="me-3"
                    v-model:value="selected_type_option"
                    style="width: 200px"
                    @change="onFilter"
                >
                    <a-select-option v-for="option in question_type_options" :value="option.value">
                        {{ option.label }}
                    </a-select-option>
                </a-select>

                <div style="width: 300px; padding: 0">
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
            <div v-if="loading">
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
            </div>
            <div v-else-if="questions.length === 0" class="w-100 d-flex justify-content-center">
                <a-empty :description="$t('detail_QS.other.no_questions_found')" />
            </div>
            <div v-else class="preview-question-container">
                <div class="preview-question-item" v-for="(question, index) in questions">
                    <div class="question-item-content">
                        <div class="d-flex pb-2">
                            <div class="question-index">{{ index + 1 }}</div>
                            <div
                                v-if="question.type === QUESTION_TYPE.LANGUAGE_FLASHCARD"
                                class="question-html flashcard-front"
                            >
                                {{ question.questionText }}
                            </div>
                            <RichContent
                                v-else
                                class="question-html"
                                :content="question.questionHTML || question.questionText"
                                :format="question.textFormat"
                            />
                        </div>
                        <QuestionMediaView :media="question.media" @reload="reloadQuestionMedia" />
                        <div
                            class="question-item-answer"
                            :id="`question-item-answer-${index}`"
                            style="display: none"
                        >
                            <template v-if="question.type === QUESTION_TYPE.MULTIPLE_CHOICE">
                                <div class="multiple-choice-answer">
                                    <ul>
                                        <li v-for="option in question.multipleChoices">
                                            <RichContent
                                                :content="option.text"
                                                :format="question.textFormat"
                                                inline
                                            />
                                            <span class="text-success" v-if="option.isAnswer">
                                                ({{ option.isAnswer }})
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.MATCHING">
                                <div class="pair-answer" v-for="option in question.matchingPairs">
                                    <span class="pair-answer-item">
                                        <RichContent
                                            :content="option.leftItem"
                                            :format="question.textFormat"
                                            inline
                                        />
                                    </span>
                                    <i class="bx bx-right-arrow-alt"></i>
                                    <span class="pair-answer-item">
                                        <RichContent
                                            :content="option.rightItem"
                                            :format="question.textFormat"
                                            inline
                                        />
                                    </span>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.ORDERING">
                                <div class="ordering-answer">
                                    <div class="ordering-answer-item">
                                        <div v-for="option in question.orderingItems">
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
                                            v-for="(option, index) in question.orderingItems.sort(
                                                (a, b) => a.correctOrder - b.correctOrder,
                                            )"
                                        >
                                            <span>#{{ index + 1 }}</span> -
                                            <RichContent
                                                :content="option.text"
                                                :format="question.textFormat"
                                                inline
                                            />
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.LANGUAGE_FLASHCARD">
                                <FlashcardBack :card="question.flashcard" show-source />
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.SHORT_TEXT">
                                <span>Answer:</span>
                                <div class="short-text-answer">
                                    <RichContent
                                        :content="question.shortAnswer"
                                        :format="question.textFormat"
                                        inline
                                    />
                                </div>
                            </template>
                        </div>
                    </div>
                    <div class="question-item-toogle-btn">
                        <i
                            class="bx bx-chevron-down"
                            @click="toggleDisplayAnswer(index, $event.currentTarget!)"
                        ></i>
                    </div>
                </div>
            </div>
            <a href="#top" class="up-button">
                <i class="bx bx-up-arrow-alt"></i>
            </a>
        </div>
    </div>

    <ShareModal
        v-if="!loading"
        ref="shareModalRef"
        :id="quiz.id"
        :name="quiz.name"
        :mode="'quiz'"
        :options="[VISIBILITY.PUBLIC, VISIBILITY.PRIVATE]"
        :visibility="quiz.visibilityMode"
    />

    <ShareModal
        ref="shareClassModalRef"
        :id="quiz.id"
        :name="quiz.name"
        :mode="'quiz'"
        :options="[VISIBILITY.IN_CLASS]"
        :visibility="VISIBILITY.IN_CLASS"
    />
    <a-modal wrap-class-name="medium-modal" :open="modal_rate_open">
        <div class="title-container">
            <a-row class="w-100 d-flex align-items-center justify-content-between">
                <a-col :span="1">
                    <div @click="modal_rate_open = false">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </div>
                </a-col>
                <a-col class="main-title" :span="20">
                    <span>{{ $t("detail_QS.modal.rate_title") }}</span> <br />
                </a-col>
            </a-row>
        </div>
        <div class="modal-rate-container">
            <a-rate v-model:value="rateValue" style="font-size: 40px" />
        </div>
        <template #footer>
            <a-button type="primary" class="main-color-btn" @click="updateRating">
                {{ $t("auth.buttons.send") }}
            </a-button>
        </template>
    </a-modal>
    <ShareToFolder ref="shareToFolderModalRef" @add-to-folder="onAddToFolder" />
</template>

<style scoped>
.flashcard-front {
    font-weight: 600;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.content-item {
    margin-left: 30px;
    padding: 20px 24px;
}

.content-item + .content-item {
    margin-top: 16px;
}

.navigator-back-link {
    margin-left: 30px;
    color: var(--c-text-muted);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
}

.navigator-back-link i {
    font-size: 24px;
    transform: translateY(1px);
    transition: all 0.2s ease-in-out;
}

.navigator-back-link:hover {
    color: var(--c-primary-text);
}

.navigator-back-link:hover i {
    transform: translate(-3px, 1px);
}

.content-item-title {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 24px;
    line-height: 1.3;
}

.content-item-title span:nth-child(2) {
    margin-top: 4px;
    font-size: 15px;
    line-height: 22px;
}

.content-item-title.list-title {
    margin-bottom: 4px;
    font-size: 20px;
}

.quiz-header-functions {
    flex: none;
    gap: 8px;
}

.quiz-header-functions i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 20px;
    color: var(--c-text-muted);
    background-color: var(--c-surface-raised);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    cursor: pointer;
    transition:
        color 0.15s ease,
        border-color 0.15s ease;
}

.quiz-header-functions i:hover {
    color: var(--c-primary-text);
    border-color: var(--main-color);
}

.quiz-header-functions i.text-danger {
    color: var(--c-danger-text) !important;
}

.quiz-header-functions i.text-danger:hover {
    border-color: var(--c-danger);
}

.quiz-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 16px;
}

.quiz-rating {
    width: fit-content;
    padding: 4px 10px;
    font-size: 14px;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-sm);
    color: var(--c-text-muted);
    transition: all 0.15s ease;
    cursor: pointer;
}

.quiz-rating:hover {
    border-color: var(--main-color);
    color: var(--c-text);
}

.quiz-tag-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.quiz-tag-item {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border: 1px solid transparent;
    border-radius: 999px;
    color: var(--c-primary-text);
    cursor: pointer;
    transition: all 0.15s ease;
}
.quiz-tag-item:hover {
    border-color: var(--main-color);
}

.quiz-credit {
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
}

.credit-user {
    display: flex;
    align-items: center;
    min-width: 0;
}

.user-image {
    width: 40px;
    height: 40px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: 50%;
    margin-right: 10px;
    object-fit: contain;
    padding: 3px;
}

.credit-user-info {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    line-height: 19px;
    color: var(--c-text-muted);
}

.action-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--content-item-border-color);
}

.action-container > .d-flex {
    gap: 12px;
}

.action-item {
    width: 240px;
    margin: 0px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    font-size: 15px;
    font-weight: 600;
    color: var(--c-text);
    transition: all 0.15s ease;
    cursor: pointer;
}

.action-item i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 22px;
    color: var(--c-primary-text);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-radius: var(--ui-r-sm);
}

.action-item:hover {
    border-color: var(--main-color);
    color: var(--c-primary-text);
}

.content-item-functions {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: end;
    flex-direction: row;
    margin: 8px 0px;
}

::v-deep(.ant-form-item-control-input-content) {
    width: 100%;
}

.share-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.share-btn i {
    font-size: 18px;
}

.share-btn:not(.ant-btn-primary) {
    color: var(--c-primary-text);
    background-color: transparent;
    border-color: transparent;
    box-shadow: none;
}

.share-btn:not(.ant-btn-primary):hover {
    color: var(--c-primary-text);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-color: transparent;
}

.preview-question-item {
    align-items: flex-start;
    gap: 6px;
    margin: 8px 0px;
    padding: 12px 14px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    transition: border-color 0.15s ease;
}

.preview-question-item:hover {
    border-color: var(--c-border-strong);
}

.preview-question-item .question-index {
    flex: none;
    width: 28px;
    height: 28px;
    margin-right: 10px;
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border: 0;
    border-radius: var(--ui-r-xs);
    color: var(--c-primary-text);
}

.question-item-content {
    flex: 1;
}

.question-item-toogle-btn {
    flex: none;
}

.question-item-toogle-btn i {
    width: 36px;
    height: 36px;
    padding: 0;
    align-items: center;
    font-size: 20px;
    color: var(--c-text-muted);
    background-color: var(--c-surface-raised);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    transition: all 0.15s ease;
}

.question-item-toogle-btn i:hover {
    color: var(--c-primary-text);
    border-color: var(--main-color);
}

.question-item-answer {
    margin-top: 8px;
    padding: 10px 0px 4px 38px;
    border-top: 1px dashed var(--content-item-border-color);
}

.multiple-choice-answer ul {
    padding-left: 18px;
}

.pair-answer-item,
.short-text-answer {
    background-color: var(--c-surface-raised);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-sm);
}

.up-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    font-size: 22px;
    border-radius: var(--ui-r-md);
    box-shadow: var(--ui-shadow-pop);
}

@media (max-width: 767.98px) {
    .quiz-credit {
        justify-content: flex-start;
    }

    .action-container {
        align-items: stretch;
    }

    .action-container > .d-flex {
        gap: 8px;
    }

    .action-item {
        flex: 1 1 0;
        min-width: 0;
        padding: 8px 10px 8px 12px;
    }

    .action-item i {
        flex: none;
        width: 32px;
        height: 32px;
    }

    .question-item-answer {
        padding-left: 0px;
    }
}

.modal-rate-container {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

::v-deep(.ant-rate-star-second) {
    color: var(--border-color);
}
</style>
