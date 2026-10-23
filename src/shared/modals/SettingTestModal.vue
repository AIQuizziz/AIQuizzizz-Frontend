<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";

import TEST_GRADE_ATTEMPT_METHOD from "@/constants/testGradeAttempMethod";
import TEST_GRADE_QUESTION_METHOD from "@/constants/testGradeQuestionMethod";
import type { RuleObject } from "ant-design-vue/es/form/interface";

import Input from "../components/Common/Input.vue";

import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
dayjs.extend(utc);

const { t } = useI18n();
const router = useRouter();

interface Props {
    className: string;
    formState: any;
    formRef: any;
}

const props = defineProps<Props>();

const modal_open = ref(false);

const openTestSettingModal = () => {
    modal_open.value = true;

    if (props.formState.startTime && props.formState.endTime) {
        range.value[0] = dayjs(props.formState.startTime);
        range.value[1] = dayjs(props.formState.endTime);
    }
};

// đã bấm "Next" thành công ít nhất 1 lần (sau đó mở lại modal từ trang thì Cancel chỉ đóng modal)
const hasConfirmed = ref(false);

// Next: validate (tiêu đề, thời gian, ...) rồi đóng modal
const onNext = async () => {
    props.formState.startTime = range.value[0].toISOString();
    props.formState.endTime = range.value[1].toISOString();

    try {
        await formRef.value.validate();
        if (props.formState.name.trim().length === 0 || props.formState.name.length > 100) return;
        hasConfirmed.value = true;
        modal_open.value = false;
    } catch {}
};

// Cancel: huỷ thật sự. Lần mở đầu tiên -> rời trang về danh sách bài kiểm tra của lớp
const onCancel = () => {
    modal_open.value = false;
    if (!hasConfirmed.value && props.formState.classId) {
        router.push({ name: "User_Class_Exam", params: { id: props.formState.classId } });
    }
};

//expose functions to main ref
defineExpose({
    openTestSettingModal,
});

//#region formstate range
const formRef = ref(props.formRef);
type RangeValue = [Dayjs, Dayjs];
const range = ref<RangeValue>([dayjs().add(30, "minute"), dayjs().add(1, "day")]);
const onRangeChange = (dates: RangeValue) => {
    if (dates) {
        props.formState.startTime = dates[0].toISOString();
        props.formState.endTime = dates[1].toISOString();
        range.value[0] = dates[0];
        range.value[1] = dates[1];
    }
};

const rules = {
    range: [
        {
            validator(_: RuleObject, value: [Dayjs, Dayjs] | null) {
                if (!range.value) {
                    return Promise.reject(t("message.required"));
                }
                const diffInMinutes = range.value[1].diff(range.value[0], "minute");
                if (diffInMinutes < props.formState.timeLimit) {
                    return Promise.reject(
                        t("message.invalid_time_range", { time_limit: props.formState.timeLimit }),
                    );
                }

                if (range.value[0].isBefore(dayjs())) {
                    return Promise.reject(
                        t("message.invalid_time_range", { time_limit: props.formState.timeLimit }),
                    );
                }

                return Promise.resolve();
            },
            trigger: "change",
        },
    ],
    name: [
        {
            validator: (rule: RuleObject, value: string) => {
                if (!value || value.trim().length === 0)
                    return Promise.reject(t("message.required"));
                if (value.trim().length > 100)
                    return Promise.reject(t("message.out_of_range", { max_length: 100 }));
                return Promise.resolve();
            },
            trigger: "change",
        },
    ],
    timeLimit: [
        {
            required: true,
            message: t("message.required"),
            trigger: "change",
        },
    ],
    passingScore: [
        {
            required: true,
            message: t("message.required"),
            trigger: "change",
        },
    ],
    numberOfShuffles: [
        {
            required: true,
            message: t("message.required"),
            trigger: "change",
        },
    ],
    maxAttempt: [
        {
            required: true,
            message: t("message.required"),
            trigger: "change",
        },
    ],
};

//#endregion

//#region attempt select
const optionAttemptKeys = Object.values(TEST_GRADE_ATTEMPT_METHOD);
const select_attempt_options = computed(() =>
    optionAttemptKeys.map((key) => ({
        label: t(`setting_test_modal.final_score_options.${key}`),
        value: key,
    })),
);

//#endregion

