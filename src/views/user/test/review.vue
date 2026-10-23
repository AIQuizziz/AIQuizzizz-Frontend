<script setup lang="ts">
import ApiTest from "@/api/ApiTest";
import QUESTION_TYPE from "@/constants/questionTypes";
import TEST_STATUS from "@/constants/testStatus";
import type { RequestQuestion } from "@/models/request/question";
import type UserAnswerDTO from "@/models/response/test/userAnswerDTO";
import type { ResponseQuestion } from "@/models/response/question";
import ERROR from "@/constants/errors";
import Validator from "@/services/Validator";
import TransferQuestionData from "@/services/TransferQuestionData";
import TransferUserAnswerData from "@/services/TransferUserAnswerData";
import { mergeQuestionMedia } from "@/services/QuestionMediaService";
import QuestionMediaView from "@/shared/components/Media/QuestionMediaView.vue";
import RichContent from "@/shared/components/Common/RichContent.vue";

import { ref, onMounted, computed } from "vue";

import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { formatScore } from "@/services/QuestionValidator";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(false);

//#region sample
const reviewData = ref({
    attemptId: "",
    name: "",
    studentName: "NguyenTanDuc",
    timeStart: "",
    timeEnd: "",
    score: 0,
    status: "",
    questions: [],
});

//#endregion

//#region calculate UI

//preview uploaded content
const toggleDisplayAnswer = (index: number, button: EventTarget) => {
    let $button = $(button);

    $button.toggleClass("bx-chevron-up bx-chevron-down");

    const answer = $(`#question-item-answer-${index}`);
    if (answer) $(answer).slideToggle();
};

//calculate user answer
// Backend ẩn đáp án (còn lượt làm / không cho xem đáp án): isAnswer, matches, correctOrder, shortText = null
const isAnswerHidden = (question: any): boolean => {
    const data = question?.questionData ?? {};
    switch (question?.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE:
            return !(data.multipleChoice ?? []).some(
                (x: any) => x.isAnswer !== null && x.isAnswer !== undefined,
            );
        case QUESTION_TYPE.MATCHING:
            return !data.matching?.matches;
        case QUESTION_TYPE.ORDERING:
            return !(data.ordering ?? []).some(
                (x: any) => x.correctOrder !== null && x.correctOrder !== undefined,
            );
        case QUESTION_TYPE.SHORT_TEXT:
            return data.shortText === null || data.shortText === undefined;
        default:
            return false;
    }
};

const getUserAnswerMultipleChoice = (questionId: string, userData: any[]) => {
    if (!userData) return [];
    const question = questionData.value.find((x: any) => x.id === questionId);
    if (!question) return [];

    const result =
        (question.questionData?.multipleChoice ?? [])
            .filter((x: any) => userData.includes(x.id))
            .map((x: any) => ({
                id: x.id,
                text: x.text,
                isCorrect: x.isAnswer ?? null,
            })) ?? [];

    return result;
};

const getMatchingOption = (matchingData: any) => {
    if (!matchingData?.matches) return [];

    const matchingPairs = matchingData.matches.map((x: any) => ({
        leftItem: matchingData.leftItems.find((l: any) => l.id === x.leftId)?.text,
        rightItem: matchingData.rightItems.find((r: any) => r.id === x.rightId)?.text,
    }));

    return matchingPairs;
};

const getUserAnswerMatching = (questionId: string, userData: any) => {
    if (!userData) return [];
    const question = questionData.value.find((x: any) => x.id === questionId);
    if (!question) return [];

    const matches = question.questionData?.matching?.matches ?? null;
    const leftItems = question.questionData?.matching?.leftItems ?? [];
    const rightItems = question.questionData?.matching?.rightItems ?? [];

    const result =
        userData.map((x: any) => ({
            leftId: x.leftId,
            rightId: x.rightId,
            leftItem: leftItems.find((l: any) => l.id === x.leftId)?.text,
            rightItem: rightItems.find((r: any) => r.id === x.rightId)?.text,
            isCorrect: matches
                ? matches.some((m: any) => m.leftId === x.leftId && m.rightId === x.rightId)
                : null,
        })) ?? [];

    return result;
};

const getUserAnswerOrdering = (questionId: string, userData: any) => {
    if (!userData) return [];
    const question = questionData.value.find((x: any) => x.id === questionId);
    if (!question) return [];

    const ordering = question.questionData?.ordering ?? [];
    const result =
        userData.map((x: any) => ({
            itemId: x.itemId,
            order: x.order,
            text: ordering.find((o: any) => o.id === x.itemId)?.text,
            isCorrect: isAnswerHidden(question)
                ? null
                : ordering.some((o: any) => o.id === x.itemId && o.correctOrder === x.order),
        })) ?? [];

    return result;
};

