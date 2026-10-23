<script setup lang="ts">
import ApiTest from "@/api/ApiTest";

import { ref, computed, onMounted, nextTick, onUnmounted } from "vue";
import type { ResponseQuestion } from "@/models/response/question";
import type UserAnswerDTO from "@/models/response/test/userAnswerDTO";
import type { UserAnswerData } from "@/models/response/test/userAnswer";
import type UserAnswerSubmit from "@/models/response/test/userAnswer";
import QUESTION_TYPE from "@/constants/questionTypes";

import TransferUserAnswerData from "@/services/TransferUserAnswerData";

import TextArea from "@/shared/components/Common/TextArea.vue";
import { VueDraggable } from "vue-draggable-plus";
import { HolderOutlined } from "@ant-design/icons-vue";
import Validator from "@/services/Validator";
import { mergeQuestionMedia } from "@/services/QuestionMediaService";
import QuestionMediaView from "@/shared/components/Media/QuestionMediaView.vue";
import RichContent from "@/shared/components/Common/RichContent.vue";

import { useI18n } from "vue-i18n";
import { Modal, message } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";

import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

interface AttemptData {
    attemptId: string;
    name: string;
    questionCount: number;
    timeStart: string;
    timeEnd: string;
    timeLimit: number;
    timeRemaining: number;
    questions: { questionData: ResponseQuestion; userAnswerDataDto: UserAnswerSubmit }[];
}

const quiz = ref<ResponseQuestion[]>([]);
const userAnswer = ref<UserAnswerDTO[]>([]);

const currentQuestion = ref<ResponseQuestion>({
    id: "",
    explainText: "",
    questionSetId: "",
    questionText: "",
    score: 0,
    scoreGraded: 0,
    textFormat: "0",
    type: "MultipleChoice",
    correctMultipleChoiceCount: 0,
    questionData: {
        matching: null,
        multipleChoice: null,
        ordering: null,
        shortText: "",
    },
});

const currentQuestionInstruction = ref("");
const currentQuestionIsSkipped = ref(false);
const isSubmitted = ref(false);

const userAnswerMultipleChoice = ref<string[]>([]);

const userAnswerMatchingLeft = ref<any[]>([]);
const userAnswerMatchingRight = ref<any[]>([]);

const userAnswerOrdering = ref<any[]>([]);
const userAnswerShortText = ref<string>("");

//#region init data
const isDataValid = ref(true); //to mark whether testTemplate is valid to remove guard
const testId = ref<string>(route.params.id.toString());
const attemptData = ref<AttemptData>({
    attemptId: "",
    name: "",
    questionCount: 0,
    timeStart: "",
    timeEnd: "",
    timeLimit: 0,
    timeRemaining: 0,
    questions: [],
});
const loading = ref(false);
// trang danh sách bài kiểm tra của lớp (nếu biết lớp), ngược lại về danh sách lớp
const leaveToClass = () => {
    const classId = route.query.classId?.toString();
    if (classId && Validator.isValidGuid(classId)) {
        router.replace({ name: "User_Class_Exam", params: { id: classId } });
    } else {
        router.replace({ name: "User_Class" });
    }
};

const backRoute = computed(() => {
    const classId = route.query.classId?.toString();
    return classId && Validator.isValidGuid(classId)
        ? { name: "User_Class_Exam", params: { id: classId } }
        : { name: "User_Class" };
});

/** @returns true nếu đã tải được bài làm hợp lệ; false nếu đã chuyển hướng/lỗi (không được render tiếp) */
const getAttemptData = async (): Promise<boolean> => {
    try {
        loading.value = true;
        if (!Validator.isValidGuid(testId.value)) {
            isDataValid.value = false;
            router.replace({ name: "404" });
            return false;
        }

        const result = await ApiTest.Attempt(testId.value);
        attemptData.value = result.data.data;

        if (attemptData.value.timeRemaining <= 0) {
            message.error(t("message.time_up"));
            leaveToClass();
            return false;
        }

        if (!Array.isArray(result.data.data.questions) || result.data.data.questions.length === 0) {
            leaveToClass();
            return false;
        }

        quiz.value = [...result.data.data.questions.map((x: any) => ({ id: x.questionId, ...x }))];

        userAnswer.value = TransferUserAnswerData.transferFromUserAnswerSubmit(
            result.data.data.questions.map((x: any) => ({
                questionId: x.id,
                userAnswerData: x.userAnswerDataDto,
            })),
        );

        currentQuestion.value = quiz.value[0] as ResponseQuestion;
        return true;
    } catch (error: any) {
        // Mọi lỗi (hết lượt, chưa tới giờ, không thuộc lớp...): toast lỗi đã do interceptor hiển thị, rời trang
        isDataValid.value = false;
        leaveToClass();
        return false;
    } finally {
        loading.value = false;
    }
};

