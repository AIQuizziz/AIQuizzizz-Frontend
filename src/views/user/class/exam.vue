<script setup lang="ts">
import ApiClass from "@/api/ApiClass";
import ApiTest from "@/api/ApiTest";

import CLASS_STUDENT_POSITION from "@/constants/classStudentPosition";
import CLASS_EXAM_STATUS from "@/constants/classExamStatus";
import type ClassExamPageParams from "@/models/request/class/classExamPageParams";
import type { Class } from "@/models/response/class/class";
import type { ClassExam } from "@/models/response/class/classExam";

import { ref, onMounted, reactive, computed, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";

import { useRoute, useRouter } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";
import { FileDoneOutlined } from "@ant-design/icons-vue";
import { Modal, message } from "ant-design-vue";
import Validator from "@/services/Validator";

const route = useRoute();
const router = useRouter();

const { t } = useI18n();
const emit = defineEmits(["updateSidebar"]);

const classId = ref(route.params.id || "");
const classData = ref<Class>({
    classId: "",
    name: "",
    topic: "",
});

const optionKeys = Object.values(CLASS_EXAM_STATUS);

const exam_status_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`class_exam.select_option.${key}`),
        value: key !== CLASS_EXAM_STATUS.ALL ? key : "",
    })),
);

const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    testName: route.query.testName?.toString() || "",
    status: route.query.status || exam_status_options.value[0].value,
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});

const exam_data = ref<ClassExam[]>([]);
const userRoleInClass = ref<string>("");
const loading = ref<boolean>(false);
const getPermission = async () => {
    try {
        const result = await ApiClass.GetUserPermission(classId.value.toString());
        if (result.data.success) {
            userRoleInClass.value = result.data.data;
        }
    } catch (error) {
        console.log(error);
    }
};

/** @returns false nếu không tải được lớp (đã chuyển hướng) -> không gọi tiếp các API khác */
const getClassData = async (): Promise<boolean> => {
    try {
        if (!classId.value || !Validator.isValidGuid(classId.value.toString())) {
            router.replace({ name: "404" });
            return false;
        }

        let result = await ApiClass.GetById(classId.value.toString());
        if (!result.data.success) {
            router.replace({ name: "User_Class" });
            return false;
        }

        classData.value = result.data.data;
        updateClassFormState.name = classData.value.name;
        updateClassFormState.topic = classData.value.topic;
        return true;
    } catch (error: any) {
        // Lớp đã bị xoá / không có quyền / lỗi khác: toast đã do interceptor hiển thị, về danh sách lớp
        router.replace({ name: "User_Class" });
        return false;
    }
};

const getData = async () => {
    try {
        loading.value = true;
        let result = await ApiClass.GetAllExamByLimit(
            classId.value.toString(),
            pageParams as ClassExamPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            exam_data.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;

            if (pageParams.statusFilter) {
                //check if filter is active
                if (pageParams.pageNumber > resultData.totalPages && pageParams.totalCount > 0) {
                    pageParams.pageNumber = 1;

                    router.push({
                        name: "User_Class_Exam",
                        params: {
                            id: classId.value,
                        },
                        query: {
                            pageNumber: 1,
                            pageSize: pageParams.pageSize,
                            testName: pageParams.testName,
                            status: pageParams.status,
                        },
                    });
                } else {
                    router.push({
                        name: "User_Class_Exam",
                        params: {
                            id: classId.value,
                        },
                        query: {
                            pageNumber: pageParams.pageNumber,
                            pageSize: pageParams.pageSize,
                            testName: pageParams.testName,
                            status: pageParams.status,
                        },
                    });
                }
                pageParams.statusFilter = !pageParams.statusFilter; //toggle filter status
            }
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT class exam: " + error);
    } finally {
        loading.value = false;
    }
};

//update when page change (url)
// onUpdated(() => {
//     if (Object.keys(route.query).length === 0) {
//         pageParams.pageNumber = route.query.pageNumber || 1;
//         pageParams.pageSize = route.query.pageSize || 10;
//         pageParams.testName = route.query.testName?.toString() || "";
//         pageParams.status = route.query.status || exam_status_options.value[0].value;
//         pageParams.statusFilter = true;

//         getData();
//     }
// });

watch(
    () => Object.keys(route.query).length,
    () => {
        pageParams.pageNumber = route.query.pageNumber || 1;
        pageParams.pageSize = route.query.pageSize || 10;
        pageParams.testName = route.query.testName?.toString() || "";
        pageParams.status = route.query.status || exam_status_options.value[0].value;
        pageParams.statusFilter = true;

        getData();
    },
);

//change when page change (pageParams)
const onPaginationChange = (page: any, pageSize: any) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    pageParams.statusFilter = true;
    getData();
};

