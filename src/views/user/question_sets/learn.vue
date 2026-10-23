<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";
import type { ResponseQuestion } from "@/models/response/question";
import type { Comment } from "@/models/response/comment/comment";
import type CommentPageParams from "@/models/request/comment/commentPageParams";
import ERROR from "@/constants/errors";

import { ref, computed, onMounted, nextTick, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";

import QUESTION_TYPE from "@/constants/questionTypes";
import { QUOTES } from "@/constants/quote";

import TextArea from "@/shared/components/Common/TextArea.vue";
import { VueDraggable } from "vue-draggable-plus";
import { HolderOutlined, CloseSquareFilled } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import Validator from "@/services/Validator";
import { mergeQuestionMedia } from "@/services/QuestionMediaService";
import QuestionMediaView from "@/shared/components/Media/QuestionMediaView.vue";
import RichContent from "@/shared/components/Common/RichContent.vue";
import UserAvatar from "@/shared/components/Common/UserAvatar.vue";
import FlashcardAnswerCard from "@/shared/components/Flashcard/FlashcardAnswerCard.vue";
import dayjs from "dayjs";

import { DotLottieVue } from "@lottiefiles/dotlottie-vue";
const animationPath = new URL("@/assets/confetti.lottie", import.meta.url).href;

import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/AuthStore";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

interface LearnQuizModel {
    title: string;
    description: string;
    completedQuestionCount: number;
    totalQuestionCount: number;
    questions: ResponseQuestion[];
}

const quiz = ref<LearnQuizModel>({
    title: "",
    description: "",
    completedQuestionCount: 0,
    totalQuestionCount: 0,
    questions: [],
});

const questionSetId = ref(route.params.id);
const loading = ref(false);
const isAllowed = ref(true);
const getQuizData = async () => {
    loading.value = true;
    if (!Validator.isValidGuid(questionSetId.value.toString())) {
        router.push({ name: "404" });
        return;
    }
    try {
        let detail_result = await ApiQuestionSet.GetDetailById(questionSetId.value.toString());
        let result = await ApiQuestionSet.LearnQuestions(questionSetId.value.toString(), 7);

        if (!detail_result.data.success || !result.data.success) {
            router.push({ name: "404" });
            return;
        }
        quiz.value = result.data.data;
        if (quiz.value.completedQuestionCount === quiz.value.totalQuestionCount) {
            openCompleteModal();
            return;
        }

        quiz.value.title = detail_result.data.data.name;
        quiz.value.description = detail_result.data.data.description;

        currentSession.value = [...quiz.value.questions];
        currentQuestion.value = currentSession.value[0];
        currentSession.value.shift();
    } catch (error: any) {
        const errorKeys = Object.keys(error?.response?.data?.errors ?? {});
        if (errorKeys.includes(ERROR.PLAN_REQUIRE_PLAN)) {
            isAllowed.value = false;
            router.back();
        } else if (errorKeys.includes(ERROR.QUESTION_SET_NOT_FOUND)) {
            router.replace({ name: "404" });
        } else {
            // bộ câu hỏi đã bị xoá / không truy cập được: toast lỗi đã hiện ở interceptor -> về thư viện
            router.replace({ name: "User_Library" });
        }
    } finally {
        loading.value = false;
    }
};

// presigned URL của media hết hạn -> lấy URL mới, chỉ cập nhật media (giữ nguyên tiến trình học)
const reloadQuestionMedia = async () => {
    try {
        const result = await ApiQuestionSet.GetQuestionById(questionSetId.value.toString());
        if (result?.data?.success) {
            mergeQuestionMedia(
                [
                    ...quiz.value.questions,
                    ...currentSession.value,
                    ...completed.value,
                    currentQuestion.value,
                ],
                result.data.data,
            );
        }
    } catch (error) {
        console.log("ERROR: reload question media", error);
    }
};

const totalCompleted = ref(quiz.value.completedQuestionCount); //for total

const completed = ref<ResponseQuestion[]>([]); // for session

const incorrect = ref<Set<ResponseQuestion>>(new Set()); // for session

const currentSession = ref<ResponseQuestion[]>([]); // for session
const isCurrentSessionReLearn = ref(false); //to check whether current session re-learn incorrect

const currentQuestion = ref<ResponseQuestion>({} as ResponseQuestion);

const currentQuestionInstruction = ref("");
const currentQuestionIsSubmitted = ref(false);
const currentQuestionIsSkipped = ref(false);

const userAnswerMultipleChoice = ref<string[]>([]);

/* adjust multiple choice layout */
const isOptionExceed = computed(() => {
    return currentQuestion.value.questionData.multipleChoice?.some((x) => x.text.length >= 100);
});

const userAnswerMatchingLeft = ref<any[]>([]);
const userAnswerMatchingRight = ref<any[]>([]);

const userAnswerOrdering = ref<any[]>([]);
const userAnswerShortText = ref<string>("");

const currentQuestionResult = ref({
    result: false,
    resultText: t("learn_QS.result.wrong"),
});

const completionPercentage = computed(() => {
    return Math.floor((quiz.value.completedQuestionCount / quiz.value.totalQuestionCount) * 100);
});

//#region check user answer
const checkMultipleChoice = () => {
    let correctAnswer = currentQuestion.value.questionData.multipleChoice
        ?.filter((x) => x.isAnswer)
        .map((x) => x.id || [])
        .sort();

    let sortedUserAnswer = userAnswerMultipleChoice.value.sort();
    if (userAnswerMultipleChoice.value.length !== correctAnswer?.length) return false;
    return sortedUserAnswer.every((value: string, i: number) => value === correctAnswer[i]);
};

/* use this for checking answer after submit */
const checkMultipleChoiceAnswerCorrect = (option: any) => {
    //only 2 cases allowed to display result: correct and user_answer + incorrect

    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);
    let correctAnswer = quiz.value.questions[index].questionData.multipleChoice
        ?.filter((x) => x.isAnswer)
        .map((x) => x.id || []);

    let user_answer = userAnswerMultipleChoice.value;

    if (correctAnswer?.includes(option.id)) return true; //case 1
    if (user_answer?.includes(option.id) && !option.isAnswer) return false; //case 2

    return true;
};

const checkOrdering = () => {
    let correctAnswer =
        currentQuestion.value.questionData.ordering?.map((x) => x.correctOrder).sort() || [];

    let userAnswer = userAnswerOrdering.value.map((x) => x.correctOrder);
    return userAnswer.every((value: number, i: number) => value === correctAnswer[i]);
};