//#endregion

//#region logic complete question
/* handle logic complete question */
const updateUserAnswer = (index: number, newAnswer: UserAnswerDTO) => {
    if (index === -1) {
        userAnswer.value.push(newAnswer);
    } else {
        userAnswer.value[index] = newAnswer;
    }
};

//track change when user perform actions on questions
const onUserAnswerChange = () => {
    const index = userAnswer.value.findIndex((x) => x.questionId === currentQuestion.value.id);

    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            if (userAnswerMultipleChoice.value.length > 0) {
                updateUserAnswer(index, {
                    questionId: currentQuestion.value.id,
                    type: currentQuestion.value.type,
                    multipleChoices: [...userAnswerMultipleChoice.value],
                    matchingLeft: null,
                    matchingRight: null,
                    ordering: null,
                    shortText: "",
                });
            } else if (index !== -1) {
                userAnswer.value.splice(index, 1);
            }
            break;
        }
        case QUESTION_TYPE.MATCHING: {
            updateUserAnswer(index, {
                questionId: currentQuestion.value.id,
                type: currentQuestion.value.type,
                multipleChoices: null,
                matchingLeft: [...userAnswerMatchingLeft.value],
                matchingRight: [...userAnswerMatchingRight.value],
                // matchingLeft: userAnswerMatchingLeft.value.map((x) => x),
                // matchingRight: userAnswerMatchingRight.value.map((x) => x),
                ordering: null,
                shortText: "",
            });
            break;
        }
        case QUESTION_TYPE.ORDERING: {
            updateUserAnswer(index, {
                questionId: currentQuestion.value.id,
                type: currentQuestion.value.type,
                multipleChoices: null,
                matchingLeft: null,
                matchingRight: null,
                ordering: [...userAnswerOrdering.value],
                // ordering: userAnswerOrdering.value.map((x) => x),
                shortText: "",
            });
            break;
        }
        case QUESTION_TYPE.SHORT_TEXT: {
            if (userAnswerShortText.value.trim()) {
                updateUserAnswer(index, {
                    questionId: currentQuestion.value.id,
                    type: currentQuestion.value.type,
                    multipleChoices: null,
                    matchingLeft: null,
                    matchingRight: null,
                    ordering: null,
                    shortText: userAnswerShortText.value.trim(),
                });
            } else if (index !== -1) {
                userAnswer.value.splice(index, 1);
            }
            break;
        }
    }
};

const sendUserAnswer = async (isSubmit: boolean) => {
    const answerObject = TransferUserAnswerData.transferToUserAnswerSubmit(userAnswer.value);
    const result = await ApiTest.Submit({
        attemptId: attemptData.value.attemptId,
        userAnswers: answerObject,
        isSubmit: isSubmit,
    });

    return result.data.success;
};

const onSubmit = () => {
    Modal.confirm({
        title: t("attempt_test.submit_modal.title"),
        content: t("attempt_test.submit_modal.content"),
        centered: true,
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            //call api
            const result = await sendUserAnswer(true);
            if (!result) {
                message.error(t("message.submited_failed"));
                return;
            }
            message.info(t("message.submited_successfully"));
            leaveToClass();
        },
    });
};

const onSave = async () => {
    try {
        const result = await sendUserAnswer(false);
        if (!result) {
            message.error(t("message.submited_failed"));
            return;
        }
        message.info(t("message.saved_successfully"));
    } catch (error) {
        message.error(t("message.saved_failed"));
    }
};