// Khoảng thời gian (số phút, >= 0) -> "x phút/giờ/ngày/tuần/tháng/năm" với số ít/số nhiều theo i18n
const formatDuration = (minutes: number) => {
    const units: [string, number][] = [
        ["year", 60 * 24 * 365],
        ["month", 60 * 24 * 30],
        ["week", 60 * 24 * 7],
        ["day", 60 * 24],
        ["hour", 60],
        ["minute", 1],
    ];
    for (const [unit, size] of units) {
        if (minutes >= size) {
            const n = Math.floor(minutes / size);
            return t(`class_exam.other.unit_${unit}`, { n }, n);
        }
    }
    return t("class_exam.other.unit_minute", { n: 0 }, 0);
};

const getAssignedText = (exam: ClassExam) => {
    const minutes = dayjs().diff(dayjs(exam.timeStart), "minute");
    if (minutes < 1) return t("class_exam.other.assigned_just_now");
    return `${t("class_exam.other.assigned")} ${formatDuration(minutes)}${t("class_exam.other.ago")}`;
};

const getStartInText = (exam: ClassExam) => {
    const minutes = Math.max(1, dayjs(exam.timeStart).diff(dayjs(), "minute"));
    return `${t("class_exam.other.start_in")}${formatDuration(minutes)}`;
};

const isStarted = (exam: ClassExam) => !dayjs(exam.timeStart).isAfter(dayjs());

// Ẩn nút làm bài khi đã hết lượt (trừ khi đang có lượt làm dở để tiếp tục)
const canAttempt = (exam: ClassExam) => {
    if (!exam.maxAttempt || exam.userAttemptCount === undefined) return true;
    return exam.hasInProgressAttempt === true || exam.userAttemptCount < exam.maxAttempt;
};

const getTagColor = (status: string) => {
    switch (status) {
        case CLASS_EXAM_STATUS.COMPLETED: {
            return "#3b82f6";
        }
        case CLASS_EXAM_STATUS.ACTIVE: {
            return "#22C55E";
        }
        case CLASS_EXAM_STATUS.UPCOMING: {
            return "#f59e0b";
        }
    }
};

const onRedirectToCreate = () => {
    router.push({ name: "User_Test_Create", params: { id: classId.value } });
};

const onRedirectToUpdate = (testId: string) => {
    router.push({ name: "User_Test_Update", params: { id: testId } });
};

const onDeleteTest = (testId: string) => {
    Modal.confirm({
        title: t("class_exam.modal.delete_title"),
        content: t("class_exam.modal.delete_content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            let result = await ApiTest.Delete(testId);
            if (result.data.success) {
                message.success(t("message.deleted_successfully"));
                getData();
            }
        },
    });
};

const onRedirectToAttempt = (testId: string) => {
    router.push({
        name: "User_Test_Attempt",
        params: { id: testId },
        query: { classId: classId.value },
    });
};

const onRedirectToResult = (testId: string) => {
    router.push({
        name: "User_Class_Exam_Result",
        params: { classId: classId.value, testId: testId },
    });
};

//#region user history modal
type TestResult = {
    studentId: string;
    studentName: string;
    studentEmail: string;
    score: number;
    status: string;
};
const chosenUser = ref<TestResult>({
    studentId: "",
    studentName: "",
    studentEmail: "",
    score: 0,
    status: "",
});

const chosenExam = ref<ClassExam>(
    exam_data.value[0] || {
        testId: "",
        name: "",
        timeStart: "",
        timeLimit: 0,
        numberOfQuestions: 0,
        status: CLASS_EXAM_STATUS.ACTIVE,
        relativeTime: 0,
    },
);

import UserTestAttempts from "@/shared/modals/UserTestAttempts.vue";
const userHistoryModalRef = ref<InstanceType<typeof UserTestAttempts> | null>(null);

const onOpenHistoryModal = async (exam: ClassExam) => {
    chosenExam.value = exam;
    await nextTick();

    userHistoryModalRef.value?.openModal();
};

//#endregion

//#region update class