const getTagColor = (status: string) => {
    switch (status) {
        case TEST_STATUS.PASSED: {
            return "#22C55E";
        }
        case TEST_STATUS.FAILED: {
            return "#cd201f";
        }
        default: {
            return "#F59E0B";
        }
    }
};

//#endregion

const attemptId = ref<string>(route.params.id as string);

const questionData = ref<any>([]);

const getData = async () => {
    try {
        loading.value = true;

        if (!Validator.isValidGuid(attemptId.value)) {
            router.push({ name: "404" });
            return;
        }
        const result = await ApiTest.GetAttemptReview(attemptId.value);
        if (result.data.success) {
            reviewData.value = result.data.data;
        }
    } catch (error: any) {
        if (Object.keys(error?.response?.data?.errors ?? {}).includes(ERROR.STUDENT_CAN_REVIEW_THIS_TEST)) {
            router.push({ name: "User_Class" });
            return;
        }
        if (error?.response && !error.response.data?.success) {
            router.push({ name: "404" });
        }
    } finally {
        loading.value = false;
    }
};
const emit = defineEmits(["updateSidebar"]);

onMounted(async () => {
    const sidebarActiveItem = "class";
    emit("updateSidebar", sidebarActiveItem);
    // questionData.value = reviewData.value.questions.map((x) => {
    //     const tranformedQuestion = TransferQuestionData.transformResponseToRequest({
    //         id: x.id,
    //         type: x.type as "ShortText" | "MultipleChoice" | "Matching" | "Ordering",
    //         questionSetId: "",
    //         textFormat: x.textFormat,
    //         questionText: x.questionText,
    //         explainText: "",
    //         score: x.score,
    //         scoreGraded: x.score,
    //         correctMultipleChoiceCount: 0,
    //         questionData: x.questionData,
    //     } as ResponseQuestion);

    //     return {
    //         ...tranformedQuestion,
    //         userAnswerDTO: x.userAnswerDataDto ?? null,
    //     };
    // });
    await getData();
    questionData.value = reviewData.value.questions;
});

// trả về bản copy đã sắp theo thứ tự đúng (không mutate dữ liệu gốc khi render)
type OrderingOption = { id: string; text: string; correctOrder: number };
const sortByCorrectOrder = (list?: OrderingOption[] | null): OrderingOption[] =>
    [...(list ?? [])].sort((a, b) => a.correctOrder - b.correctOrder);