const onLoadCurrentQuestion = (index: number) => {
    syncMatchingHeights();
    currentQuestionIsSkipped.value = false;

    currentQuestion.value = quiz.value[index] as ResponseQuestion;
    const answer = userAnswer.value.find((x) => x.questionId === currentQuestion.value.id);

    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            currentQuestionInstruction.value = t("learn_QS.instructions.multiple_choice", {
                number: currentQuestion.value.correctMultipleChoiceCount,
            });
            userAnswerMultipleChoice.value = answer ? answer?.multipleChoices! : [];
            break;
        }

        case QUESTION_TYPE.ORDERING: {
            currentQuestionInstruction.value = t("learn_QS.instructions.ordering");
            userAnswerOrdering.value = answer
                ? answer?.ordering!.map((x) => ({
                      id: x.id,
                      text: currentQuestion.value.questionData.ordering?.find((c) => c.id === x.id)
                          ?.text,
                  }))
                : currentQuestion.value.questionData.ordering?.map((x) => x) || [];
            // Thứ tự đang hiển thị chính là đáp án sẽ nộp nếu học viên không kéo thả -> ghi nhận luôn
            if (!answer) onUserAnswerChange();
            break;
        }

        case QUESTION_TYPE.MATCHING: {
            currentQuestionInstruction.value = t("learn_QS.instructions.matching");
            userAnswerMatchingLeft.value = answer
                ? answer?.matchingLeft!.map((x) => ({
                      id: x.id,
                      text: currentQuestion.value.questionData.matching?.leftItems.find(
                          (m) => m.id === x.id,
                      )?.text,
                  }))
                : currentQuestion.value.questionData.matching!.leftItems.map((x) => x) || [];

            userAnswerMatchingRight.value = answer
                ? answer?.matchingRight!.map((x) => ({
                      id: x.id,
                      text: currentQuestion.value.questionData.matching?.rightItems.find(
                          (m) => m.id === x.id,
                      )?.text,
                  }))
                : currentQuestion.value.questionData.matching!.rightItems.map((x) => x) || {};
            // Ghép đang hiển thị (trái i - phải i) chính là đáp án sẽ nộp nếu học viên không thao tác -> ghi nhận luôn
            if (!answer) onUserAnswerChange();
            break;
        }

        case QUESTION_TYPE.SHORT_TEXT: {
            currentQuestionInstruction.value = t("learn_QS.instructions.short_text");
            userAnswerShortText.value = answer ? answer?.shortText! : "";
            break;
        }
    }
};

const onNextQuestion = () => {
    const index = quiz.value.findIndex((x) => x.id === currentQuestion.value.id);
    if (index < quiz.value.length - 1) {
        onLoadCurrentQuestion(index + 1);
    }
};

const onPreviousQuestion = () => {
    const index = quiz.value.findIndex((x) => x.id === currentQuestion.value.id);
    if (index > 0) {
        onLoadCurrentQuestion(index - 1);
    }
};

const userAnswerContainQuestion = (questionId: string) => {
    return Array.from(userAnswer.value).some((x) => x.questionId === questionId);
};

const hasNextQuestion = computed(() => {
    const index = quiz.value.findIndex((x) => x.id === currentQuestion.value.id);
    return index !== -1 && index < quiz.value.length - 1;
});

const hasPreviousQuestion = computed(() => {
    const index = quiz.value.findIndex((x) => x.id === currentQuestion.value.id);
    return index !== -1 && index > 0;
});

const currentQuestionIndex = computed(() => {
    return quiz.value.findIndex((x) => x.id === currentQuestion.value.id);
});

//#endregion

//#region adjust UI scale
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

/* adjust multiple choice layout */
const isOptionExceed = computed(() => {
    return currentQuestion.value.questionData.multipleChoice?.some((x) => x.text.length >= 100);
});

//#endregion

//#region timer
const endTime = ref<Dayjs>(dayjs().add(attemptData.value.timeRemaining * 60, "second"));

const remainingTime = ref<number>(attemptData.value.timeRemaining * 60);
let timer: ReturnType<typeof setInterval> | null = null;