const checkMatching = () => {
    let correctMatch = currentQuestion.value.questionData.matching!.matches;

    let userAnswerLeft = userAnswerMatchingLeft.value.map((x) => x.id);
    let userAnswerRight = userAnswerMatchingRight.value.map((x) => x.id);

    let userAnswerMatches = userAnswerLeft.map((leftId: string, i: number) => ({
        leftId,
        rightId: userAnswerRight[i] as string,
    }));

    return userAnswerMatches.every((item: any) =>
        correctMatch.some((x) => x.leftId === item.leftId && x.rightId === item.rightId),
    );
};

const checkMatchingAnswerCorrect = (id: string) => {
    const matching = currentQuestion.value.questionData.matching;
    if (!matching) return false;

    let isLeft = matching.leftItems.some((x) => x.id === id);

    let correctMatch = matching.matches.find((x) => (isLeft ? x.leftId === id : x.rightId === id));

    const index = isLeft
        ? userAnswerMatchingLeft.value.findIndex((x) => x.id === id)
        : userAnswerMatchingRight.value.findIndex((x) => x.id === id);

    if (index === -1 || !correctMatch) return false;

    return isLeft
        ? userAnswerMatchingRight.value[index]?.id === correctMatch.rightId
        : userAnswerMatchingLeft.value[index]?.id === correctMatch.leftId;
};

const cleanShortTextAnswer = (text: string) => {
    return text
        .trim()
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[\u2019\u2018\u201B\u0060]/g, "'")
        .replace(/\s+/g, " ");
};

const checkShortText = () => {
    return (
        cleanShortTextAnswer(userAnswerShortText.value) ===
        cleanShortTextAnswer(currentQuestion.value.questionData.shortText)
    );
};

//#endregion

//#region explain modal
/* explain modal bottom */
const explainModal = ref<HTMLElement | null>(null);
const explainModalOpen = ref(false);
const toggleExplainModal = () => {
    explainModalOpen.value = !explainModalOpen.value;
};

//#endregion

//#region comment modal
/* comment modal right */
const commentModalOpen = ref(false);

const user_info = authStore.getUserInfo();
const currentQuestionComments = ref<Comment[]>([]);
const commentValue = ref("");

const chosenComment = ref<Comment | null>(null); // use this for reply
const isReplying = ref(false);

const commentPageParams = reactive({
    pageNumber: 1,
    pageSize: 10,
    questionId: "",
});
const commentLoading = ref(false);
const commentTotalPage = ref(1);
const getCommentData = async () => {
    commentLoading.value = true;
    const result = await ApiComment.GetAllByQuestionId(commentPageParams as CommentPageParams);
    if (result.data.success) {
        currentQuestionComments.value = result.data.data.items.filter((x: Comment) => !x.parentId);
        commentTotalPage.value = result.data.data.totalPages;
    }
    commentLoading.value = false;
};

const onAddComment = async () => {
    if (commentLoading.value || !commentValue.value?.trim()) return;
    try {
        commentLoading.value = true;
        let result;
        if (isReplying.value && chosenComment.value) {
            result = await ApiComment.Reply({
                commentId: chosenComment.value.id,
                content: commentValue.value,
            });
        } else {
            result = await ApiComment.Create({
                questionId: currentQuestion.value.id,
                content: commentValue.value,
            });
        }

        if (result.data.success) {
            message.success(t("message.added_successfully"));
            // reset ô nhập + trạng thái reply để bấm lần 2 không gửi trùng
            onCancelReplying();
            await getCommentData();
            return;
        }
        message.error(t("message.added_failed"));
    } catch (error) {
        console.log(error);
    } finally {
        commentLoading.value = false;
    }
};

const onEditComment = async (commentId: string) => {
    // const result = await ApiComment.Delete(commentId);
    // if (result.data.success) {
    //     message.success("Delete successfully!");
    //     await getCommentData();
    //     return;
    // }
    // message.success("Delete failed!");
};
const onDeleteComment = async (commentId: string) => {
    const result = await ApiComment.Delete(commentId);
    if (result.data.success) {
        message.success(t("message.deleted_successfully"));
        await getCommentData();
        return;
    }
    message.error(t("message.deleted_failed"));
    onCancelReplying();
};

const onTriggerReply = (comment: Comment) => {
    isReplying.value = true;
    chosenComment.value = comment;
};

const onCancelReplying = () => {
    commentValue.value = "";
    isReplying.value = false;
    chosenComment.value = null;
};

const repliesOpen = ref<boolean[]>([]);
const onToggleReplyContainer = (index: number) => {
    repliesOpen.value[index] = !repliesOpen.value[index];
    $(`#reply-items-${index}`).slideToggle();
};

const onLoadMoreComment = async () => {
    if (commentPageParams.pageNumber < commentTotalPage.value) commentPageParams.pageNumber += 1;

    commentLoading.value = true;

    const result = await ApiComment.GetAllByQuestionId(commentPageParams);
    if (result.data.success) {
        const newData = result.data.data.items.filter((x: Comment) => !x.parentId);
        currentQuestionComments.value = [...currentQuestionComments.value, ...newData];
    }

    commentLoading.value = false;
};

const onOpenCommentModal = async () => {
    commentModalOpen.value = true;
    //get api comment
    commentPageParams.questionId = currentQuestion.value.id;
    await getCommentData();
};

const onCloseCommentModal = () => {
    commentModalOpen.value = false;
    //reset comment list
};
//#endregion

//#region logic complete question
/* handle logic complete question */
const sendCorrectQuestionHistory = () => {
    ApiQuestionSet.LearnHistory(questionSetId.value.toString(), [
        {
            questionId: currentQuestion.value.id,
            isCorrect: true,
        },
    ]);
};

const onSubmitAnswer = () => {
    toggleExplainModal();
    currentQuestionIsSubmitted.value = true;

    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            currentQuestionResult.value = {
                result: checkMultipleChoice(),
                resultText: checkMultipleChoice()
                    ? t("learn_QS.result.correct")
                    : t("learn_QS.result.wrong"),
            };
            break;
        }
        case QUESTION_TYPE.ORDERING: {
            currentQuestionResult.value = {
                result: checkOrdering(),
                resultText: checkOrdering()
                    ? t("learn_QS.result.correct")
                    : t("learn_QS.result.wrong"),
            };
            break;
        }
        case QUESTION_TYPE.MATCHING: {
            currentQuestionResult.value = {
                result: checkMatching(),
                resultText: checkMatching()
                    ? t("learn_QS.result.correct")
                    : t("learn_QS.result.wrong"),
            };
            break;
        }
        case QUESTION_TYPE.SHORT_TEXT: {
            currentQuestionResult.value = {
                result: checkShortText(),
                resultText: checkShortText()
                    ? t("learn_QS.result.correct")
                    : t("learn_QS.result.wrong"),
            };
            break;
        }
    }

    const isCorrect = currentQuestionResult.value.result;
    const isReLearn = isCurrentSessionReLearn.value;
    const question = currentQuestion.value;

    //if hasn't re-tried and has incorrect
    if (!isCorrect) {
        incorrect.value.add(question);
    } else {
        if (isReLearn) {
            incorrect.value.delete(question);
        }
        //if re-tried and correct send it or correct
        completed.value.push(question);
        quiz.value.completedQuestionCount++;
        sendCorrectQuestionHistory();
    }

    triggerFinalModal();
};