// presigned URL của media hết hạn -> lấy URL mới, chỉ cập nhật media (không reset trang)
const reloadQuestionMedia = async () => {
    try {
        const result = await ApiTest.GetAttemptReview(attemptId.value);
        if (result?.data?.success) {
            mergeQuestionMedia(questionData.value, result.data.data.questions);
        }
    } catch (error) {
        console.log("ERROR: reload question media", error);
    }
};
</script>
<template>
    <div class="page-container">
        <div class="content-item">
            <div class="content-item-title">
                <span>Attempt info</span>
            </div>
            <div v-if="loading">
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
            </div>
            <template v-else>
                <a-row class="mb-2 d-flex align-items-center justify-content-between">
                    <a-col :span="12" class="test-info-item">
                        <div class="d-flex justify-content-between">
                            <span> Student name:</span>
                            <span>
                                {{ reviewData.studentName }}
                            </span>
                        </div>
                    </a-col>
                </a-row>
                <a-row class="mb-2 d-flex align-items-center justify-content-between">
                    <a-col :span="12" class="test-info-item">
                        <div class="d-flex justify-content-between">
                            <span> StartTime:</span>
                            <span>
                                {{ dayjs(reviewData.timeStart).format("DD/MM/YYYY HH:mm:ss") }}
                            </span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span> EndTime:</span>
                            <span>
                                {{ dayjs(reviewData.timeEnd).format("DD/MM/YYYY HH:mm:ss") }}
                            </span>
                        </div>
                    </a-col>
                </a-row>
                <a-row class="mb-2 d-flex align-items-center justify-content-between">
                    <a-col :span="12" class="test-info-item">
                        <div class="d-flex justify-content-between">
                            <span>Score:</span>
                            <span>
                                {{ formatScore(reviewData.score) }}
                            </span>
                        </div>
                    </a-col>
                </a-row>
                <a-row class="mb-2 d-flex align-items-center justify-content-between">
                    <a-col :span="12" class="test-info-item">
                        <div class="d-flex justify-content-between">
                            <span>Status:</span>
                            <a-tag :color="getTagColor(reviewData.status)">
                                {{ reviewData.status }}
                            </a-tag>
                        </div>
                    </a-col>
                </a-row>
            </template>
        </div>
        <div class="content-item">
            <div class="content-item-title">
                <div>
                    <span>{{
                        $t("detail_QS.other.questions", { number: questionData.length })
                    }}</span>
                </div>
            </div>

            <div v-if="loading">
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
            </div>
            <div v-else class="preview-question-container">
                <div class="preview-question-item" v-for="(question, index) in questionData">
                    <div class="d-flex align-items-center">
                        <div class="question-index">{{ index + 1 }}</div>
                    </div>
                    <div class="question-item-content">
                        <div class="d-flex align-items-center">
                            <RichContent
                                class="question-text"
                                :content="question.questionText"
                                :format="question.textFormat"
                            />
                        </div>
                        <QuestionMediaView :media="question.media" @reload="reloadQuestionMedia" />
                        <div class="question-item-answer" :id="`question-item-answer-${index}`">
                            <template v-if="question.type === QUESTION_TYPE.MULTIPLE_CHOICE">
                                <div class="question-data">
                                    <div v-if="!isAnswerHidden(question)" class="question-data-option">
                                        <div>Options:</div>
                                        <ul>
                                            <li
                                                v-for="option in question.questionData
                                                    .multipleChoice"
                                                :class="[option.isAnswer ? 'result-correct' : '']"
                                            >
                                                <RichContent
                                                    :content="option.text"
                                                    :format="question.textFormat"
                                                    inline
                                                />
                                            </li>
                                        </ul>
                                    </div>
                                    <div class="question-data-option user-answer">
                                        <div>User answer:</div>
                                        <ul v-if="question.userAnswerDataDto?.multipleChoice">
                                            <li
                                                v-for="option in getUserAnswerMultipleChoice(
                                                    question.id,
                                                    question.userAnswerDataDto?.multipleChoice,
                                                )"
                                                :class="[
                                                    option.isCorrect === null
                                                        ? ''
                                                        : option.isCorrect
                                                          ? 'result-correct'
                                                          : 'result-incorrect',
                                                ]"
                                            >
                                                <RichContent
                                                    :content="option.text"
                                                    :format="question.textFormat"
                                                    inline
                                                />
                                            </li>
                                        </ul>
                                        <div v-else class="result-skipped">No answer</div>
                                    </div>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.MATCHING">
                                <div class="question-data">
                                    <div v-if="!isAnswerHidden(question)" class="question-data-option">
                                        <div>Options:</div>
                                        <div
                                            class="pair-answer"
                                            v-for="option in getMatchingOption(
                                                question.questionData.matching,
                                            )"
                                        >
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
                                    </div>
                                    <div class="question-data-option user-answer">
                                        <div>User answer:</div>
                                        <template v-if="question.userAnswerDataDto?.matching">
                                            <div
                                                :class="[
                                                    'pair-answer',
                                                    option.isCorrect === false
                                                        ? 'pair-answer-incorrect'
                                                        : '',
                                                    option.isCorrect === null
                                                        ? 'pair-answer-neutral'
                                                        : '',
                                                ]"
                                                v-for="option in getUserAnswerMatching(
                                                    question.id,
                                                    question.userAnswerDataDto?.matching,
                                                )"
                                            >
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
                                        <div v-else class="result-skipped">No answer</div>
                                    </div>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.ORDERING">
                                <div class="question-data">
                                    <div v-if="!isAnswerHidden(question)" class="question-data-option">
                                        <div>Options:</div>
                                        <div class="ordering-answer">
                                            <div class="ordering-answer-item">
                                                <div
                                                    class="ordering-answer-item"
                                                    v-for="(option, index) in sortByCorrectOrder(
                                                        question.questionData.ordering,
                                                    )"
                                                >
                                                    <span class="result-correct"
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
                                    </div>
                                    <div class="question-data-option">
                                        <div>User answer:</div>
                                        <div
                                            v-if="question.userAnswerDataDto?.ordering"
                                            class="ordering-answer"
                                        >
                                            <div class="ordering-answer-item">
                                                <div
                                                    v-for="(option, index) in getUserAnswerOrdering(
                                                        question.id,
                                                        question.userAnswerDataDto?.ordering,
                                                    )"
                                                    :class="[
                                                        'ordering-answer-item',
                                                        option.isCorrect === null
                                                            ? ''
                                                            : option.isCorrect
                                                              ? 'result-correct'
                                                              : 'result-incorrect',
                                                    ]"
                                                >
                                                    <span v-if="option.isCorrect !== null"
                                                        >#{{ index + 1 }} -</span
                                                    >
                                                    <span v-else>{{ index + 1 }}.</span>
                                                    <RichContent
                                                        :content="option.text"
                                                        :format="question.textFormat"
                                                        inline
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else class="result-skipped">No answer</div>
                                    </div>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.SHORT_TEXT">
                                <div class="question-data">
                                    <div v-if="!isAnswerHidden(question)" class="question-data-option">
                                        <div>Option:</div>
                                        <div class="short-text-answer">
                                            <RichContent
                                                :content="question.questionData.shortText"
                                                :format="question.textFormat"
                                                inline
                                            />
                                        </div>
                                    </div>
                                    <div class="question-data-option">
                                        <div>User answer:</div>
                                        <div
                                            v-if="question.userAnswerDataDto?.shortText"
                                            class="short-text-answer"
                                        >
                                            <RichContent
                                                :content="question.userAnswerDataDto?.shortText"
                                                format="PlainText"
                                                inline
                                            />
                                        </div>
                                        <div v-else class="result-skipped">No answer</div>
                                    </div>
                                </div>
                            </template>
                        </div>
                        <div v-if="!isAnswerHidden(question)">
                            Score:
                            <span
                                :class="[
                                    Number(question.score) > 0 ? 'result-correct' : 'result-incorrect',
                                ]"
                            >
                                {{ formatScore(question.score) }}
                            </span>
                        </div>
                    </div>
                    <div class="question-item-toogle-btn">
                        <i
                            class="bx bx-chevron-up"
                            @click="toggleDisplayAnswer(index, $event.currentTarget!)"
                        ></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