const formattedTime = computed<string>(() => {
    const min = Math.floor(remainingTime.value / 60)
        .toString()
        .padStart(2, "0");
    const sec = (remainingTime.value % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
});

const updateCountdown = async () => {
    const diff = endTime.value.diff(dayjs(), "second");
    remainingTime.value = diff > 0 ? diff : 0;
    if (diff <= 0 && timer) {
        clearInterval(timer);
        timer = null;
        //trigger submit final here
        const result = await sendUserAnswer(true);
        if (!result) {
            message.error(t("message.submited_failed"));
            return;
        }
        message.info(t("message.time_up"));
        leaveToClass();
    }
};

/*
 * presigned URL của media hết hạn -> gọi lại Attempt (server trả về đúng lượt làm bài đang dở) để lấy URL mới,
 * CHỈ cập nhật media, không đụng tới câu trả lời/timer.
 * Không gọi khi sắp hết giờ: nếu lượt làm bài đã bị nộp tự động, gọi Attempt sẽ tạo lượt làm bài mới.
 */
const MEDIA_RELOAD_MIN_REMAINING_SECONDS = 15;
const reloadQuestionMedia = async () => {
    if (isSubmitted.value || remainingTime.value <= MEDIA_RELOAD_MIN_REMAINING_SECONDS) {
        message.warning(t("question_media.reload_unavailable"));
        return;
    }
    try {
        const result = await ApiTest.Attempt(testId.value);
        if (result?.data?.success && result.data.data.attemptId === attemptData.value.attemptId) {
            // cùng cách map id như getAttemptData
            const fresh = result.data.data.questions.map((x: any) => ({ id: x.questionId, ...x }));
            mergeQuestionMedia([...quiz.value, currentQuestion.value], fresh);
        }
    } catch (error) {
        console.log("ERROR: reload question media", error);
    }
};

//#endregion

//#region auto save
let autoSaver: ReturnType<typeof setInterval> | null = null;
const autoSave = async () => {
    //call api submit

    //auto save
    const result = await sendUserAnswer(false);
    if (!result) {
        message.error(t("message.auto_save_failed"));
        return;
    }

    message.info(t("message.auto_save_successfully"));
};
//#endregion

//#region flag

const flaggedQuestion = ref<Set<string>>(new Set());

const onToggleFlagQuestion = () => {
    const questionId = currentQuestion.value.id;
    if (!flaggedQuestion.value.delete(questionId)) {
        flaggedQuestion.value.add(questionId);
    }

    localStorage.setItem(
        "flagged_question",
        JSON.stringify({
            attemptId: attemptData.value.attemptId,
            questions: Array.from(flaggedQuestion.value),
        }),
    );
};

const onLoadFlaggedQuestion = () => {
    const data = localStorage.getItem("flagged_question");
    if (!data) return;
    const parsed = JSON.parse(data);
    const attemptId = parsed.attemptId;
    if (attemptId != attemptData.value.attemptId) {
        localStorage.removeItem("flagged_question");
        return;
    }
    if (!Array.isArray(parsed.questions)) {
        localStorage.removeItem("flagged_question");
        return;
    }
    flaggedQuestion.value = new Set(parsed.questions);
};

const flagContainQuestion = (questionId: string) => {
    return Array.from(flaggedQuestion.value).some((x) => x === questionId);
};

const isCurrentQuestionFlagged = computed(() => {
    const questionId = currentQuestion.value.id;
    return Array.from(flaggedQuestion.value).some((x) => x === questionId);
});

//#endregion

//#region leave guard
onUnmounted(() => {
    window.removeEventListener("resize", syncMatchingHeights);
    if (timer) clearInterval(timer);
    if (autoSaver) clearInterval(autoSaver);
});
//#endregion

onMounted(async () => {
    const ok = await getAttemptData();
    if (!ok) return;

    syncMatchingHeights();
    window.addEventListener("resize", syncMatchingHeights);
    remainingTime.value = attemptData.value.timeRemaining * 60;
    endTime.value = dayjs().add(attemptData.value.timeRemaining * 60, "second");

    onLoadCurrentQuestion(0);
    onLoadFlaggedQuestion();

    updateCountdown();
    timer = setInterval(updateCountdown, 1000);
    autoSaver = setInterval(autoSave, 30_000); //save each 30s
});
</script>

<template>
    <div class="page-container">
        <div class="title-container title-container-header">
            <a-row class="w-100 d-flex align-items-center">
                <a-col :span="1">
                    <RouterLink :to="backRoute">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </RouterLink>
                </a-col>
                <a-col class="main-title" :span="22">
                    <span> {{ attemptData?.name }}</span> <br />
                    <span>
                        {{ t("dashboards.list_items.quiz.questions", attemptData?.questionCount ?? 0) }}
                    </span>
                </a-col>
            </a-row>
        </div>

        <div class="content content-test d-flex flex-column">
            <div class="d-flex">
                <div class="content-item question-navigators">
                    <div
                        class="question-navigator-title d-flex justify-content-between align-items-center"
                    >
                        <span> {{ t("practice_test.other.question_list") }} </span>
                        <span class="countdown d-flex align-items-center">
                            <i class="bx bx-timer"></i>
                            {{ formattedTime }}
                        </span>
                    </div>
                    <template v-if="loading">
                        <a-skeleton :loading="loading"></a-skeleton>
                    </template>
                    <div v-else class="question-navigator-container">
                        <div
                            :class="[
                                'question-navigation-item-outer',
                                currentQuestion.id === item.id ? 'current-question' : '',
                                flagContainQuestion(item.id) ? 'flagged-question' : '',
                            ]"
                            v-for="(item, index) in quiz"
                            @click="onLoadCurrentQuestion(index)"
                        >
                            <div
                                :class="[
                                    'question-navigator-item',
                                    userAnswerContainQuestion(item.id) ? 'completed-question' : '',
                                ]"
                            >
                                <span> {{ index + 1 }} </span>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex">
                        <a-button
                            type="primary"
                            :class="[
                                'main-color-btn',
                                isSubmitted ? 'main-color-btn-disabled' : '',
                            ]"
                            @click="onSubmit"
                        >
                            {{ $t("learn_QS.buttons.submit") }}
                        </a-button>
                        <a-button
                            type="primary"
                            :class="[
                                'ms-3 main-color-btn-ghost',
                                isSubmitted ? 'main-color-btn-disabled' : '',
                            ]"
                            @click="onSave"
                        >
                            {{ $t("admin.manage_subscription.btn.save") }}
                        </a-button>
                    </div>
                </div>
            </div>
            <div class="content-item">
                <div v-if="loading">
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                </div>
                <div v-else class="section question-section">
                    <div class="question-info-index">
                        {{ $t("create_QS.question.question") }} {{ currentQuestionIndex + 1 }}
                    </div>
                    <RichContent
                        class="learn-question"
                        :content="currentQuestion.questionText"
                        :format="currentQuestion.textFormat"
                    />
                    <QuestionMediaView
                        :media="currentQuestion.media"
                        @reload="reloadQuestionMedia"
                    />
                    <div class="section answer-section">
                        <div class="d-flex align-items-center">
                            <div class="answer-section-ins">
                                {{ currentQuestionInstruction }}
                            </div>
                        </div>
                        <template v-if="currentQuestion.type === QUESTION_TYPE.MULTIPLE_CHOICE">
                            <a-checkbox-group
                                @change="onUserAnswerChange"
                                v-model:value="userAnswerMultipleChoice"
                                :class="[
                                    'answer-option-container multiplechoice',
                                    isOptionExceed ? 'column' : '',
                                ]"
                            >
                                <template
                                    v-for="(option, index) in currentQuestion.questionData
                                        .multipleChoice"
                                >
                                    <a-checkbox
                                        v-model:value="option.id"
                                        :class="['answer-option answer-option-multiplechoice']"
                                    >
                                        <div class="answer-option-content">
                                            <RichContent
                                                :content="option.text"
                                                :format="currentQuestion.textFormat"
                                                inline
                                            />
                                        </div>
                                    </a-checkbox>
                                </template>
                            </a-checkbox-group>
                        </template>

                        <template v-if="currentQuestion.type === QUESTION_TYPE.MATCHING">
                            <div class="answer-option-container matching">
                                <div class="matching-option-container left">
                                    <VueDraggable
                                        v-model="userAnswerMatchingLeft"
                                        :options="dragOptions"
                                        @move="syncMatchingHeights"
                                        @end="
                                            () => {
                                                syncMatchingHeights();
                                                onUserAnswerChange();
                                            }
                                        "
                                    >
                                        <template v-for="(option, index) in userAnswerMatchingLeft">
                                            <div class="d-flex align-items-center">
                                                <div
                                                    :class="[
                                                        'answer-option answer-option-matching',
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
                                                <i :class="['bx bxs-label matching-icon']"></i>
                                            </div>
                                        </template>
                                    </VueDraggable>
                                </div>
                                <div class="matching-option-container right">
                                    <VueDraggable
                                        v-model="userAnswerMatchingRight"
                                        :options="dragOptions"
                                        @move="syncMatchingHeights"
                                        @end="
                                            () => {
                                                syncMatchingHeights();
                                                onUserAnswerChange();
                                            }
                                        "
                                    >
                                        <template
                                            v-for="(option, index) in userAnswerMatchingRight"
                                        >
                                            <div class="d-flex align-items-center">
                                                <i :class="['bx bxs-label matching-icon']"></i>
                                                <div
                                                    :class="[
                                                        'answer-option answer-option-matching',
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
                                    v-model="userAnswerOrdering"
                                    :options="dragOptions"
                                    @end="onUserAnswerChange"
                                >
                                    <template v-for="(option, index) in userAnswerOrdering">
                                        <div :class="['answer-option answer-option-ordering']">
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
                                        </div>
                                    </template>
                                </VueDraggable>
                            </div>
                        </template>

                        <template v-if="currentQuestion.type === QUESTION_TYPE.SHORT_TEXT">
                            <div class="answer-option-container">
                                <div :class="['answer-short-text']">
                                    <div class="w-100 d-flex align-items-center">
                                        <TextArea
                                            :placeholder="'Enter your answer...'"
                                            v-model="userAnswerShortText"
                                            @change="onUserAnswerChange"
                                        />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                    <div class="learn-question-footer">
                        <a-button
                            :class="[
                                'main-color-btn',
                                !hasPreviousQuestion ? 'main-color-btn-disabled' : '',
                            ]"
                            type="primary"
                            size="large"
                            @click="onPreviousQuestion"
                        >
                            <i class="bx bx-chevron-left"></i>
                            {{ $t("practice_test.buttons.previous") }}
                        </a-button>
                        <i
                            :class="[
                                'bx bx-flag flag-button',
                                isCurrentQuestionFlagged ? 'bxs-flag' : '',
                            ]"
                            @click="onToggleFlagQuestion"
                        ></i>
                        <div class="d-flex">
                            <a-button
                                :class="[
                                    'main-color-btn',
                                    !hasNextQuestion ? 'main-color-btn-disabled' : '',
                                ]"
                                type="primary"
                                size="large"
                                @click="onNextQuestion"
                            >
                                {{ $t("learn_QS.buttons.next_question") }}
                                <i class="bx bx-chevron-right"></i>
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<style>
.ant-modal-content {
    border: 1px solid var(--form-item-border-color) !important;
}
</style>
<!-- /* for test */ -->
<style scoped>
.page-container {
    width: 100%;
    height: 100vh;
    margin: 0;
}