const rules = {
    name: [
        {
            required: true,
            message: t("message.required"),
            trigger: "change",
        },
        {
            max: 100,
            message: t("message.out_of_range", { max_length: 100 }),
            trigger: "change",
        },
    ],
    topic: [
        {
            max: 100,
            message: t("message.out_of_range", { max_length: 100 }),
            trigger: "change",
        },
    ],
};

const modal_update_open = ref(false);

const updateClassFormRef = ref();
const updateClassFormState = reactive({
    name: classData.value.name,
    topic: classData.value.topic,
});

// đóng modal sửa lớp mà không lưu: trả input về dữ liệu hiện tại của lớp
const onCloseUpdateModal = () => {
    modal_update_open.value = false;
    updateClassFormState.name = classData.value.name;
    updateClassFormState.topic = classData.value.topic;
};

const isUpdateLoading = ref(false);
const onUpdateClass = async () => {
    isUpdateLoading.value = true;
    try {
        updateClassFormRef.value?.validate(); //this will throw err to catch
        let result = await ApiClass.Update({
            classId: classId.value,
            name: updateClassFormState.name,
            topic: updateClassFormState.topic,
        });
        if (!result.data.success) {
            message.error(t("message.updated_failed"));
            return;
        }
        message.success(t("message.updated_successfully"));
        modal_update_open.value = false;
        await getClassData(); // chỉ đổi tên / chủ đề: tải lại thông tin lớp thay vì reload cả trang
    } catch (error) {
        console.log(error);
    } finally {
        isUpdateLoading.value = false;
    }
};
//#endregion