.content-item {
    width: auto;
    padding: 20px;
}

.content-item-title {
    font-size: 20px;
}

.test-info-item {
    padding: 8px 0px;
    font-size: 14px;
    border-bottom: 1px solid var(--content-item-border-color);
}

.test-info-item span:nth-child(1) {
    font-weight: 500;
    color: var(--c-text-muted);
}

.test-info-item span:nth-child(2) {
    font-weight: 600;
}

.test-info-item .ant-tag {
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
}

.preview-question-item {
    padding: 16px;
    margin: 12px 0px;
    background-color: var(--c-surface-subtle);
    border-color: var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}

.question-index {
    border: 0;
    border-radius: var(--ui-r-xs);
    font-weight: 600;
}

.question-item-toogle-btn i {
    width: 36px;
    height: 36px;
    align-items: center;
    border-color: var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}

.question-item-toogle-btn i:hover {
    border-color: var(--main-color);
    color: var(--c-primary-text);
}

.question-item-answer {
    margin: 12px 0px;
    border-top: 1px solid;
    border-bottom: 1px solid;
    border-color: var(--content-item-border-color);
    padding: 12px 0px;
}

.question-data {
    display: flex;
}

.question-data-option {
    margin-right: 50px;
}

.question-data-option > div:first-child {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text-muted);
}

.question-data-option ul {
    margin: 6px 0px 0px;
    padding: 0;
    list-style: none;
}

.question-data-option li,
.ordering-answer-item .ordering-answer-item,
.short-text-answer {
    padding: 8px 12px;
    margin: 6px 0px 0px;
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}

.question-data-option li.result-correct,
.ordering-answer-item .ordering-answer-item.result-correct,
.pair-answer .pair-answer-item {
    color: var(--c-success-text);
    background-color: color-mix(in srgb, var(--c-success) 14%, var(--c-surface));
    border-color: var(--c-success);
}

.question-data-option li.result-incorrect,
.ordering-answer-item .ordering-answer-item.result-incorrect,
.pair-answer-incorrect .pair-answer-item {
    color: var(--c-danger-text);
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
    border-color: var(--c-danger);
}

.pair-answer .pair-answer-item {
    border-radius: var(--ui-r-md);
}

.pair-answer i {
    color: var(--c-success-text);
}

.pair-answer-incorrect i {
    color: var(--c-danger-text);
}

@media (max-width: 767.98px) {
    .question-data {
        flex-direction: column;
        gap: 10px;
    }
    .question-data-option {
        margin-right: 0;
        min-width: 0;
        max-width: 100%;
    }
    .ordering-answer {
        flex-wrap: wrap;
    }
}

/* đáp án đang bị ẩn: hiển thị trung tính, không tô xanh/đỏ */
.pair-answer-neutral .pair-answer-item {
    color: var(--c-text);
    background-color: var(--c-surface);
    border-color: var(--content-item-border-color);
}

.pair-answer-neutral i {
    color: var(--c-text-muted);
}
</style>