const onSkipQuestion = (event: MouseEvent) => {
    toggleExplainModal();

    //change result
    currentQuestionIsSubmitted.value = true;
    currentQuestionIsSkipped.value = true;

    currentQuestionResult.value = {
        result: false,
        resultText: t("learn_QS.result.skipped"),
    };
    //false by default
    incorrect.value.add(currentQuestion.value);

    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            userAnswerMultipleChoice.value = currentQuestion.value.questionData.multipleChoice
                ?.filter((x) => x.isAnswer)
                .map((x) => x.id)!;
            break;
        }

        //reset to let user know the correct answer if skip
        case QUESTION_TYPE.MATCHING: {
            const matching = currentQuestion.value.questionData.matching;
            const matches = matching?.matches ?? [];
            const leftItems = matching?.leftItems ?? [];
            const rightItems = matching?.rightItems ?? [];

            const matchingLeft = matches.map((match: any) =>
                leftItems.find((item: any) => item.id == match.leftId),
            );
            const matchingRight = matches.map((match: any) =>
                rightItems.find((item: any) => item.id == match.rightId),
            );

            userAnswerMatchingLeft.value = matchingLeft;
            userAnswerMatchingRight.value = matchingRight;
            break;
        }

        case QUESTION_TYPE.ORDERING: {
            userAnswerOrdering.value = userAnswerOrdering.value.sort(
                (asc, desc) => asc.correctOrder - desc.correctOrder,
            );
            break;
        }

        case QUESTION_TYPE.SHORT_TEXT: {
            userAnswerShortText.value = currentQuestion.value.questionData.shortText;
            break;
        }
    }
    triggerFinalModal();
};

const resetUserAnswer = () => {
    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            currentQuestionInstruction.value = t("learn_QS.instructions.multiple_choice", {
                number: currentQuestion.value.questionData.multipleChoice?.filter((x) => x.isAnswer)
                    .length,
            });
            userAnswerMultipleChoice.value = [];
            break;
        }
        case QUESTION_TYPE.ORDERING: {
            currentQuestionInstruction.value = t("learn_QS.instructions.ordering");
            userAnswerOrdering.value = currentQuestion.value.questionData.ordering!;
            break;
        }
        case QUESTION_TYPE.MATCHING: {
            currentQuestionInstruction.value = t("learn_QS.instructions.matching");
            userAnswerMatchingLeft.value = currentQuestion.value.questionData.matching!.leftItems;
            userAnswerMatchingRight.value = currentQuestion.value.questionData.matching!.rightItems;
            break;
        }
        case QUESTION_TYPE.SHORT_TEXT: {
            currentQuestionInstruction.value = t("learn_QS.instructions.short_text");
            userAnswerShortText.value = "";
            break;
        }
    }
};

const onNextQuestion = () => {
    syncMatchingHeights();
    triggerFinalModal();
    if (currentSession.value.length <= 0) return;

    currentQuestion.value = currentSession.value.shift()!;

    currentQuestionIsSubmitted.value = false;
    currentQuestionIsSkipped.value = false;

    resetUserAnswer();
    toggleExplainModal(); // turn off explain modal
};
//#endregion

//#region final modal
/* final modal full screen */

const finalModalOpen = ref(false);
const finalModalQuote = ref("");
const openFinalModal = () => {
    finalModalQuote.value = t(
        `learn_QS.final_modal.quotes.${QUOTES[Math.floor(Math.random() * QUOTES.length)].id}`,
    );

    setTimeout(() => {
        finalModalOpen.value = true;
    }, 1000);
};

const closeFinalModal = () => {
    finalModalOpen.value = false;
};

const triggerFinalModal = async () => {
    if (currentSession.value.length > 0) return;

    const hasIncorrect = incorrect.value.size > 0;
    //has incorrect and hasn't re-learned
    //append 1st incorrect question - re-try incorrect
    if (hasIncorrect && !isCurrentSessionReLearn.value) {
        isCurrentSessionReLearn.value = true;
        currentSession.value = Array.from(incorrect.value);
        return;
    }

    if (!hasIncorrect || isCurrentSessionReLearn.value) {
        if (hasIncorrect) {
            // re-tried - send 2nd incorrects to backend
            const learnHistory = quiz.value.questions
                .filter((x) => incorrect.value.has(x))
                .map((x) => ({
                    questionId: x.id,
                    isCorrect: false,
                }));

            await ApiQuestionSet.LearnHistory(questionSetId.value.toString(), learnHistory);
        }

        openFinalModal();
    }
};

//preview completed question in final modal
const toggleDisplayAnswer = (index: number, button: EventTarget) => {
    let $button = $(button);

    $button.toggleClass("bx-chevron-down bx-chevron-up");

    const answer = $(`#question-item-answer-${index}`);
    if (answer) $(answer).slideToggle();
};
const onContinuesLearn = async () => {
    if (quiz.value.completedQuestionCount === quiz.value.totalQuestionCount) {
        closeFinalModal();
        openCompleteModal();
        return;
    }

    await startNewSession();
};

// nạp phiên mới từ server và đưa trạng thái học về đầu phiên
const startNewSession = async () => {
    await getQuizData();

    isCurrentSessionReLearn.value = false;
    currentQuestionIsSkipped.value = false;
    currentQuestionIsSubmitted.value = false;
    currentQuestionInstruction.value = "";
    finalModalOpen.value = false;
    incorrect.value = new Set();
    completed.value = [];

    explainModalOpen.value = false; // gán thẳng: lúc mở trang khi đã học hết thì giải thích đang đóng sẵn

    resetUserAnswer();
    syncMatchingHeights();
};

//#endregion

//#region complete modal
import trophy_png from "@/assets/trophy.png";
import ApiComment from "@/api/ApiComment";
const completeModalOpen = ref(false);

