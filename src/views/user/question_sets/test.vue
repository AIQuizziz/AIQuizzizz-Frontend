<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";
import QUESTION_TYPE from "@/constants/questionTypes";
import type { ResponseQuestion } from "@/models/response/question";
import ERROR from "@/constants/errors";

import { DotLottieVue } from "@lottiefiles/dotlottie-vue";
const animationPath = new URL("@/assets/confetti.lottie", import.meta.url).href;

import { ref, computed, onMounted, nextTick, reactive, watch } from "vue";

import TextArea from "@/shared/components/Common/TextArea.vue";
import { VueDraggable } from "vue-draggable-plus";
import { HolderOutlined } from "@ant-design/icons-vue";
import { Modal } from "ant-design-vue";
import Highcharts from "highcharts";
import { useRouter, useRoute } from "vue-router";
import Validator from "@/services/Validator";
import { mergeQuestionMedia } from "@/services/QuestionMediaService";
import QuestionMediaView from "@/shared/components/Media/QuestionMediaView.vue";
import RichContent from "@/shared/components/Common/RichContent.vue";
import FlashcardAnswerCard from "@/shared/components/Flashcard/FlashcardAnswerCard.vue";
import ShuffleQuestionData from "@/services/ShuffleQuestionData";

const route = useRoute();
const router = useRouter();

import { useI18n } from "vue-i18n";

const { t } = useI18n();

interface UserAnswer {
    questionId: string;
    type: string;
    isSkipped: boolean;
    result: boolean;
    resultText: string;
    multipleChoices: string[] | null;
    matchingLeft: any[] | null;
    matchingRight: any[] | null;
    ordering: any[] | null;
    shortText: string;
}

interface TestQuizModel {
    title: string;
    description: string;
    totalQuestionCount: number;
    questions: ResponseQuestion[];
}

const quiz = ref<TestQuizModel>({
    title: "",
    description: "",
    totalQuestionCount: 0,
    questions: [],
});

const incorrect = computed((): UserAnswer[] => {
    return userAnswer.value.filter((x) => x.result === false);
});

const currentQuestion = ref<ResponseQuestion>({} as ResponseQuestion);

const currentQuestionInstruction = ref("");
const currentQuestionIsSkipped = ref(false);
const isSubmitted = ref(false);

/* adjust multiple choice layout */
const isOptionExceed = computed(() => {
    return currentQuestion.value.questionData.multipleChoice?.some((x) => x.text.length >= 100);
});

const userAnswerMultipleChoice = ref<string[]>([]);

const userAnswerMatchingLeft = ref<any[]>([]);
const userAnswerMatchingRight = ref<any[]>([]);

const userAnswerOrdering = ref<any[]>([]);
const userAnswerShortText = ref<string>("");

const userAnswer = ref<UserAnswer[]>([]);

const reset = () => {
    userAnswer.value = [];
    isSubmitted.value = false;
    onLoadCurrentQuestion(0);
    syncMatchingHeights();
    timerStart();
};

//#region setting modal
/* setting modal  */
const setting_modal_open = ref(false);

const openSettingModal = () => {
    setting_modal_open.value = true;

    //get settings from session or default
    let session_settings = sessionStorage.getItem("test_settings");
    if (!session_settings) return;

    settingFormState.numberOfQuestion = JSON.parse(session_settings).numberOfQuestion;
    settingFormState.questionTypes = JSON.parse(session_settings).questionTypes;
};

const closeSettingModal = () => {
    setting_modal_open.value = false;
};

const settingFormRef = ref();
const settingFormState = reactive({
    numberOfQuestion: 1,
    questionTypes: [
        QUESTION_TYPE.MULTIPLE_CHOICE,
        QUESTION_TYPE.MATCHING,
        QUESTION_TYPE.ORDERING,
        QUESTION_TYPE.SHORT_TEXT,
    ],
});

const toggleQuestionType = (type: string, checked: boolean) => {
    if (checked) {
        if (!settingFormState.questionTypes.includes(type)) {
            settingFormState.questionTypes.push(type);
        }
    } else {
        const index = settingFormState.questionTypes.indexOf(type);
        if (index !== -1) {
            settingFormState.questionTypes.splice(index, 1);
        }
    }
};

const onCreateNewTest = async () => {
    reset();

    await getQuizData();

    //save settings to session
    sessionStorage.setItem("test_settings", JSON.stringify(settingFormState));

    closeSettingModal();
};

//#endregion

//#region init data
const questionSetId = ref<string>(route.params.id.toString());
const loading = ref(false);
const isAllowed = ref(true);
const quizTypes = ref<string[]>([]);
// số câu hỏi theo từng loại (API QuestionSet/{id}/Types)
const quizTypeCounts = ref<Record<string, number>>({});

const loadFailed = ref(false);

const getQuizTypes = async () => {
    try {
        if (!Validator.isValidGuid(questionSetId.value.toString())) {
            router.push({ name: "404" });
            return;
        }
        loading.value = true;
        const result = await ApiQuestionSet.GetQuizTypes(questionSetId.value.toString());
        if (result.data.success) {
            quizTypes.value = result.data.data.map((x: any) => x.type);
            quizTypeCounts.value = Object.fromEntries(
                result.data.data.map((x: any) => [x.type, Number(x.count) || 0]),
            );
            settingFormState.questionTypes = result.data.data.map((x: any) => x.type);
        }
    } catch (error) {
        console.error(error);
        // bộ câu hỏi không tồn tại / không có quyền -> về 404 (không mở modal cài đặt trên trang rỗng)
        loadFailed.value = true;
        router.push({ name: "404" });
    } finally {
        loading.value = false;
    }
};

