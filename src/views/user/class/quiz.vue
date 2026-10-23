<script setup lang="ts">
import ApiClass from "@/api/ApiClass";

import type ClassQuestionSetPageParams from "@/models/request/class/classQSPageParams";
import type { Class } from "@/models/response/class/class";
import type { ClassQuestionSet } from "@/models/response/class/classQuestionSet";
import CLASS_STUDENT_POSITION from "@/constants/classStudentPosition";

import { ref, onMounted, reactive, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { message, Modal } from "ant-design-vue";
import Input from "@/shared/components/Common/Input.vue";
import { useI18n } from "vue-i18n";
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

const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    name: route.query.name?.toString() || "",
    // shareMode: route.query.shareMode || share_mode_options.value[0].value,
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});

const question_set_data = ref<ClassQuestionSet[]>([]);
const userRoleInClass = ref<string>("");
const loading = ref(false);
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
        let result = await ApiClass.GetAllQSByLimit(
            classId.value.toString(),
            pageParams as ClassQuestionSetPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            question_set_data.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;

            if (pageParams.statusFilter) {
                //check if filter is active
                if (pageParams.pageNumber > resultData.totalPages && pageParams.totalCount > 0) {
                    pageParams.pageNumber = 1;

                    router.push({
                        name: "User_Class_Quiz",
                        params: {
                            id: classId.value,
                        },
                        query: {
                            pageNumber: 1,
                            pageSize: pageParams.pageSize,
                            name: pageParams.name,
                            // shareMode: pageParams.shareMode,
                        },
                    });
                } else {
                    router.push({
                        name: "User_Class_Quiz",
                        params: {
                            id: classId.value,
                        },
                        query: {
                            pageNumber: pageParams.pageNumber,
                            pageSize: pageParams.pageSize,
                            name: pageParams.name,
                            // shareMode: pageParams.shareMode,
                        },
                    });
                }
                pageParams.statusFilter = !pageParams.statusFilter; //toggle filter status
            }
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT class qs: " + error);
    } finally {
        loading.value = false;
    }
};

//update when page change (url)
// onUpdated(() => {
//     if (Object.keys(route.query).length === 0) {
//         pageParams.pageNumber = route.query.pageNumber || 1;
//         pageParams.pageSize = route.query.pageSize || 10;
//         pageParams.name = route.query.name?.toString() || "";
//         // pageParams.shareMode = route.query.status || share_mode_options.value[0].value;
//         pageParams.statusFilter = true;

//         getData();
//     }
// });

watch(
    () => Object.keys(route.query).length,
    () => {
        pageParams.pageNumber = route.query.pageNumber || 1;
        pageParams.pageSize = route.query.pageSize || 10;
        pageParams.name = route.query.name?.toString() || "";
        // pageParams.shareMode = route.query.status || share_mode_options.value[0].value;
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

const onDeleteQSFromClass = (questionSetId: string) => {
    Modal.confirm({
        title: t("class_question_set.modal.delete_title"),
        content: t("class_question_set.modal.delete_content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            const result = await ApiClass.DeleteQuestionSetFromClass(
                classData.value.classId,
                questionSetId,
            );
            if (!result.data.success) {
                message.error(t("message.removed_failed"));
                return;
            }
            message.success(t("message.removed_successfully"));
            getData();
        },
    });
};

const onRedirectToDetail = (id: string) => {
    router.push({ name: "User_QuestionSet_Detail", params: { id } });
};

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
                        <span>{{ $t("class_question_set.title") }}</span>
                        <span>{{ $t("class_question_set.sub_title") }}</span>
                    </div>
                </div>
                <div class="content-item-functions">
                    <div class="content-item-navigators">
                        <div class="navigator-container">
                            <RouterLink class="navigator-item" :to="{ name: 'User_Class_Exam' }">
                                {{ $t("class_index.navigators.exam") }}
                            </RouterLink>
                            <RouterLink class="navigator-item navigator-active" :to="{ name: '' }">
                                {{ $t("class_index.navigators.quiz") }}
                            </RouterLink>
                            <RouterLink class="navigator-item" :to="{ name: 'User_Class_Student' }">
                                {{ $t("class_index.navigators.member") }}
                            </RouterLink>
                        </div>
                    </div>
                    <!-- <a-select
                        v-model:value="pageParams.shareMode"
                        style="width: 200px"
                        @change="getData"
                    >
                        <a-select-option v-for="option in share_mode_options" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select> -->
                    <div style="width: 300px; padding: 0px">
                        <Input
                            @input="getData"
                            v-model="pageParams.name"
                            :placeholder="t('question_sets_index.search_placeholder')"
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
                    <div v-if="question_set_data.length > 0" class="quiz-item-container">
                        <div class="quiz-item" v-for="exam in question_set_data">
                            <i class="bx bx-book-open quiz-item-icon"></i>
                            <div>
                                <div class="quiz-item-title">
                                    {{ exam.name }}
                                </div>
                                <div class="quiz-item-description">
                                    {{ exam.description }}
                                </div>
                                <div class="quiz-item-info quiz-info-detail">
                                    <div class="quiz-item-questions">
                                        <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                        {{ $t("dashboards.list_items.quiz.questions", exam.totalQuestionCount) }}
                                    </div>
                                    <div class="quiz-item-created-by">
                                        {{ $t("class_question_set.other.created_by") }}
                                        {{ exam.createBy }}
                                    </div>
                                </div>
                            </div>
                            <div class="exam-item-actions">
                                <a-button
                                    type="primary"
                                    class="me-3 main-color-btn"
                                    @click="onRedirectToDetail(exam.id)"
                                >
                                    {{ $t("class_question_set.buttons.view") }}
                                </a-button>

                                <a-tooltip
                                    v-if="userRoleInClass !== CLASS_STUDENT_POSITION.STUDENT"
                                >
                                    <template #title>
                                        {{ $t("question_sets_index.buttons.delete") }}
                                    </template>
                                    <i
                                        style="cursor: pointer"
                                        class="text-danger bx bx-trash-alt"
                                        @click="onDeleteQSFromClass(exam.id)"
                                    ></i>
                                </a-tooltip>
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
                                `${range[0]}-${range[1]} of ${total} ${t('class_question_set.other.items')}`
                        "
                        show-size-changer
                        show-quick-jumper
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

.quiz-item-container {
    height: 540px;
}

.quiz-item {
    background-color: var(--c-surface-subtle);
    margin: 12px 0px;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    cursor: default;
}
.quiz-item:hover {
    border-color: var(--main-color);
    transform: none;
    box-shadow: none;
}

.quiz-item > div:nth-child(2) {
    flex: 1;
    min-width: 0;
}

.quiz-item-icon {
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

.quiz-item-title {
    font-size: 16px;
}

.quiz-item-description {
    font-size: 14px;
    font-weight: 400;
    color: var(--c-text-muted);
}

.exam-item-actions {
    flex: none;
    margin-left: 12px;
}
.exam-item-actions i {
    width: 36px;
    height: 36px;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--ui-r-md);
    transition: background-color 0.15s ease;
}
.exam-item-actions i:hover {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
}
</style>