const openCompleteModal = () => {
    completeModalOpen.value = true;
    triggerAnimation();
};

const animationRef = ref();
const isAnimationDisplaying = ref(false);

const triggerAnimation = () => {
    isAnimationDisplaying.value = true;
    animationRef.value?.getDotLottieInstance()?.play();
    setTimeout(() => {
        isAnimationDisplaying.value = false;
    }, 5000);
};

const onResetLearnHistory = async () => {
    const result = await ApiQuestionSet.resetLearnHistory(questionSetId.value.toString());
    if (result.data.success) {
        message.success(t("learn_QS.msg.learn_mode_reset"));
        completeModalOpen.value = false;
        await startNewSession(); // học lại từ đầu tại chỗ, không reload cả trang
    }
};

//#endregion

//#region calculate UI
const dragOptions = {
    scroll: true,
    scrollSensitivity: 100,
    scrollSpeed: 100,
    scrollTarget: document.scrollingElement,
};

function syncMatchingHeights() {
    nextTick(() => {
        requestAnimationFrame(() => {
            const leftItems = document.querySelectorAll(
                ".matching-option-container.left .answer-option-matching",
            );
            const rightItems = document.querySelectorAll(
                ".matching-option-container.right .answer-option-matching",
            );

            const count = Math.min(leftItems.length, rightItems.length);

            for (let i = 0; i < count; i++) {
                const left = leftItems[i] as HTMLElement;
                const right = rightItems[i] as HTMLElement;

                if (!left || !right) continue;

                left.style.height = "auto";
                right.style.height = "auto";

                const maxHeight = Math.max(left.offsetHeight, right.offsetHeight);

                left.style.height = `${maxHeight}px`;
                right.style.height = `${maxHeight}px`;
            }
        });
    });
}
//#endregion

const onRedirectToSubcription = () => {
    sessionStorage.setItem("setting_key", "Subscription");
    router.push({ name: "User_Settings" });
};

const onRedirectToTest = () => {
    router.push({ name: "User_QuestionSet_Test", params: { id: questionSetId.value } });
};