watch(quizTypes, (newValue) => {
    if (newValue.length > 0) {
        settingFormState.numberOfQuestion = newValue.length;
    }
});

// presigned URL của media hết hạn -> lấy URL mới, chỉ cập nhật media (giữ nguyên bài đang làm)
const reloadQuestionMedia = async () => {
    try {
        const result = await ApiQuestionSet.GetQuestionById(questionSetId.value.toString());
        if (result?.data?.success) {
            mergeQuestionMedia([...quiz.value.questions, currentQuestion.value], result.data.data);
        }
    } catch (error) {
        console.log("ERROR: reload question media", error);
    }
};

const getQuizData = async () => {
    if (!Validator.isValidGuid(questionSetId.value.toString())) {
        router.push({ name: "404" });
        return;
    }
    try {
        loading.value = true;
        let detail_result = await ApiQuestionSet.GetDetailById(questionSetId.value.toString());

        quiz.value.title = detail_result.data.data.name;
        quiz.value.description = detail_result.data.data.description;
        quiz.value.totalQuestionCount = detail_result.data.data.questionCount;

        let result = await ApiQuestionSet.TestQuestions(
            questionSetId.value.toString(),
            settingFormState.numberOfQuestion,
            settingFormState.questionTypes.join(","),
        );

        if (!detail_result.data.success || !result.data.success) {
            router.push({ name: "404" });
            return;
        }

        quiz.value.questions = result.data.data.map((x: ResponseQuestion) =>
            ShuffleQuestionData.shuffleQuestionOptions(x),
        );
        // quiz.value.questions = result.data.data;

        onLoadCurrentQuestion(0);
    } catch (error: any) {
        const errorKeys = Object.keys(error?.response?.data?.errors ?? {});
        if (errorKeys.includes(ERROR.PLAN_REQUIRE_PLAN)) {
            isAllowed.value = false;
            router.back();
        }
    } finally {
        loading.value = false;
    }
};

//#endregion

//#region animation
const animationRef = ref();
const isAnimationDisplaying = ref(false);

const triggerAnimation = () => {
    isAnimationDisplaying.value = true;
    animationRef.value?.getDotLottieInstance()?.play();
    setTimeout(() => {
        isAnimationDisplaying.value = false;
    }, 5000);
};

//#endregion

//#region check user answer
const checkMultipleChoice = (id: string, answer: string[]) => {
    const index = quiz.value.questions.findIndex((x) => x.id === id);
    if (index === -1) return false;

    let correctAnswer = quiz.value.questions[index].questionData.multipleChoice
        ?.filter((x) => x.isAnswer)
        .map((x) => x.id || [])
        .sort();

    let sortedUserAnswer = answer.sort();
    if (answer.length !== correctAnswer?.length) return false;
    return sortedUserAnswer.every((value: string, i: number) => value === correctAnswer[i]);
};

/* use this for checking answer after submit */
const checkMultipleChoiceAnswerCorrect = (option: any) => {
    //only 2 cases allowed to display result: correct and user_answer + incorrect

    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);
    let correctAnswer = quiz.value.questions[index].questionData.multipleChoice
        ?.filter((x) => x.isAnswer)
        .map((x) => x.id || []);

    const useAnswerIndex = userAnswer.value.findIndex(
        (x) => x.questionId === currentQuestion.value.id,
    );
    let user_answer = userAnswer.value[useAnswerIndex].multipleChoices;

    if (correctAnswer?.includes(option.id)) return true; //case 1
    if (user_answer?.includes(option.id) && !option.isAnswer) return false; //case 2

    return true;
};

const checkOrdering = (id: string, answer: any[]) => {
    const index = quiz.value.questions.findIndex((x) => x.id === id);
    if (index === -1) return false;

    let correctAnswer =
        quiz.value.questions[index].questionData.ordering?.map((x) => x.correctOrder).sort() || [];

    let userAnswer = answer.map((x) => x.correctOrder);
    return userAnswer.every((value: number, i: number) => value === correctAnswer[i]);
};