//#region grade question select
// const optionGradeQuestionKeys = Object.values(TEST_GRADE_QUESTION_METHOD);
// const select_grade_question_options = computed(() =>
//     optionGradeQuestionKeys.map((key) => ({
//         label: key,
//         value: key,
//     })),
// );
//#endregion

const onQuestionGradeMethodChange = (checked: boolean) => {
    props.formState.gradeQuestionMethod = checked
        ? TEST_GRADE_QUESTION_METHOD.PARTIAL
        : TEST_GRADE_QUESTION_METHOD.ALL_OR_NOTHING;
};

watch(
    () => [props.formState.startTime, props.formState.endTime],
    ([newStart, newEnd]) => {
        if (newStart && newEnd) {
            range.value[0] = dayjs(newStart);
            range.value[1] = dayjs(newEnd);
        }
    },
    { immediate: true },
);

watch(
    () => props.formState.timeLimit,
    async (newTimeLimit) => {
        try {
            await formRef.value.validate();
        } catch {}
    },
);

onMounted(async () => {});
</script>

<template>
    <a-modal
        centered
        width="100%"
        wrap-class-name="full-modal setting-modal"
        :open="modal_open"
        @cancel="onCancel"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="1">
                        <RouterLink
                            v-if="formState.classId"
                            :to="{ name: 'User_Class_Exam', params: { id: formState.classId } }"
                        >
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                        <i v-else class="bx bx-chevron-left navigator-back-button"></i>
                    </a-col>
                    <a-col class="main-title" :span="23">
                        <span>{{ t("setting_test_modal.other.back") }}</span>
                    </a-col>
                </a-row>
            </div>
            <div class="content-item modal-test-setting">
                <div class="content-item-title">
                    <div>
                        <span>{{ t("setting_test_modal.title") }}</span>
                        <span>{{ t("setting_test_modal.sub_title") }}</span>
                    </div>
                </div>
                <a-form
                    ref="formRef"
                    :model="formState"
                    :rules="rules"
                    class="w-100"
                    layout="vertical"
                >
                    <a-form-item name="name">
                        <Input
                            class="question-input-item"
                            v-model="formState.name"
                            :isRequired="true"
                            :placeholder="t('create_QS.other.title_placeholder')"
                            :label="t('setting_test_modal.form.title')"
                            :max-length="100"
                        />
                    </a-form-item>

                    <a-row class="form-item-row">
                        <a-col :span="24">
                            <a-form-item
                                :rules="rules.range"
                                :label="t('setting_test_modal.form.date')"
                                class="input-item"
                                name="range"
                            >
                                <a-range-picker
                                    @change="onRangeChange"
                                    size="large"
                                    show-time
                                    v-model:value="range"
                                ></a-range-picker>
                            </a-form-item>
                        </a-col>
                    </a-row>
                    <a-row class="form-item-row">
                        <a-col :span="10">
                            <a-form-item
                                :label="t('setting_test_modal.form.number_of_attempt')"
                                class="input-item"
                                name="maxAttempt"
                            >
                                <a-input-number
                                    size="large"
                                    :addon-after="t('exam_result.other.time')"
                                    v-model:value="formState.maxAttempt"
                                    min="1"
                                    max="100"
                                    :precision="0"
                                >
                                    <template #prefix>
                                        <i class="bx bx-repost"></i>
                                    </template>
                                </a-input-number>
                            </a-form-item>
                        </a-col>
                        <a-col :span="10">
                            <a-form-item
                                :label="t('setting_test_modal.form.number_of_shuffle')"
                                class="input-item"
                                name="numberOfShuffles"
                            >
                                <a-input-number
                                    size="large"
                                    :addon-after="t('exam_result.other.time')"
                                    v-model:value="formState.numberOfShuffles"
                                    min="1"
                                    max="100"
                                    :precision="0"
                                >
                                    <template #prefix>
                                        <i class="bx bx-shuffle"></i>
                                    </template>
                                </a-input-number>
                            </a-form-item>
                        </a-col>
                    </a-row>
                    <a-row class="form-item-row">
                        <a-col :span="10">
                            <a-form-item
                                :label="t('setting_test_modal.form.time_limit')"
                                class="input-item"
                                name="timeLimit"
                            >
                                <a-input-number
                                    size="large"
                                    :addon-after="t('practice_test.other.minute')"
                                    v-model:value="formState.timeLimit"
                                    min="1"
                                    max="120"
                                    :precision="0"
                                >
                                    <template #prefix>
                                        <i class="bx bx-time-five"></i> </template></a-input-number
                            ></a-form-item>
                        </a-col>
                        <a-col :span="10">
                            <a-form-item
                                :label="t('setting_test_modal.form.passing_score')"
                                class="input-item"
                                name="passingScore"
                            >
                                <a-input-number
                                    size="large"
                                    :addon-after="'%'"
                                    v-model:value="formState.passingScore"
                                    min="1"
                                    max="100"
                                    :precision="0"
                                >
                                    <template #prefix>
                                        <i class="bx bx-check-circle"></i>
                                    </template> </a-input-number
                            ></a-form-item>
                        </a-col>
                    </a-row>
                    <a-row class="form-item-row">
                        <a-col :span="10" class="input-item switch">
                            <div class="switch-content">
                                <div class="switch-title">
                                    {{ t("setting_test_modal.form.show_correct_answer") }}
                                </div>
                                <div class="switch-sub-title">
                                    {{ t("setting_test_modal.form.show_correct_answer_ins") }}
                                </div>
                            </div>
                            <a-switch v-model:checked="formState.isShowCorrectAnswerInReview">
                            </a-switch
                        ></a-col>
                        <a-col :span="10">
                            <a-form-item
                                :label="t('setting_test_modal.form.final_score')"
                                class="input-item"
                            >
                                <a-select size="large" v-model:value="formState.gradeAttemptMethod">
                                    <a-select-option
                                        v-for="option in select_attempt_options"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </a-select-option>
                                </a-select>
                            </a-form-item>
                        </a-col>
                    </a-row>
                    <a-row class="form-item-row">
                        <a-col :span="10" class="input-item switch">
                            <div class="switch-content">
                                <div class="switch-title">
                                    {{ t("setting_test_modal.form.partial_grade_method") }}
                                </div>
                                <div class="switch-sub-title">
                                    {{ t("setting_test_modal.form.partial_grade_method_ins") }}
                                </div>
                            </div>
                            <a-switch
                                :checked="
                                    formState.gradeQuestionMethod ===
                                    TEST_GRADE_QUESTION_METHOD.PARTIAL
                                "
                                @change="onQuestionGradeMethodChange"
                            >
                            </a-switch>
                        </a-col>
                        <a-col :span="10" class="input-item switch">
                            <div class="switch-content">
                                <div class="switch-title">
                                    {{ t("setting_test_modal.form.review_attempt") }}
                                </div>
                                <div class="switch-sub-title">
                                    {{ t("setting_test_modal.form.review_attempt_ins") }}
                                </div>
                            </div>
                            <a-switch v-model:checked="formState.isAllowReviewAfterSubmit">
                            </a-switch>
                        </a-col>
                    </a-row>
                </a-form>
            </div>
        </div>
        <template #footer>
            <a-button
                class="main-color-btn-ghost"
                size="large"
                key="cancel"
                type="ghost"
                @click="onCancel"
            >
                {{ $t("sidebar.buttons.cancel") }}
            </a-button>
            <a-button
                class="main-color-btn"
                size="large"
                key="submit"
                type="primary"
                @click="onNext"
            >
                {{ $t("assign_test.buttons.next") }}
            </a-button>
        </template>
    </a-modal>
</template>
<style scoped>
.modal-title-container .main-title span:nth-child(1) {
    font-size: 20px;
    font-weight: 700;
}

.modal-test-setting {
    border-radius: var(--ui-r-xl);
    border: 1px solid var(--content-item-border-color);
    background: var(--c-surface);
    box-shadow: none;

    height: 60%;
    width: 60%;
    margin: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 24px;
}

.modal-test-setting .content-item-title {
    font-size: 20px;
    font-weight: 700;
}

.modal-test-setting .content-item-title span:nth-child(2) {
    font-size: 14px;
    font-weight: 400;
    color: var(--c-text-muted);
}

::v-deep(.ant-row) {
    width: 100%;
}
::v-deep(.ant-picker) {
    width: 100%;
}

::v-deep(.ant-input-number-group-wrapper) {
    width: 100%;
}

::v-deep(.ant-select) {
    width: 100%;
}

.form-item-row {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
}

.input-item.switch {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}

.switch-content {
    flex: 0.8;
}
.switch-title {
    font-weight: 600;
    color: var(--c-text);
}
.switch-sub-title {
    font-size: 13px;
    color: var(--c-text-muted);
}
</style>