const onRedirectToLibrary = () => {
    router.push({ name: "User_Library" });
};
onMounted(async () => {
    await getQuizData();

    resetUserAnswer();
    syncMatchingHeights();
    window.addEventListener("resize", syncMatchingHeights);

    repliesOpen.value = currentQuestionComments.value.map(() => false); //reply close all at beginning
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
                    <span>{{ quiz.title }}</span> <br />
                    <span>{{ quiz.description }}</span>
                </a-col>
            </a-row>
        </div>

        <template v-if="loading">
            <a-skeleton :loading="loading"></a-skeleton>
        </template>
        <div v-else class="progress-bar-container">
            <div class="progress-info">
                <div class="progress-info-number">
                    {{
                        $t("learn_QS.other.progress_count", {
                            current: quiz.completedQuestionCount,
                            total: quiz.totalQuestionCount,
                        })
                    }}
                </div>
                <div class="progress-info-percentage">
                    <span>{{ completionPercentage }}</span>
                    %
                    {{ $t("learn_QS.other.completed") }}
                </div>
            </div>
            <a-progress
                :show-info="false"
                stroke-color="var(--main-color)"
                :percent="completionPercentage"
            />
        </div>

        <div class="content">
            <div class="content-item">
                <template v-if="loading">
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                </template>
                <template v-else>
                    <div class="section question-section">
                        <RichContent
                            class="learn-question html"
                            :content="currentQuestion.questionText"
                            :format="currentQuestion.textFormat"
                        />
                        <QuestionMediaView
                            :media="currentQuestion.media"
                            @reload="reloadQuestionMedia"
                        />
                        <div class="section answer-section">
                            <div v-if="isCurrentSessionReLearn" class="relearn-ins">
                                {{ $t("learn_QS.instructions.re_learn_ins") }}
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="answer-section-ins">
                                    {{ currentQuestionInstruction }}
                                </div>
                                <div
                                    :class="[
                                        'ms-3 learn-question-result',
                                        !currentQuestionIsSubmitted ? 'd-none' : '',
                                        currentQuestionIsSubmitted
                                            ? currentQuestionResult.result
                                                ? 'result-correct'
                                                : 'result-incorrect'
                                            : '',
                                        currentQuestionIsSkipped ? 'result-skipped' : '',
                                    ]"
                                >
                                    {{ currentQuestionResult.resultText }}
                                </div>
                            </div>
                            <template v-if="currentQuestion.type === QUESTION_TYPE.MULTIPLE_CHOICE">
                                <a-checkbox-group
                                    v-model:value="userAnswerMultipleChoice"
                                    :class="[
                                        'answer-option-container multiplechoice',
                                        isOptionExceed ? 'column' : '',
                                    ]"
                                >
                                    <template
                                        v-for="option in currentQuestion.questionData
                                            .multipleChoice"
                                    >
                                        <a-checkbox
                                            v-model:value="option.id"
                                            :disabled="currentQuestionIsSubmitted"
                                            :class="[
                                                'answer-option answer-option-multiplechoice',
                                                currentQuestionIsSubmitted &&
                                                checkMultipleChoiceAnswerCorrect(option) &&
                                                option.isAnswer
                                                    ? 'answer-correct'
                                                    : '',
                                                currentQuestionIsSubmitted &&
                                                !checkMultipleChoiceAnswerCorrect(option) &&
                                                !option.isAnswer
                                                    ? 'answer-incorrect'
                                                    : '',
                                            ]"
                                        >
                                            <div class="answer-option-content">
                                                <RichContent
                                                    :content="option.text"
                                                    :format="currentQuestion.textFormat"
                                                    inline
                                                />
                                            </div>

                                            <i
                                                v-if="
                                                    currentQuestionIsSubmitted &&
                                                    checkMultipleChoiceAnswerCorrect(option) &&
                                                    option.isAnswer
                                                "
                                                class="bx bx-check answer-icon"
                                            ></i>
                                            <i
                                                v-if="
                                                    currentQuestionIsSubmitted &&
                                                    !checkMultipleChoiceAnswerCorrect(option) &&
                                                    !option.isAnswer
                                                "
                                                class="bx bx-x answer-icon"
                                            ></i>
                                        </a-checkbox>
                                    </template>
                                </a-checkbox-group>
                            </template>

                            <template v-if="currentQuestion.type === QUESTION_TYPE.MATCHING">
                                <div class="answer-option-container matching">
                                    <div class="matching-option-container left">
                                        <VueDraggable
                                            :disabled="currentQuestionIsSubmitted"
                                            v-model="userAnswerMatchingLeft"
                                            :options="dragOptions"
                                            @end="syncMatchingHeights"
                                        >
                                            <template
                                                v-for="(option, index) in userAnswerMatchingLeft"
                                            >
                                                <div class="d-flex align-items-center">
                                                    <div
                                                        :class="[
                                                            'answer-option answer-option-matching',
                                                            currentQuestionIsSubmitted
                                                                ? checkMatchingAnswerCorrect(
                                                                      option.id,
                                                                  )
                                                                    ? 'answer-correct'
                                                                    : 'answer-incorrect'
                                                                : '',
                                                        ]"
                                                    >
                                                        <div class="answer-option-order">
                                                            <HolderOutlined />
                                                        </div>
                                                        <div class="answer-option-content">
                                                            <RichContent
                                                                :content="option.text"
                                                                :format="currentQuestion.textFormat"
                                                                inline
                                                            />
                                                        </div>
                                                    </div>
                                                    <i
                                                        :class="[
                                                            'bx bxs-label matching-icon',
                                                            currentQuestionIsSubmitted
                                                                ? checkMatchingAnswerCorrect(
                                                                      option.id,
                                                                  )
                                                                    ? 'answer-correct-icon'
                                                                    : 'answer-incorrect-icon'
                                                                : '',
                                                        ]"
                                                    ></i>
                                                </div>
                                            </template>
                                        </VueDraggable>
                                    </div>
                                    <div class="matching-option-container right">
                                        <VueDraggable
                                            :disabled="currentQuestionIsSubmitted"
                                            v-model="userAnswerMatchingRight"
                                            :options="dragOptions"
                                            @end="syncMatchingHeights"
                                        >
                                            <template
                                                v-for="(option, index) in userAnswerMatchingRight"
                                            >
                                                <div class="d-flex align-items-center">
                                                    <i
                                                        :class="[
                                                            'bx bxs-label matching-icon',
                                                            currentQuestionIsSubmitted
                                                                ? checkMatchingAnswerCorrect(
                                                                      option.id,
                                                                  )
                                                                    ? 'answer-correct-icon'
                                                                    : 'answer-incorrect-icon'
                                                                : '',
                                                        ]"
                                                    ></i>
                                                    <div
                                                        :class="[
                                                            'answer-option answer-option-matching',
                                                            currentQuestionIsSubmitted
                                                                ? checkMatchingAnswerCorrect(
                                                                      option.id,
                                                                  )
                                                                    ? 'answer-correct'
                                                                    : 'answer-incorrect'
                                                                : '',
                                                        ]"
                                                    >
                                                        <div class="answer-option-content">
                                                            <RichContent
                                                                :content="option.text"
                                                                :format="currentQuestion.textFormat"
                                                                inline
                                                            />
                                                        </div>
                                                        <div class="answer-option-order">
                                                            <HolderOutlined />
                                                        </div>
                                                    </div>
                                                </div>
                                            </template>
                                        </VueDraggable>
                                    </div>
                                </div>
                            </template>

                            <template v-if="currentQuestion.type === QUESTION_TYPE.ORDERING">
                                <div class="answer-option-container ordering">
                                    <VueDraggable
                                        :disabled="currentQuestionIsSubmitted"
                                        v-model="userAnswerOrdering"
                                        :options="dragOptions"
                                    >
                                        <template v-for="(option, index) in userAnswerOrdering">
                                            <div
                                                :class="[
                                                    'answer-option answer-option-ordering',
                                                    currentQuestionIsSubmitted
                                                        ? index === option.correctOrder
                                                            ? 'answer-correct'
                                                            : 'answer-incorrect'
                                                        : '',
                                                ]"
                                            >
                                                <div class="answer-option-order">
                                                    <HolderOutlined />
                                                    {{ index + 1 }}
                                                </div>
                                                <div class="answer-option-content">
                                                    <RichContent
                                                        :content="option.text"
                                                        :format="currentQuestion.textFormat"
                                                        inline
                                                    />
                                                </div>
                                                <div
                                                    :class="[
                                                        'answer-option-order answer-icon',
                                                        !currentQuestionIsSubmitted ? 'd-none' : '',
                                                    ]"
                                                >
                                                    <i class="bx bx-hash answer-icon"></i>
                                                    {{ option.correctOrder + 1 }}
                                                </div>
                                            </div>
                                        </template>
                                    </VueDraggable>
                                </div>
                            </template>

                            <template v-if="currentQuestion.type === QUESTION_TYPE.SHORT_TEXT">
                                <div class="answer-option-container">
                                    <div
                                        layout="vertical"
                                        :class="[
                                            'answer-short-text',
                                            currentQuestionIsSubmitted
                                                ? checkShortText()
                                                    ? 'answer-correct'
                                                    : 'answer-incorrect'
                                                : '',
                                        ]"
                                    >
                                        <div class="w-100 d-flex align-items-center">
                                            <TextArea
                                                :readonly="currentQuestionIsSubmitted"
                                                :placeholder="'Enter your answer...'"
                                                v-model="userAnswerShortText"
                                            />
                                            <i
                                                v-if="
                                                    currentQuestionIsSubmitted && checkShortText()
                                                "
                                                class="bx bx-check answer-icon"
                                            ></i>
                                            <i
                                                v-if="
                                                    currentQuestionIsSubmitted && !checkShortText()
                                                "
                                                class="bx bx-x answer-icon"
                                            ></i>
                                        </div>
                                        <div
                                            v-if="currentQuestionIsSubmitted && !checkShortText()"
                                            class="short-text-correct-answer"
                                        >
                                            {{ $t("learn_QS.instructions.short_text_answer") }}
                                            <span>
                                                <RichContent
                                                    :content="currentQuestion.questionData.shortText"
                                                    :format="currentQuestion.textFormat"
                                                    inline
                                                />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <FlashcardAnswerCard
                                v-if="currentQuestionIsSubmitted"
                                :question="currentQuestion"
                            />
                        </div>
                    </div>
                    <div class="learn-question-footer">
                        <div
                            :class="[
                                'main-color-btn-ghost',
                                currentQuestionIsSubmitted ? 'main-color-btn-ghost-disabled' : '',
                            ]"
                            @click="onSkipQuestion($event)"
                        >
                            {{ $t("learn_QS.buttons.dont_know") }}
                        </div>
                        <div class="d-flex">
                            <div
                                :class="[
                                    'main-color-btn-ghost me-3',
                                    !currentQuestionIsSubmitted ? 'd-none' : '',
                                ]"
                                @click="onOpenCommentModal"
                            >
                                <i class="bx bx-conversation me-2"></i>
                                {{ $t("learn_QS.buttons.comment") }}
                            </div>

                            <div
                                :class="[
                                    'main-color-btn-ghost me-3',
                                    !currentQuestionIsSubmitted ? 'd-none' : '',
                                ]"
                                @click="toggleExplainModal"
                            >
                                <i class="bx bx-bulb me-2"></i>
                                {{ $t("learn_QS.buttons.explaination") }}
                            </div>

                            <a-button
                                :disabled="currentQuestionIsSubmitted"
                                :class="[
                                    'main-color-btn',
                                    currentQuestionIsSubmitted ? 'main-color-btn-disabled' : '',
                                ]"
                                type="primary"
                                @click="onSubmitAnswer"
                            >
                                {{ $t("learn_QS.buttons.submit") }}
                            </a-button>
                        </div>
                    </div>
                </template>
            </div>
            <div
                ref="explainModal"
                class="explain-modal explain-modal-up"
                :class="{ show: explainModalOpen }"
            >
                <RichContent
                    class="learn-question-explain html"
                    :content="currentQuestion.explainText"
                    :format="currentQuestion.textFormat"
                />
                <a-button
                    :class="['main-color-btn close-modal-btn']"
                    type="primary"
                    @click="toggleExplainModal"
                >
                    <i class="bx bx-chevrons-down"></i>
                </a-button>
                <a-button
                    :class="[
                        'main-color-btn',
                        currentSession.length <= 0 ? 'main-color-btn-disabled' : '',
                    ]"
                    type="primary"
                    @click="onNextQuestion"
                >
                    {{ $t("learn_QS.buttons.next_question") }}
                    <i class="bx bx-chevron-right"></i>
                </a-button>
            </div>
            <a-drawer
                :width="500"
                title="Comment section"
                :placement="'right'"
                :open="commentModalOpen"
                @close="onCloseCommentModal"
            >
                <div class="comment-section">
                    <div class="comment-container">
                        <template v-if="currentQuestionComments.length > 0">
                            <div
                                v-for="(comment, index) in currentQuestionComments"
                                :class="[
                                    'comment-item',
                                    chosenComment?.id === comment.id ? 'comment-item-chosen' : '',
                                ]"
                            >
                                <div class="comment-main-content">
                                    <UserAvatar
                                        class="comment-user-img"
                                        :avatar-id="comment.createBy.avatarId"
                                        :size="36"
                                        :alt="comment.createBy.fullName"
                                    />
                                    <div class="w-100 d-flex flex-column">
                                        <div class="comment-content-info">
                                            {{ comment.createBy.fullName }}
                                            <span>
                                                {{
                                                    dayjs(comment.createdAt).format(
                                                        "DD/MM/YYYY HH:mm",
                                                    )
                                                }}
                                            </span>
                                            <div
                                                v-if="comment.createBy.userId === user_info.id"
                                                class="comment-actions"
                                            >
                                                <!-- <i
                                                        class="me-3 bx bx-edit"
                                                        @click="onEditComment(comment.id)"
                                                    ></i> -->
                                                <a-popconfirm
                                                    class="pop-confirm-delete"
                                                    :title="$t('create_QS.quiz.confirm')"
                                                    @confirm="onDeleteComment(comment.id)"
                                                >
                                                    <template #default>
                                                        <i class="text-danger bx bx-trash-alt"></i>
                                                    </template>
                                                </a-popconfirm>
                                            </div>
                                        </div>
                                        <div class="comment-content" v-text="comment.content"></div>
                                        <div class="comment-reply">
                                            <div
                                                class="comment-reply-btn"
                                                @click="onTriggerReply(comment)"
                                            >
                                                Reply
                                            </div>
                                            <div
                                                class="comment-children-open-btn"
                                                @click="onToggleReplyContainer(index)"
                                            >
                                                {{ repliesOpen[index] ? "Close" : "View" }}
                                                ({{ comment.childComments.length }}) replies
                                            </div>
                                        </div>
                                        <div
                                            :id="'reply-items-' + index"
                                            class="child-comment-container"
                                            style="display: none"
                                        >
                                            <div
                                                class="comment-item"
                                                v-for="(
                                                    childComment, index
                                                ) in comment.childComments"
                                            >
                                                <div class="comment-main-content">
                                                    <UserAvatar
                                                        class="comment-user-img"
                                                        :avatar-id="childComment.createBy.avatarId"
                                                        :size="36"
                                                        :alt="childComment.createBy.fullName"
                                                    />
                                                    <div class="w-100 d-flex flex-column">
                                                        <div class="comment-content-info">
                                                            {{ childComment.createBy.fullName }}
                                                            <span>
                                                                {{
                                                                    dayjs(
                                                                        childComment.createdAt,
                                                                    ).format("DD/MM/YYYY HH:mm")
                                                                }}
                                                            </span>
                                                            <div
                                                                v-if="
                                                                    childComment.createBy.userId ===
                                                                    user_info.id
                                                                "
                                                                class="comment-actions"
                                                            >
                                                                <!-- <i
                                                                        class="me-3 bx bx-edit"
                                                                        @click="
                                                                            onEditComment(
                                                                                childComment.id,
                                                                            )
                                                                        "
                                                                    ></i> -->
                                                                <a-popconfirm
                                                                    class="pop-confirm-delete"
                                                                    :title="
                                                                        $t('create_QS.quiz.confirm')
                                                                    "
                                                                    @confirm="
                                                                        onDeleteComment(
                                                                            childComment.id,
                                                                        )
                                                                    "
                                                                >
                                                                    <template #default>
                                                                        <i
                                                                            class="text-danger bx bx-trash-alt"
                                                                        ></i>
                                                                    </template>
                                                                </a-popconfirm>
                                                            </div>
                                                        </div>
                                                        <div class="comment-content" v-text="childComment.content"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <a-skeleton
                                v-if="commentLoading"
                                :loading="commentLoading"
                            ></a-skeleton>
                            <a-button
                                v-if="commentPageParams.pageNumber < commentTotalPage"
                                type="primary"
                                class="main-color-btn"
                                @click="onLoadMoreComment"
                                :loading="commentLoading"
                            >
                                Load more
                            </a-button>
                        </template>
                        <div
                            v-else
                            class="w-100 h-100 d-flex justify-content-center align-items-center"
                        >
                            <a-empty>
                                <template #description>
                                    <span>No one has commented yet.</span>
                                </template>
                            </a-empty>
                        </div>
                    </div>
                    <a-form layout="vertical" class="comment-form">
                        <label v-if="isReplying">
                            Replying to @{{ chosenComment?.createBy.fullName }}
                        </label>
                        <label v-else>Your comment</label>
                        <TextArea
                            v-model:value="commentValue"
                            :placeholder="'Enter comment'"
                            :max-length="500"
                        />
                        <div class="comment-form-footer">
                            <a-button
                                type="primary"
                                shape="round"
                                :class="[
                                    'me-3 main-color-btn-ghost',
                                    !isReplying ? 'main-color-btn-ghost-disabled' : '',
                                ]"
                                @click="onCancelReplying"
                            >
                                {{ $t("learn_QS.buttons.cancel") }}
                            </a-button>
                            <a-button
                                :loading="commentLoading"
                                type="primary"
                                shape="round"
                                :class="[
                                    'main-color-btn',
                                    !commentValue ? 'main-color-btn-disabled' : '',
                                ]"
                                @click="onAddComment"
                            >
                                {{ $t("learn_QS.buttons.send_comment") }}
                            </a-button>
                        </div>
                    </a-form>
                </div>
            </a-drawer>
        </div>
    </div>

    <a-drawer
        :open="finalModalOpen"
        placement="top"
        :height="'100vh'"
        :closable="false"
        @close="closeFinalModal"
        :body-style="{ padding: 0, height: '100%' }"
    >
        <template #title>
            <div class="title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="1">
                        <RouterLink :to="{ name: 'User_Library' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="23">
                        <span> {{ quiz.title }}</span> <br />
                    </a-col>
                </a-row>
            </div>
        </template>

        <div class="content-item modal-final-container">
            <div class="final-modal-quote">
                {{ finalModalQuote }}
            </div>
        </div>
        <div class="progress-bar-container final">
            <div class="progress-info">
                <div class="progress-info-percentage">
                    {{ $t("learn_QS.other.total_set_progress") }}
                    <span>{{ completionPercentage }}%</span>
                </div>
            </div>
            <a-progress
                :show-info="false"
                stroke-color="var(--main-color)"
                :percent="completionPercentage"
            />
            <div class="progress-info">
                <div class="progress-info-percentage">
                    {{ $t("learn_QS.other.completed") }}:
                    <span>{{ quiz.completedQuestionCount }}</span>
                </div>
                <div class="progress-info-percentage">
                    {{ $t("learn_QS.other.total_question") }}
                    <span>{{ quiz.totalQuestionCount }}</span>
                </div>
            </div>
        </div>
        <div class="content-item modal-final-container">
            <a-divider style="background-color: var(--content-item-border-color)"></a-divider>
            <div class="preview-question-title">
                {{ $t("learn_QS.other.preview_modal_title") }}
            </div>
            <div class="preview-question-container">
                <div class="preview-question-item" v-for="(question, index) in completed">
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
                        <div class="question-item-answer" :id="`question-item-answer-${index}`">
                            <template v-if="question.type === QUESTION_TYPE.MULTIPLE_CHOICE">
                                <div class="multiple-choice-answer">
                                    <ul>
                                        <li v-for="option in question.questionData.multipleChoice">
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
                                <div
                                    class="pair-answer"
                                    v-for="option in question.questionData.matching?.matches"
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
                            <template v-if="question.type === QUESTION_TYPE.ORDERING">
                                <div class="ordering-answer">
                                    <div class="ordering-answer-item">
                                        <div v-for="option in question.questionData.ordering">
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
                                                (asc, desc) => asc.correctOrder - desc.correctOrder,
                                            )"
                                        >
                                            <span>#{{ option.correctOrder + 1 }}</span> -
                                            <RichContent
                                                :content="option.text"
                                                :format="question.textFormat"
                                                inline
                                            />
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <template v-if="question.type === QUESTION_TYPE.SHORT_TEXT">
                                <span>Answer:</span>
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
                            @click="toggleDisplayAnswer(index, $event.currentTarget!)"
                        ></i>
                    </div>
                </div>
            </div>
            <div class="content-item final-modal-footer">
                <div>{{ $t("learn_QS.other.preview_modal_continues_ins") }}</div>
                <!-- cửa sổ này chỉ mở khi phiên đã học hết (currentSession luôn rỗng): Tiếp tục = nạp phiên mới từ server -->
                <a-button
                    :loading="loading"
                    :class="['main-color-btn']"
                    type="primary"
                    size="large"
                    shape="round"
                    @click="onContinuesLearn"
                >
                    {{ $t("learn_QS.buttons.continue") }}
                </a-button>
            </div>
        </div>
    </a-drawer>

    <a-drawer
        :open="completeModalOpen"
        placement="top"
        :height="'100vh'"
        :closable="false"
        @close="closeFinalModal"
        :body-style="{ padding: 0, height: '100%' }"
    >
        <DotLottieVue
            v-if="isAnimationDisplaying"
            :autoplay="isAnimationDisplaying"
            ref="animationRef"
            :class="['animation-container']"
            @complete="isAnimationDisplaying = false"
            :src="animationPath"
        />
        <div class="modal-complete-container">
            <div class="content-item modal-complete">
                <img class="modal-complete-img" :src="trophy_png" alt="" />
                <div class="modal-complete-content-container">
                    <div class="modal-complete-content">
                        {{ $t("learn_QS.other.complete_modal_congratulation") }}
                    </div>
                    <div class="modal-complete-content sub-content">
                        {{ $t("learn_QS.other.complete_modal_ins") }}
                    </div>
                </div>
                <div class="modal-complete-buttons-container">
                    <a-button
                        type="primary"
                        class="main-color-btn-ghost"
                        size="large"
                        @click="onRedirectToLibrary"
                    >
                        {{ $t("learn_QS.buttons.back_to_home") }}
                    </a-button>
                    <a-button
                        type="primary"
                        class="main-color-btn"
                        size="large"
                        @click="onRedirectToTest"
                    >
                        {{ $t("learn_QS.buttons.take_a_test") }}
                    </a-button>
                    <a-button
                        type="primary"
                        class="main-color-btn"
                        size="large"
                        @click="onResetLearnHistory"
                    >
                        {{ $t("learn_QS.buttons.reset_learn_mode") }}
                    </a-button>
                </div>
            </div>
        </div>
    </a-drawer>
    <!-- <template v-else>
        <div class="page-container">
            <div class="w-100 h-100 d-flex align-items-center justify-content-center">
                <a-result
                    status="error"
                    :title="t('now_allowed.main_msg')"
                    :sub-title="t('now_allowed.errorMessage')"
                >
                    <template #icon>
                        <CloseSquareFilled />
                    </template>
                    <template #extra>
                        <div class="d-flex justify-content-center">
                            <a-button key="console" type="primary" class="me-3 main-color-btn">
                                {{ $t("now_allowed.libraryNavigator") }}
                            </a-button>
                            <a-button
                                @click="onRedirectToSubcription"
                                key="buy"
                                type="ghost"
                                class="main-color-btn-ghost"
                            >
                                {{ $t("now_allowed.subscriptionNavigator") }}
                            </a-button>
                        </div>
                    </template></a-result
                >
            </div>
        </div>
    </template> -->