const checkMatching = (id: string, answerLeft: any[], answerRight: any[]) => {
    const index = quiz.value.questions.findIndex((x) => x.id === id);
    if (index === -1) return false;
    let correctMatch = quiz.value.questions[index].questionData.matching!.matches;

    let userAnswerLeft = answerLeft.map((x) => x.id);
    let userAnswerRight = answerRight.map((x) => x.id);

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

//get user answer result
const checkShortText = (id: string, answer: string) => {
    const index = quiz.value.questions.findIndex((x) => x.id === id);
    if (index === -1) return false;
    return (
        cleanShortTextAnswer(answer) ===
        cleanShortTextAnswer(quiz.value.questions[index].questionData.shortText!)
    );
};

// get UI
const checkShortextCorrect = () => {
    const answer = userAnswer.value.find(
        (x) => x.questionId === currentQuestion.value.id,
    )?.shortText;
    if (!answer) return false;

    const correct = quiz.value.questions.find((x) => x.id === currentQuestion.value.id)
        ?.questionData.shortText!;

    return cleanShortTextAnswer(answer) === cleanShortTextAnswer(correct);
};

//get correct answer if user answer is incorrect
const getShortTextCorrectAnswer = computed(() => {
    if (
        currentQuestion.value.type === QUESTION_TYPE.SHORT_TEXT &&
        isSubmitted.value &&
        !checkShortextCorrect()
    ) {
        return quiz.value.questions.find((x) => x.id === currentQuestion.value.id)?.questionData
            .shortText;
    }
});

//#endregion

//#region explain modal
/* explain modal bottom */
const explainModal = ref<HTMLElement | null>(null);
const explainModalOpen = ref(false);
const toggleExplainModal = () => {
    explainModalOpen.value = !explainModalOpen.value;
};

//#endregion

//#region logic complete question
/* handle logic complete question */
const updateUserAnswer = (index: number, newAnswer: UserAnswer) => {
    if (index === -1) {
        userAnswer.value.push(newAnswer);
    } else {
        userAnswer.value[index] = newAnswer;
    }
};

//track change when user perform actions on questions
const onUserAnswerChange = () => {
    if (isSubmitted.value) return; //prevent change detected after submit and re-format user answer

    const index = userAnswer.value.findIndex((x) => x.questionId === currentQuestion.value.id);

    //user changed but still chose to skip
    const isSkipped = currentQuestionIsSkipped.value;
    const resultText = currentQuestionIsSkipped.value ? t("learn_QS.result.skipped") : "";

    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            if (userAnswerMultipleChoice.value.length > 0) {
                updateUserAnswer(index, {
                    questionId: currentQuestion.value.id,
                    type: currentQuestion.value.type,
                    isSkipped: isSkipped,
                    result: false,
                    resultText: resultText,
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
                isSkipped: isSkipped,
                result: false,
                resultText: resultText,
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
                isSkipped: isSkipped,
                result: false,
                resultText: resultText,
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
                    isSkipped: isSkipped,
                    result: false,
                    resultText: resultText,
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

const refactorLeftOverUserAnswer = (quiz_answer: any, base: UserAnswer): UserAnswer => {
    switch (quiz_answer.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE:
            return {
                ...base,
                multipleChoices:
                    quiz_answer.questionData.multipleChoice
                        ?.filter((x: any) => x.isAnswer)
                        .map((x: any) => x.id) ?? [],
            };
        case QUESTION_TYPE.MATCHING: {
            const matching = quiz_answer.questionData.matching;
            const matches = matching?.matches ?? [];
            const leftItems = matching?.leftItems ?? [];
            const rightItems = matching?.rightItems ?? [];

            const matchingLeft = matches.map((match: any) =>
                leftItems.find((item: any) => item.id == match.leftId),
            );
            const matchingRight = matches.map((match: any) =>
                rightItems.find((item: any) => item.id == match.rightId),
            );

            return {
                ...base,
                matchingLeft,
                matchingRight,
            };
        }
        case QUESTION_TYPE.ORDERING:
            return {
                ...base,
                ordering:
                    quiz_answer.questionData.ordering
                        ?.slice()
                        .sort((a: any, b: any) => a.correctOrder - b.correctOrder) ?? [],
            };
        case QUESTION_TYPE.SHORT_TEXT:
            return {
                ...base,
                shortText: quiz_answer.questionData.shortText ?? "",
            };
        default:
            return base;
    }
};

const handleSkippedQuestion = () => {
    quiz.value.questions.forEach((x) => {
        const base = {
            questionId: x.id,
            type: x.type,
            isSkipped: true,
            result: false,
            resultText: t("learn_QS.result.skipped"),
            multipleChoices: null,
            matchingLeft: null,
            matchingRight: null,
            ordering: null,
            shortText: "",
        };

        let index = userAnswer.value.findIndex((answer) => answer.questionId === x.id);

        //add leftover question
        if (index === -1) {
            userAnswer.value.push(refactorLeftOverUserAnswer(x, base));
            index = userAnswer.value.length - 1; //update to the pushed index
        }

        //update skipped question by single (dontknow)
        if (userAnswer.value[index].isSkipped) {
            updateUserAnswer(index, {
                ...userAnswer.value[index],
                ...refactorLeftOverUserAnswer(x, {} as UserAnswer), //keep default base answer
            });
        }
    });
};

const onSubmitAnswer = () => {
    timerEnd();
    // onUserAnswerChange();
    if (userAnswer.value.length < quiz.value.questions.length) {
        Modal.confirm({
            title: `You missed ${quiz.value.questions.length - userAnswer.value.length} questions.`,
            content: "Are you certain about this decision?",
            okText: t("sidebar.buttons.ok"),
            cancelText: t("sidebar.buttons.cancel"),
            centered: true,
            onOk: () => {
                //import all left over question from quiz in to userAnswer
                isSubmitted.value = true;
                handleSkippedQuestion();
                getUserAnswerResult();
            },
        });
    } else {
        isSubmitted.value = true;
        getUserAnswerResult();
    }
};

//calculate user result
const getUserAnswerResult = () => {
    //incase user does not interact anything in currentquestion and skip => show them correct answer
    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);
    onLoadCurrentQuestion(index);

    userAnswer.value
        .filter((x) => x.isSkipped === false)
        .forEach((answer: UserAnswer) => {
            let result;
            switch (answer.type) {
                case QUESTION_TYPE.MULTIPLE_CHOICE: {
                    result = checkMultipleChoice(answer.questionId, answer.multipleChoices!);
                    answer.result = result;
                    answer.resultText = result
                        ? t("learn_QS.result.correct")
                        : t("learn_QS.result.wrong");
                    break;
                }
                case QUESTION_TYPE.MATCHING: {
                    result = checkMatching(
                        answer.questionId,
                        answer.matchingLeft!,
                        answer.matchingRight!,
                    );
                    answer.result = result;
                    answer.resultText = result
                        ? t("learn_QS.result.correct")
                        : t("learn_QS.result.wrong");
                    break;
                }
                case QUESTION_TYPE.ORDERING: {
                    result = checkOrdering(answer.questionId, answer.ordering!);
                    answer.result = result;
                    answer.resultText = result
                        ? t("learn_QS.result.correct")
                        : t("learn_QS.result.wrong");
                    break;
                }
                case QUESTION_TYPE.SHORT_TEXT: {
                    result = checkShortText(answer.questionId, answer.shortText);
                    answer.result = result;
                    answer.resultText = result
                        ? t("learn_QS.result.correct")
                        : t("learn_QS.result.wrong");
                    break;
                }
            }
        });

    generateChart();

    if (incorrect.value.length === 0) triggerAnimation();
};

//skip single current question
const onSkipQuestion = () => {
    currentQuestionIsSkipped.value = true;

    const index = userAnswer.value.findIndex((x) => x.questionId === currentQuestion.value.id);
    updateUserAnswer(index, {
        questionId: currentQuestion.value.id,
        type: currentQuestion.value.type,
        isSkipped: true,
        result: false,
        resultText: t("learn_QS.result.skipped"),
        multipleChoices: userAnswerMultipleChoice.value,
        matchingLeft: userAnswerMatchingLeft.value,
        matchingRight: userAnswerMatchingRight.value,
        ordering: userAnswerOrdering.value,
        shortText: userAnswerShortText.value,
    });
};

const onLoadCurrentQuestion = (index: number) => {
    syncMatchingHeights();
    currentQuestionIsSkipped.value = false;

    currentQuestion.value = quiz.value.questions[index] as ResponseQuestion;
    const answer = userAnswer.value.find((x) => x.questionId === currentQuestion.value.id);

    switch (currentQuestion.value.type) {
        case QUESTION_TYPE.MULTIPLE_CHOICE: {
            currentQuestionInstruction.value = t("learn_QS.instructions.multiple_choice", {
                number: currentQuestion.value.questionData.multipleChoice?.filter((x) => x.isAnswer)
                    .length,
            });
            userAnswerMultipleChoice.value = answer ? answer?.multipleChoices! : [];
            break;
        }

        case QUESTION_TYPE.ORDERING: {
            currentQuestionInstruction.value = t("learn_QS.instructions.ordering");
            userAnswerOrdering.value = answer
                ? answer?.ordering!
                : currentQuestion.value.questionData.ordering?.map((x) => x) || [];
            break;
        }

        case QUESTION_TYPE.MATCHING: {
            currentQuestionInstruction.value = t("learn_QS.instructions.matching");
            userAnswerMatchingLeft.value = answer
                ? answer?.matchingLeft!
                : currentQuestion.value.questionData.matching!.leftItems.map((x) => x) || [];

            userAnswerMatchingRight.value = answer
                ? answer?.matchingRight!
                : currentQuestion.value.questionData.matching!.rightItems.map((x) => x) || {};

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
    currentQuestionIsSkipped.value = false;

    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);

    if (index < quiz.value.questions.length - 1) {
        onLoadCurrentQuestion(index + 1);
    }
};

const onPreviousQuestion = () => {
    currentQuestionIsSkipped.value = false;

    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);

    if (index > 0) {
        onLoadCurrentQuestion(index - 1);
    }
};

const userAnswerContainQuestion = (questionId: string) => {
    return Array.from(userAnswer.value).some((x) => x.questionId === questionId);
};

const getUserAnswerResultById = (id: string) => {
    return userAnswer.value.find((x) => x.questionId === id && !x.isSkipped)?.result;
};

const userAnswerCurrentQuestionSkipped = computed(() => {
    return userAnswer.value.some((x) => x.questionId === currentQuestion.value.id && x.isSkipped);
});

const userAnswerCurrentQuestionResult = computed(() => {
    const result = userAnswer.value.find((x) => x.questionId === currentQuestion.value.id);
    return {
        result: result?.result,
        resultText: result?.resultText,
    };
});

const hasNextQuestion = computed(() => {
    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);
    return index !== -1 && index < quiz.value.questions.length - 1;
});

const hasPreviousQuestion = computed(() => {
    const index = quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);
    return index !== -1 && index > 0;
});

const currentQuestionIndex = computed(() => {
    return quiz.value.questions.findIndex((x) => x.id === currentQuestion.value.id);
});

//#endregion

//#region final chart
const getCorrectPercentage = () => {
    return Math.floor(
        ((quiz.value.questions.length - incorrect.value.length) / quiz.value.questions.length) *
            100,
    );
};

const getInCorrectPercentage = () => {
    return Math.floor((incorrect.value.length / quiz.value.questions.length) * 100);
};

const toggleResult = () => {
    const content_item_result = $(".content-item-test-result");
    if (content_item_result) $(content_item_result).slideToggle();
};

const generateChart = () => {
    toggleResult();
    Highcharts.setOptions({
        lang: {
            decimalPoint: ".",
            thousandsSep: ",",
        },
    });
    Highcharts.chart("result_chart_container", {
        chart: {
            type: "pie",
            custom: {} as any,
            events: {
                render: function (this: Highcharts.Chart) {
                    const chart = this;
                    const series = chart.series[0] as Highcharts.Series & {
                        center: [number, number];
                    };
                    let customLabel = (chart.options.chart as any).custom.label as
                        | Highcharts.SVGElement
                        | undefined;

                    if (!customLabel) {
                        customLabel = (chart.options.chart as any).custom.label = chart.renderer
                            .label(`<strong>${getCorrectPercentage()}%</strong>`, 0, 0)
                            .css({
                                color: "var(--text-color)",
                                textAnchor: "middle",
                            })
                            .add();
                    }

                    const x = series.center[0] + chart.plotLeft,
                        y =
                            series.center[1] +
                            chart.plotTop -
                            (customLabel.attr("height") as number) / 2;

                    customLabel.attr({
                        x,
                        y,
                    });
                    // adjust font size based on chart width
                    customLabel.css({
                        fontSize: `${series.center[2] / 8}px`,
                    });
                },
            },
        },
        credits: {
            enabled: false,
        },
        plotOptions: {
            pie: {
                borderWidth: 0,
                borderRadius: 3,
            },
        },
        tooltip: {
            pointFormat: "{series.name}: <b>{point.percentage:.0f}%</b>",
        },
        series: [
            {
                type: "pie",
                name: "Result",
                colorByPoint: true,
                innerSize: "75%",
                dataLabels: {
                    enabled: false,
                },
                data: [
                    {
                        name: t("practice_test.other.correct"),
                        y: getCorrectPercentage(),
                        color: "var(--correct-answer-color)",
                    },
                    {
                        name: t("practice_test.other.incorrect"),
                        y: getInCorrectPercentage(),
                        color: "var(--incorrect-answer-color)",
                    },
                ],
            },
        ] as any,
    } as Highcharts.Options);
};
//#endregion

//#region timer
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

const startTime = ref<dayjs.Dayjs>();
const timerResult = ref<string>("");

const timerStart = () => {
    startTime.value = dayjs();
};

const timerEnd = () => {
    const endTime = dayjs();
    const diffMs = endTime.diff(startTime.value); // get duration in milliseconds
    const diffSeconds = Math.floor(diffMs / 1000); //convert to second

    if (diffSeconds < 60) {
        timerResult.value = `${t("practice_test.other.your_time")} ${diffSeconds} ${diffSeconds === 1 ? t("practice_test.other.second") : t("practice_test.other.second_plural")}`;
    } else {
        const duration_ms = dayjs.duration(diffMs);
        const hours = duration_ms.hours();
        const minutes = duration_ms.minutes();

        let result = t("practice_test.other.your_time");
        if (hours > 0)
            result += `${hours} ${hours > 1 ? t("practice_test.other.hour") : t("practice_test.other.hour_plural")} `;
        if (minutes > 0)
            result += `${minutes} ${minutes > 1 ? t("practice_test.other.minute") : t("practice_test.other.minute_plural")}`;
        timerResult.value = result.trim();
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

//#region final buttons
// làm bài mới tại chỗ (giống lúc mở trang): ẩn kết quả, lấy bộ câu mới, mở cài đặt - không reload cả trang
const onNewTest = async () => {
    reset();
    toggleResult();
    await getQuizData();
    openSettingModal();
};

const onRedirectToLearn = () => {
    router.push({ name: "User_QuestionSet_Learn", params: { id: questionSetId.value } });
};

const onRetest = () => {
    const incorrectIds = incorrect.value.map((x) => x.questionId);
    quiz.value.questions = quiz.value.questions.filter((x) => incorrectIds.includes(x.id));

    reset();
    toggleResult();
};

//#endregion

const onRedirectToSubcription = () => {
    sessionStorage.setItem("setting_key", "Subscription");
    router.push({ name: "User_Settings" });
};

// tối đa = tổng số câu của các loại ĐANG ĐƯỢC CHỌN (fallback: tổng số câu của bộ nếu chưa có số liệu theo loại)
const maxSelectableQuestions = computed(() => {
    const counts = quizTypeCounts.value;
    if (Object.keys(counts).length === 0) return quiz.value.totalQuestionCount;
    return settingFormState.questionTypes.reduce((sum, type) => sum + (counts[type] ?? 0), 0);
});

watch(
    [() => settingFormState.numberOfQuestion, maxSelectableQuestions],
    () => {
        const max = maxSelectableQuestions.value;
        if (max <= 0) return;

        if (settingFormState.numberOfQuestion > max) {
            settingFormState.numberOfQuestion = max;
        } else if (settingFormState.numberOfQuestion < 1) {
            settingFormState.numberOfQuestion = 1;
        }
    },
);

onMounted(async () => {
    let session_settings = sessionStorage.getItem("test_settings");
    if (session_settings) {
        settingFormState.numberOfQuestion = Math.max(
            1,
            Math.min(quiz.value.totalQuestionCount, JSON.parse(session_settings).numberOfQuestion),
        );
        settingFormState.questionTypes = JSON.parse(session_settings).questionTypes;
    }
    await getQuizTypes();
    if (loadFailed.value) return;
    await getQuizData();

    openSettingModal();
    onLoadCurrentQuestion(0);
    syncMatchingHeights();
    window.addEventListener("resize", syncMatchingHeights);

    timerStart();
});
</script>

<template>
    <template v-if="isAllowed">
        <div class="page-container">
            <DotLottieVue
                v-if="isAnimationDisplaying"
                :autoplay="isAnimationDisplaying"
                ref="animationRef"
                :class="['animation-container']"
                @complete="isAnimationDisplaying = false"
                :src="animationPath"
            />
            <div class="title-container title-container-header">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="1">
                        <RouterLink :to="{ name: 'User_Library' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="22">
                        <span> {{ quiz.title }}</span> <br />
                        <span>
                            {{ quiz.description }}
                        </span>
                    </a-col>
                    <a-col :span="1">
                        <i class="bx bx-cog test-setting-btn" @click="openSettingModal"></i>
                    </a-col>
                </a-row>
            </div>

            <div class="content content-test d-flex flex-column">
                <div class="d-flex">
                    <div class="content-item question-navigators">
                        <div class="question-navigator-title">
                            {{ t("practice_test.other.question_list") }}
                        </div>
                        <template v-if="loading">
                            <a-skeleton :loading="loading"></a-skeleton>
                        </template>
                        <div v-else class="question-navigator-container">
                            <div
                                :class="[
                                    'question-navigation-item-outer',
                                    currentQuestion.id === item.id ? 'current-question' : '',
                                ]"
                                v-for="(item, index) in quiz.questions"
                            >
                                <div
                                    :class="[
                                        'question-navigator-item',
                                        userAnswerContainQuestion(item.id)
                                            ? 'completed-question'
                                            : '',
                                        isSubmitted
                                            ? getUserAnswerResultById(item.id)
                                                ? 'correct'
                                                : 'incorrect'
                                            : '',
                                    ]"
                                    @click="onLoadCurrentQuestion(index)"
                                >
                                    <span> {{ index + 1 }} </span>
                                </div>
                            </div>
                        </div>
                        <a-button
                            :disabled="isSubmitted"
                            type="primary"
                            :class="[
                                'main-color-btn',
                                isSubmitted ? 'main-color-btn-disabled' : '',
                            ]"
                            @click="onSubmitAnswer"
                        >
                            {{ $t("learn_QS.buttons.submit") }}
                        </a-button>
                    </div>
                    <div class="content-item content-item-test-result">
                        <div class="result-container">
                            <div class="result-section">
                                <div class="result-section-title">
                                    {{ timerResult }}
                                </div>
                                <div class="result-section-statistic">
                                    <div id="result_chart_container"></div>
                                    <div class="result-text-container">
                                        <div class="result-text correct">
                                            {{ $t("practice_test.other.correct") }}
                                            <span>{{
                                                quiz.questions.length - incorrect.length
                                            }}</span>
                                        </div>
                                        <div class="result-text incorrect">
                                            {{ $t("practice_test.other.incorrect") }}
                                            <span> {{ incorrect.length }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="result-section result-section-buttons">
                                <div class="result-section-title">
                                    {{ $t("practice_test.final_modal.button_title") }}
                                </div>
                                <div class="result-button" @click="onNewTest">
                                    <i class="bx bxs-news"></i>
                                    <div>
                                        <div class="result-button-title">
                                            {{ $t("practice_test.final_modal.buttons.new_test") }}
                                        </div>
                                        <div class="result-button-content">
                                            {{
                                                $t("practice_test.final_modal.buttons_ins.new_test")
                                            }}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    v-if="getInCorrectPercentage() > 0"
                                    class="result-button"
                                    @click="onRetest"
                                >
                                    <i class="bx bx-reset"></i>
                                    <div>
                                        <div class="result-button-title">
                                            {{ $t("practice_test.final_modal.buttons.re_test") }}
                                        </div>
                                        <div class="result-button-content">
                                            {{
                                                $t("practice_test.final_modal.buttons_ins.re_test")
                                            }}
                                        </div>
                                    </div>
                                </div>
                                <div class="result-button" v-else @click="onRedirectToLearn">
                                    <i class="bx bx-analyse"></i>
                                    <div>
                                        <div class="result-button-title">
                                            {{ $t("practice_test.final_modal.buttons.practice") }}
                                        </div>
                                        <div class="result-button-content">
                                            {{
                                                $t("practice_test.final_modal.buttons_ins.practice")
                                            }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-item">
                    <template v-if="loading">
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                    </template>
                    <div v-else class="section question-section">
                        <div class="question-info-index">
                            {{ $t("create_QS.question.question") }} {{ currentQuestionIndex + 1 }}
                        </div>
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
                            <div class="d-flex align-items-center">
                                <div class="answer-section-ins">
                                    {{ currentQuestionInstruction }}
                                </div>
                                <div
                                    :class="[
                                        'ms-3 learn-question-result',
                                        isSubmitted
                                            ? userAnswerCurrentQuestionResult.result
                                                ? 'result-correct'
                                                : 'result-incorrect'
                                            : '',
                                        userAnswerCurrentQuestionSkipped ? 'result-skipped' : '',
                                    ]"
                                >
                                    {{ userAnswerCurrentQuestionResult.resultText }}
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
                                            :disabled="
                                                userAnswerCurrentQuestionSkipped || isSubmitted
                                            "
                                            :class="[
                                                'answer-option answer-option-multiplechoice',
                                                isSubmitted &&
                                                checkMultipleChoiceAnswerCorrect(option) &&
                                                option.isAnswer
                                                    ? 'answer-correct'
                                                    : '',
                                                isSubmitted &&
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
                                                    isSubmitted &&
                                                    checkMultipleChoiceAnswerCorrect(option) &&
                                                    option.isAnswer
                                                "
                                                class="bx bx-check answer-icon"
                                            ></i>
                                            <i
                                                v-if="
                                                    isSubmitted &&
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
                                            :disabled="
                                                userAnswerCurrentQuestionSkipped || isSubmitted
                                            "
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
                                            <template
                                                v-for="(option, index) in userAnswerMatchingLeft"
                                            >
                                                <div class="d-flex align-items-center">
                                                    <div
                                                        :class="[
                                                            'answer-option answer-option-matching',
                                                            isSubmitted
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
                                                            isSubmitted
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
                                            :disabled="
                                                userAnswerCurrentQuestionSkipped || isSubmitted
                                            "
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
                                                    <i
                                                        :class="[
                                                            'bx bxs-label matching-icon',
                                                            isSubmitted
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
                                                            isSubmitted
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
                                        :disabled="userAnswerCurrentQuestionSkipped || isSubmitted"
                                        v-model="userAnswerOrdering"
                                        :options="dragOptions"
                                        @end="onUserAnswerChange"
                                    >
                                        <template v-for="(option, index) in userAnswerOrdering">
                                            <div
                                                :class="[
                                                    'answer-option answer-option-ordering',
                                                    isSubmitted
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
                                                        !isSubmitted ? 'd-none' : '',
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
                                        :class="[
                                            'answer-short-text',
                                            isSubmitted
                                                ? checkShortextCorrect()
                                                    ? 'answer-correct'
                                                    : 'answer-incorrect'
                                                : '',
                                        ]"
                                    >
                                        <div class="w-100 d-flex align-items-center">
                                            <TextArea
                                                :readonly="
                                                    userAnswerCurrentQuestionSkipped || isSubmitted
                                                "
                                                :placeholder="'Enter your answer...'"
                                                v-model="userAnswerShortText"
                                                @change="onUserAnswerChange"
                                            />
                                            <i
                                                v-if="isSubmitted && checkShortextCorrect()"
                                                class="bx bx-check answer-icon"
                                            ></i>
                                            <i
                                                v-if="isSubmitted && !checkShortextCorrect()"
                                                class="bx bx-x answer-icon"
                                            ></i>
                                        </div>
                                        <div
                                            v-if="isSubmitted && !checkShortextCorrect()"
                                            class="short-text-correct-answer"
                                        >
                                            Correct answer:
                                            <span>
                                                <RichContent
                                                    :content="getShortTextCorrectAnswer"
                                                    :format="currentQuestion.textFormat"
                                                    inline
                                                />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <FlashcardAnswerCard v-if="isSubmitted" :question="currentQuestion" />
                        </div>
                        <div class="learn-question-footer">
                            <a-button
                                :class="[
                                    'main-color-btn',
                                    !hasPreviousQuestion ? 'main-color-btn-disabled' : '',
                                ]"
                                type="primary"
                                @click="onPreviousQuestion"
                            >
                                <i class="bx bx-chevron-left"></i>
                                {{ $t("practice_test.buttons.previous") }}
                            </a-button>
                            <div
                                v-if="!isSubmitted"
                                :class="[
                                    'main-color-btn-ghost',
                                    userAnswerCurrentQuestionSkipped || isSubmitted
                                        ? 'main-color-btn-ghost-disabled'
                                        : '',
                                ]"
                                @click="onSkipQuestion()"
                            >
                                {{ $t("learn_QS.buttons.dont_know") }}
                            </div>
                            <div
                                v-else
                                :class="['main-color-btn-ghost me-3']"
                                @click="toggleExplainModal"
                            >
                                <i class="bx bx-bulb me-2"></i>
                                {{ $t("learn_QS.buttons.explaination") }}
                            </div>
                            <div class="d-flex">
                                <a-button
                                    :class="[
                                        'main-color-btn',
                                        !hasNextQuestion ? 'main-color-btn-disabled' : '',
                                    ]"
                                    type="primary"
                                    @click="onNextQuestion"
                                >
                                    {{ $t("learn_QS.buttons.next_question") }}
                                    <i class="bx bx-chevron-right"></i>
                                </a-button>
                            </div>
                        </div>
                    </div>
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
                            !hasNextQuestion ? 'main-color-btn-disabled' : '',
                        ]"
                        type="primary"
                        @click="onNextQuestion"
                    >
                        {{ $t("learn_QS.buttons.next_question") }}
                        <i class="bx bx-chevron-right"></i>
                    </a-button>
                </div>
            </div>
        </div>
    </template>
    <template v-else
        ><div class="page-container">
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
    </template>

    <a-modal
        centered
        wrap-class-name="medium-modal"
        :open="setting_modal_open"
        @cancel="closeSettingModal"
    >
        <div class="title-container">
            <a-row class="w-100 d-flex align-items-center justify-content-between">
                <a-col :span="1">
                    <div @click="closeSettingModal">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </div>
                </a-col>
                <a-col class="main-title" :span="20">
                    <span> {{ $t("practice_test.setting_modal.title") }}</span> <br />
                </a-col>
            </a-row>
        </div>
        <a-form class="setting-form">
            <a-form-item>
                <div class="setting-form-item">
                    <div>
                        {{
                            $t("practice_test.setting_modal.max_question", {
                                length: maxSelectableQuestions,
                            })
                        }}
                    </div>
                    <a-input-number
                        size="large"
                        id="inputNumber"
                        v-model:value="settingFormState.numberOfQuestion"
                        :min="1"
                        :max="maxSelectableQuestions"
                        :precision="0"
                    />
                </div>
            </a-form-item>
            <a-divider style="background-color: var(--form-item-border-color)"></a-divider>
            <a-form-item>
                <div class="setting-form-item setting-form-switch" v-for="type in quizTypes">
                    <div>{{ t(`create_QS.type.${type}`) }}</div>
                    <a-switch
                        :disabled="
                            settingFormState.questionTypes.length <= 1 &&
                            settingFormState.questionTypes.includes(type)
                        "
                        :checked="settingFormState.questionTypes.includes(type)"
                        @change="(checked: boolean) => toggleQuestionType(type, checked)"
                    ></a-switch>
                </div>
            </a-form-item>
        </a-form>

        <template #footer>
            <a-button
                type="primary"
                class="main-color-btn"
                size="large"
                shape="round"
                @click="onCreateNewTest"
            >
                {{ t("practice_test.setting_modal.create_new_test") }}
            </a-button>
        </template>
    </a-modal>
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