.content {
    flex-direction: row;
}

.ant-btn {
    box-shadow: none;
}

.content-item {
    width: 70%;
    margin: 10px auto;
    padding: 20px;
}

.content-item.question-navigators {
    position: absolute;
    top: 75px;
    width: 200px;
    height: fit-content;
    margin: 10px 0px 0px 10px;
    padding: 14px;
}

.question-navigator-title {
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text-muted);
}

.countdown {
    padding: 2px 10px;
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--c-text);
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: 999px;
}

.countdown i {
    margin-right: 4px;
    font-size: 18px;
}

.countdown.danger {
    color: var(--c-danger-text);
    border-color: var(--c-danger);
}

.question-navigation-item-outer {
    border-width: 1px;
    border-radius: var(--ui-r-sm);
}

.question-navigator-item {
    border-radius: var(--ui-r-xs);
    font-size: 13px;
    font-weight: 500;
}

.current-question {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    box-shadow: 0 0 0 1px var(--main-color);
}

.question-info-index {
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--ui-r-xs);
}

.learn-question {
    margin-bottom: 24px;
    font-size: 18px;
    font-weight: 500;
}

.answer-section-ins {
    font-size: 14px;
    color: var(--c-text-muted);
}

.answer-option-container {
    border-top-width: 1px;
    border-top-color: var(--content-item-border-color);
    border-radius: 0;
}

.answer-option {
    border-width: 1px;
    border-color: var(--content-item-border-color);
    background-color: var(--c-surface-subtle);
    border-radius: var(--ui-r-md);
}

.answer-option:hover {
    background-color: var(--c-surface-subtle);
    border-color: var(--main-color);
}

.answer-option.ant-checkbox-wrapper-checked {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-color: var(--main-color);
    box-shadow: 0 0 0 1px var(--main-color);
}

.sortable-chosen .answer-option {
    border-width: 1px;
    box-shadow: 0 0 0 1px var(--main-color);
}

.answer-short-text {
    display: flex;
    flex-direction: column;
    align-items: start;
}

.learn-question-footer {
    padding: 0px;
}

.flagged-question::after {
    content: "";
    position: absolute;
    inset: 0;
    background-color: var(--c-warning);
    clip-path: polygon(100% 0, 100% 50%, 50% 0);
}

.flag-button {
    font-size: 24px;
    cursor: pointer;
    color: var(--c-warning);
    transition: all 0.2s ease-in-out;
}
.flag-button:hover {
    transform: scale(1.2);
}
</style>