</template>
<style>
.ant-drawer-content {
    background-color: var(--content-item-background-color) !important;
    border-color: var(--content-item-border-color) !important;
    color: var(--text-color) !important;
}

.ant-drawer-close {
    color: var(--text-color) !important;
}
.ant-drawer-title {
    color: var(--text-color) !important;
}
.ant-drawer-header {
    border-bottom-color: var(--content-item-border-color) !important;
}
</style>

<style scoped>
.page-container {
    height: 100vh;
}
.content-item {
    width: 70%;
    margin: 16px auto;
    padding: 24px;
}
::v-deep(.answer-correct textarea) {
    border-color: var(--c-success);
}

::v-deep(.answer-incorrect textarea) {
    border-color: var(--c-danger);
}

::v-deep(.ant-progress-bg) {
    background-color: var(--main-color) !important;
    height: 8px !important;
}

::v-deep(.ant-progress-text) {
    color: var(--text-color) !important;
    font-weight: 600;
    font-size: 14px;
}

::v-deep(.ant-progress-inner) {
    background-color: var(--content-item-border-color);
}

.progress-info {
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--c-text-muted);
}
.relearn-ins {
    padding: 4px 12px;
    background-color: color-mix(in srgb, var(--c-warning) 16%, var(--c-surface));
    color: var(--c-warning-text);
    width: fit-content;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    margin: 0px 0px 12px;
}