.content-item {
    width: 70%;
    margin: 16px auto;
    padding: 24px;
}

.content-item.question-navigators {
    position: absolute;
    top: 75px;
    width: 200px;
    height: fit-content;
    margin: 16px 0px 0px 16px;
    padding: 16px;
}

.question-navigator-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--c-text-muted);
}
.question-navigator-container {
    gap: 6px;
    margin: 12px 0px;
}
.question-navigation-item-outer {
    width: calc(25% - 5px);
    margin: 0px;
    padding: 2px;
    border: 1px solid var(--form-item-border-color);
    border-radius: var(--ui-r-sm);
    font-size: 13px;
    font-weight: 600;
}
.question-navigation-item-outer.current-question {
    border-color: var(--main-color);
    box-shadow: 0 0 0 1px var(--main-color);
}
.question-navigator-item {
    padding: 4px 0px;
    border-radius: var(--ui-r-xs);
}

.question-info-index {
    margin-bottom: 12px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-color: transparent;
    border-radius: var(--ui-r-xs);
    color: var(--c-primary-text);
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
.short-text-correct-answer span {
    font-size: 16px;
    font-weight: 600;
    color: var(--c-success-text);
}

.completed-question.correct {
    background-color: var(--correct-answer-color);
    border-color: var(--correct-answer-color);
}
.completed-question.incorrect {
    background-color: var(--incorrect-answer-color);
    border-color: var(--incorrect-answer-color);
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

#result_chart_container {
    width: 200px;
    height: 200px;
}

::v-deep(.highcharts-background) {
    fill: transparent;
}

::v-deep(.highcharts-title) {
    display: none;
}

.content-item-test-result {
    display: none;
}
.result-container {
    display: flex;
    align-items: start;
    justify-content: space-between;
}
.result-text-container {
    font-size: 18px;
}
.result-text {
    margin: 20px 10px;
    width: 160px;
    display: flex;
    justify-content: space-between;
    font-weight: 600;
}
.result-text span {
    padding: 0px 20px;
    border: 1px solid transparent;
    border-radius: 999px;
}
.result-text.correct {
    color: var(--correct-answer-color);
}
.result-text.correct span {
    border-color: var(--correct-answer-color);
}

.result-text.incorrect {
    color: var(--incorrect-answer-color);
}

.result-text.incorrect span {
    border-color: var(--incorrect-answer-color);
}

::v-deep(.answer-correct textarea) {
    border-color: var(--correct-answer-color);
}

::v-deep(.answer-incorrect textarea) {
    border-color: var(--incorrect-answer-color);
}
.test-setting-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 22px;
    color: var(--c-text);
    background-color: var(--c-surface-raised);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}