onMounted(async () => {
    const sidebarActiveItem = "class";
    emit("updateSidebar", sidebarActiveItem);

    if (!(await getClassData())) return;
    await getPermission();
    await getData();
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <div class="breadcrumb-container">
                <ul>
                    <li class="title-breadcrumb-item">
                        <RouterLink :to="{ name: 'User_Class' }">
                            <span>{{ $t("class_index.title") }}</span> <br />
                        </RouterLink>
                        <i class="bx bx-chevron-right"></i>
                    </li>
                    <template v-if="userRoleInClass === CLASS_STUDENT_POSITION.OWNER">
                        <li class="title-breadcrumb-item">
                            <RouterLink
                                :to="{ name: '' }"
                                class="breadcrumb-item-class"
                                @click="modal_update_open = true"
                            >
                                <span> {{ classData.name }} </span>
                                <span class="breadcrumb-item-topic"> {{ classData.topic }} </span>
                            </RouterLink>
                            <i class="bx bx-edit"></i>
                        </li>
                    </template>
                    <template v-else>
                        <li class="title-breadcrumb-item">
                            <RouterLink :to="{ name: '' }" class="breadcrumb-item-class">
                                <span> {{ classData.name }} </span>
                                <span class="breadcrumb-item-topic"> {{ classData.topic }} </span>
                            </RouterLink>
                        </li>
                    </template>
                </ul>
            </div>
        </div>
        <div class="content">
            <div class="content-item">
                <div class="content-item-title">
                    <div>
                        <span>{{ $t("class_index.title") }}</span>
                        <span>{{ $t("class_exam.sub_title") }}</span>
                    </div>
                    <a-button
                        v-if="userRoleInClass !== CLASS_STUDENT_POSITION.STUDENT"
                        type="primary"
                        class="main-color-btn"
                        @click="onRedirectToCreate"
                    >
                        <i class="me-2 bx bx-list-plus"></i>
                        {{ $t("class_exam.buttons.assign_test") }}
                    </a-button>
                </div>
                <div class="content-item-functions">
                    <div class="content-item-navigators">
                        <div class="navigator-container">
                            <RouterLink class="navigator-item navigator-active" :to="{ name: '' }">
                                {{ $t("class_index.navigators.exam") }}
                            </RouterLink>
                            <RouterLink class="navigator-item" :to="{ name: 'User_Class_Quiz' }">
                                {{ $t("class_index.navigators.quiz") }}
                            </RouterLink>
                            <RouterLink class="navigator-item" :to="{ name: 'User_Class_Student' }">
                                {{ $t("class_index.navigators.member") }}
                            </RouterLink>
                        </div>
                    </div>
                    <a-select
                        class="me-3"
                        v-model:value="pageParams.status"
                        style="width: 200px"
                        @change="getData"
                    >
                        <a-select-option
                            v-for="option in exam_status_options"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                    <div style="width: 300px; padding: 0px">
                        <Input
                            @input="getData"
                            v-model="pageParams.testName"
                            :placeholder="t('class_exam.other.search_placeholder')"
                        >
                            <template #icon>
                                <i class="bx bx-search"></i>
                            </template>
                        </Input>
                    </div>
                </div>

                <template v-if="loading">
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                </template>
                <template v-else>
                    <div v-if="exam_data.length > 0" class="exam-item-container">
                        <div class="exam-item" v-for="exam in exam_data">
                            <i class="bx bx-book-open exam-item-icon"></i>
                            <div>
                                <div class="exam-item-title">
                                    {{ exam.name }}
                                    <a-tag :color="getTagColor(exam.status)">
                                        {{ $t(`class_exam.select_option.${exam.status}`) }}
                                    </a-tag>
                                </div>
                                <div class="exam-item-info exam-item-date">
                                    <div>
                                        <i class="bx bx-calendar"></i>
                                        {{ dayjs(exam.timeStart).format("DD/MM/YYYY HH:mm") }}
                                    </div>
                                </div>
                                <div class="exam-item-info exam-info-detail">
                                    <div class="exam-item-questions">
                                        <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                        {{ t("class_exam.other.questions_n", { n: exam.numberOfQuestions ?? 0 }, exam.numberOfQuestions ?? 0) }}
                                    </div>
                                    <div class="exam-item-time">
                                        <i class="bx bx-time-five"></i>
                                        {{ exam.timeLimit }}
                                        {{ $t("class_exam.other.min") }}
                                    </div>
                                    <span class="exam-item-assigned completion">
                                        {{
                                            t(
                                                "class_exam.other.completions_n",
                                                { n: exam.numberOfCompletion ?? 0 },
                                                exam.numberOfCompletion ?? 0,
                                            )
                                        }}
                                    </span>
                                    <span v-if="isStarted(exam)" class="exam-item-assigned">
                                        {{ getAssignedText(exam) }}
                                    </span>
                                    <span v-else class="exam-item-assigned">
                                        {{ getStartInText(exam) }}
                                    </span>
                                </div>
                            </div>
                            <div class="exam-item-actions">
                                <a-button
                                    v-if="userRoleInClass === CLASS_STUDENT_POSITION.STUDENT && exam.status === CLASS_EXAM_STATUS.ACTIVE && canAttempt(exam)"
                                    type="primary"
                                    class="main-color-btn"
                                    @click="onRedirectToAttempt(exam.testId)"
                                >
                                    {{ $t("class_exam.buttons.attempt") }}
                                </a-button>

                                <template v-if="userRoleInClass !== CLASS_STUDENT_POSITION.STUDENT">
                                    <a-tooltip v-if="exam.status === CLASS_EXAM_STATUS.UPCOMING">
                                        <template #title>
                                            {{ $t("question_sets_index.buttons.edit") }}
                                        </template>
                                        <i
                                            class="bx bx-edit"
                                            @click="onRedirectToUpdate(exam.testId)"
                                        ></i>
                                    </a-tooltip>
                                    <a-tooltip>
                                        <template #title>
                                            {{ $t("class_member.buttons.history_test") }}
                                        </template>
                                        <i @click="onRedirectToResult(exam.testId)">
                                            <FileDoneOutlined />
                                        </i>
                                    </a-tooltip>
                                    <a-tooltip>
                                        <template #title>
                                            {{ $t("question_sets_index.buttons.delete") }}
                                        </template>
                                        <i
                                            class="text-danger bx bx-trash-alt"
                                            @click="onDeleteTest(exam.testId)"
                                        ></i>
                                    </a-tooltip>
                                </template>
                                <template v-else>
                                    <a-tooltip>
                                        <template #title>
                                            {{ $t("class_member.buttons.history_test") }}
                                        </template>
                                        <i @click="onOpenHistoryModal(exam)">
                                            <FileDoneOutlined />
                                        </i>
                                    </a-tooltip>
                                </template>
                            </div>
                        </div>
                    </div>
                    <template v-else>
                        <div class="w-100 d-flex justify-content-center">
                            <a-empty>
                                <template #description>
                                    <span> {{ $t("class_index.other.no_data_matches") }}</span>
                                </template>
                            </a-empty>
                        </div>
                    </template>
                </template>
                <div class="pagination-container">
                    <a-pagination
                        @change="onPaginationChange"
                        v-model:current="pageParams.pageNumber"
                        :total="pageParams.totalCount"
                        :pageSize="pageParams.pageSize"
                        :show-total="
                            (total: any, range: any) =>
                                `${range[0]}-${range[1]} of ${total} ${t('class_exam.other.items')}`
                        "
                        show-size-changer
                        class="crud-layout-pagination"
                        :locale="{
                            items_per_page: t('class_index.other.pages'),
                        }"
                    ></a-pagination>
                </div>
            </div>
        </div>
    </div>

    <a-modal
        centered
        wrap-class-name="medium-modal"
        :open="modal_update_open"
        @cancel="onCloseUpdateModal"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="4">
                        <RouterLink @click="onCloseUpdateModal" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="20">
                        <span>{{ t("class_index.modal.update_title") }}</span>
                    </a-col>
                </a-row>
            </div>
            <a-form
                ref="updateClassFormRef"
                layout="vertical"
                :rules="rules"
                :model="updateClassFormState"
            >
                <a-form-item>
                    <Input
                        :label="t('class_index.modal.create_class_name_label')"
                        :name="'name'"
                        v-model="updateClassFormState.name"
                        :placeholder="t('class_index.modal.create_class_name_placeholder')"
                        :is-required="true"
                        :max-length="100"
                    ></Input>
                </a-form-item>
                <a-form-item>
                    <Input
                        :label="t('class_index.modal.create_class_topic_label')"
                        :name="'topic'"
                        v-model="updateClassFormState.topic"
                        :placeholder="t('class_index.modal.create_class_topic_placeholder')"
                        :max-length="100"
                    ></Input>
                </a-form-item>
            </a-form>
        </div>
        <template #footer>
            <a-button
                :loading="isUpdateLoading"
                class="main-color-btn"
                key="submit"
                type="primary"
                @click="onUpdateClass"
            >
                {{ $t("update_QS.buttons.update") }}
            </a-button>
        </template>
    </a-modal>

    <UserTestAttempts
        ref="userHistoryModalRef"
        :test-id="chosenExam.testId.toString()"
        :user-id="null"
        :test-name="chosenExam.name"
        :passing-score="0"
        :student-name="null"
    />
</template>
<style scoped>
.content-item {
    padding: 20px;
}

.ant-btn {
    box-shadow: none;
}

.content-item-title {
    font-size: 20px;
}

.navigator-container {
    border-radius: var(--ui-r-md);
    background-color: var(--c-surface-subtle);
}

.navigator-item {
    font-size: 14px !important;
    font-weight: 500;
    border-radius: var(--ui-r-xs);
}

.navigator-item:hover:not(.navigator-active) {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    color: var(--c-primary-text) !important;
}

.exam-item {
    background-color: var(--c-surface-subtle);
    margin: 12px 0px;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    transition: border-color 0.15s ease;
}

.exam-item:hover {
    border-color: var(--main-color);
}

.exam-item i {
    font-size: 18px;
}

.exam-item-icon {
    display: flex;
    width: 36px;
    height: 36px;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    aspect-ratio: 1/1;
    font-size: 16px;
    border-radius: var(--ui-r-md);
    background: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    color: var(--c-primary-text);
    margin-right: 12px;
}

.exam-item-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
}

.exam-item-title .ant-tag {
    margin: 0;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
}

.exam-item > div:nth-child(2) {
    flex: 1;
    min-width: 0;
}

.exam-item-info {
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px 20px;
}

.exam-item-info i {
    font-size: 14px;
}

.exam-item-date {
    font-size: 14px;
    color: var(--c-primary-text);
    font-weight: 500;
}
.exam-info-detail {
    border-top: 1px solid var(--content-item-border-color);
    margin-top: 8px;
    padding-top: 8px;
}

.exam-item-assigned {
    color: var(--c-text-muted);
}

.exam-item-actions {
    flex: none;
    margin-left: 12px;
    display: flex;
    justify-content: end;
    align-items: center;
}
.exam-item-actions i {
    width: 36px;
    height: 36px;
    font-size: 20px;
    margin: 0px 0px 0px 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--ui-r-md);
    transition: background-color 0.15s ease;
}
.exam-item-actions i:hover {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
}
.exam-item-actions i.text-danger:hover {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
}
.exam-item-container {
    min-height: 450px;
}
</style>