.section {
    padding: 0px;
}
.learn-question {
    margin-bottom: 24px;
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
}
.answer-section-ins {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text-muted);
}
.learn-question-result {
    font-size: 14px;
    font-weight: 600;
}

.answer-option-container {
    margin-top: 12px;
    border-top: 0;
    border-radius: 0;
}
.answer-option-container.multiplechoice {
    padding-top: 0px;
    gap: 12px;
}
.answer-option {
    min-height: 56px;
    padding: 8px 14px;
    background-color: var(--c-surface);
    border: 1px solid var(--form-item-border-color);
    border-radius: var(--ui-r-md);
    font-size: 15px;
}
.answer-option:hover {
    background-color: var(--c-surface-subtle);
    border-color: var(--main-color);
}
.answer-option.ant-checkbox-wrapper-checked {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-color: var(--main-color);
}
.answer-option-content {
    margin-left: 10px;
    padding: 4px 0px;
    font-size: 1em;
}
.answer-option.answer-correct,
.answer-option.answer-correct:hover {
    background-color: color-mix(in srgb, var(--c-success) 14%, var(--c-surface));
    border-color: var(--c-success);
}
.answer-option.answer-incorrect,
.answer-option.answer-incorrect:hover {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
    border-color: var(--c-danger);
}
.answer-icon {
    font-size: 22px;
}
.answer-correct .answer-icon {
    color: var(--c-success-text);
}
.answer-incorrect .answer-icon {
    color: var(--c-danger-text);
}
.sortable-chosen .answer-option {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border: 1px solid var(--main-color);
}
.answer-option-container.ordering > div {
    width: min(520px, 100%);
}
.answer-option-order {
    font-size: 16px;
}
.answer-option-order i {
    font-size: 22px;
}