.test-setting-btn:hover {
    color: var(--c-primary-text);
    border-color: var(--main-color);
}

.result-section-title {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-color-grey);
    text-align: end;
}

.result-section-statistic {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.result-section-buttons {
    display: flex;
    flex-direction: column;
    justify-content: end;
    align-items: start;
}
.result-button {
    display: flex;
    align-items: center;
    width: 400px;
    margin: 10px 0px;
    padding: 5px;
    height: 80px;
    max-height: 80px;
    max-width: 400px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    cursor: pointer;
    transition: all 0.15s ease;
}
.result-button:hover {
    border-color: var(--main-color);
}

.result-button i {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin: 10px;
    font-size: 26px;
    color: var(--c-primary-text);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-radius: var(--ui-r-sm);
}

.result-button-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--c-primary-text);
}

.result-button-content {
    font-size: 14px;
    color: var(--c-text-muted);
}

.setting-form {
    padding: 10px;
}

.setting-form-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 20px 0px;
    color: var(--text-color);
    font-size: 16px;
    font-weight: 500;
}
.setting-form-switch {
    padding-bottom: 5px;
    border-bottom: 1px solid var(--form-item-border-color);
}

.animation-container {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 100;
}

@media (max-width: 767.98px) {
    .result-container {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
    }

    .result-section-title {
        text-align: start;
    }

    .result-section-statistic {
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    .result-section-buttons {
        align-items: stretch;
    }

    .result-button {
        width: 100%;
        height: auto;
        max-height: none;
        margin: 0px;
    }

    .result-button + .result-button {
        margin-top: 12px;
    }
}
</style>