.answer-short-text {
    display: flex;
    flex-direction: column;
    align-items: start;
    padding: 12px;
    border: 1px solid transparent;
    border-radius: var(--ui-r-md);
}
.answer-short-text.answer-correct {
    background-color: color-mix(in srgb, var(--c-success) 14%, var(--c-surface));
    border-color: var(--c-success);
}
.answer-short-text.answer-incorrect {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
    border-color: var(--c-danger);
}
.short-text-correct-answer {
    margin-top: 10px;
}
.short-text-correct-answer span {
    font-size: 16px;
    font-weight: 600;
    color: var(--c-success-text);
}

.learn-question-footer {
    padding: 0px;
    margin-top: 16px;
}
.main-color-btn-ghost {
    height: 40px;
    padding: 0px 14px;
    font-size: 14px;
    font-weight: 600;
}
.main-color-btn-ghost:hover {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface)) !important;
    border-color: transparent;
}

.explain-modal-up {
    padding: 20px 32px;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl) var(--ui-r-xl) 0 0;
    box-shadow: var(--ui-shadow-pop);
}
.close-modal-btn {
    top: -20px;
}

.preview-question-title {
    font-weight: 600;
}
.preview-question-item {
    margin: 8px 0px;
    padding: 12px 14px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
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
    color: var(--c-text-muted);
    background-color: var(--c-surface-raised);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}
.question-item-toogle-btn i:hover {
    color: var(--c-primary-text);
    border-color: var(--main-color);
}
.multiple-choice-answer ul {
    padding-left: 18px;
}
.pair-answer-item,
.short-text-answer {
    background-color: var(--c-surface-raised);
    border-radius: var(--ui-r-sm);
}

.question-item-answer {
    margin-top: 8px;
}
.comment-form {
    border-radius: 0px;
}
.comment-item:hover {
    border-radius: var(--ui-r-md);
}
.child-comment-container {
    border-left: 2px solid var(--content-item-border-color);
}

.animation-container {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 1000;
}

.modal-complete-container {
    display: flex;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.modal-complete {
    border-radius: var(--ui-r-xl);
    border: 1px solid var(--content-item-border-color);
    background: var(--c-surface);
    box-shadow: var(--ui-shadow-pop);

    height: 80%;
    width: 80%;
    margin: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.modal-complete-img {
    width: 130px;
    height: 130px;
}

.modal-complete-content-container {
    margin: 20px 0px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.modal-complete-content {
    color: var(--text-color);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.293px;
}
.modal-complete-content.sub-content {
    font-size: 18px;
    font-weight: 500;
}

.modal-complete-buttons-container {
    width: 80%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
}
.ghost-btn {
    background-color: transparent;
    border-color: var(--main-color);
    color: var(--c-primary-text) !important;
}
.ghost-btn:hover {
    background-color: transparent !important;
    border-color: var(--text-color-grey) !important;
}
</style>
