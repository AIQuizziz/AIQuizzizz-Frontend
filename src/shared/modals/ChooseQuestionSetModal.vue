<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";

import QUESTION_SET_SHARE_MODE from "@/constants/questionSetShareMode";
import type QuestionSetPageParams from "@/models/request/question_set/questionSetPageParams";
import type QuestionSet from "@/models/response/question_set/questionSet";
import type { Folder } from "@/models/response/folder/folder";

import { ref, reactive, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";
import { message, Modal } from "ant-design-vue";

const route = useRoute();
const router = useRouter();

const { t } = useI18n();

const optionKeys = Object.values(QUESTION_SET_SHARE_MODE);

const share_mode_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`question_sets_index.credit.${key}`),
        value: key !== QUESTION_SET_SHARE_MODE.ALL ? key : "",
    })),
);

//#region pagination
const question_set_data = ref<QuestionSet[]>([]);
const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    name: route.query.name?.toString() || "",
    filterBy: share_mode_options.value[0].value,
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});
const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;
        let result = await ApiQuestionSet.GetAllByLimit(pageParams as unknown as QuestionSetPageParams);
        if (result.data.success) {
            let resultData = result.data.data;
            question_set_data.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;
        }
    } catch (error) {
        console.log("ERROR: GETALLBYLIMIT question set: " + error);
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
//         pageParams.shareMode = route.query.shareMode || share_mode_options.value[0].value;
//         pageParams.statusFilter = true;

//         getData();
//     }
// });

watch(
    () => Object.keys(route.query).length,
    () => {
        if (Object.keys(route.query).length === 0) {
            pageParams.pageNumber = route.query.pageNumber || 1;
            pageParams.pageSize = route.query.pageSize || 10;
            pageParams.name = route.query.name?.toString() || "";
            pageParams.filterBy = share_mode_options.value[0].value;
            pageParams.statusFilter = true;

            getData();
        }
    },
);

//change when page change (pageParams)
const onPaginationChange = (page: number, pageSize: number) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    pageParams.statusFilter = true;
    getData();
};
//#endregion

//#region modal
const modal_open = ref(false);

const openModal = async () => {
    modal_open.value = true;
    await getData();
};

const closeModal = () => {
    modal_open.value = false;
};
//expose functions to main ref
defineExpose({
    openModal,
    closeModal,
});

interface Props {
    /** dùng trong trang thư mục: chỉ chọn bộ câu hỏi, không có tab Thư mục */
    hideFolderTab?: boolean;
    /** nhãn nút ở mỗi bộ (mặc định "Xem") */
    actionLabel?: string;
}
const props = withDefaults(defineProps<Props>(), { hideFolderTab: false, actionLabel: "" });

const emit = defineEmits<{
    (e: "switchToFolder"): void;
    (e: "openQuestionSet", questionSetId: string, folder: Folder | null): void;
}>();
const handleSwitchToFolder = () => {
    emit("switchToFolder");
};

const handleOpenQuestionSet = (questionSetId: string) => {
    emit("openQuestionSet", questionSetId, null);
};

//#endregion
</script>
<template>
    <a-modal
        centered
        width="100%"
        wrap-class-name="medium-modal large"
        :open="modal_open"
        @cancel="closeModal"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="1">
                        <RouterLink @click="closeModal" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="23">
                        <span>{{ $t("create_test_modals.select_question_set") }}</span>
                    </a-col>
                </a-row>
            </div>

            <div class="content">
                <div class="content-item">
                    <div class="title-container">
                        <div class="main-title">
                            <span>{{ $t("question_sets_index.title") }}</span> <br />
                            <span>
                                {{ $t("question_sets_index.sub_title") }}
                            </span>
                        </div>
                    </div>
                    <div class="content-item-functions">
                        <div v-if="!props.hideFolderTab" class="content-item-navigators">
                            <div class="navigator-container">
                                <RouterLink
                                    class="navigator-item"
                                    :to="{ name: '' }"
                                    @click="handleSwitchToFolder"
                                >
                                    {{ $t("folder_index.navigators.folder") }}
                                </RouterLink>
                                <RouterLink
                                    class="navigator-item navigator-active"
                                    :to="{ name: '' }"
                                >
                                    {{ $t("folder_index.navigators.question_set") }}
                                </RouterLink>
                            </div>
                        </div>
                        <div class="filter-container">
                            <a-select
                                class="me-3"
                                v-model:value="pageParams.filterBy"
                                style="width: 200px"
                                @change="getData"
                            >
                                <a-select-option
                                    v-for="option in share_mode_options"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </a-select-option>
                            </a-select>
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
                    </div>
                    <div v-if="loading" class="quiz-item-container">
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                    </div>
                    <div v-else class="quiz-item-container">
                        <template v-if="question_set_data.length > 0">
                            <div class="quiz-item" v-for="set in question_set_data" :key="set.id">
                                <i class="bx bx-book-open quiz-item-icon"></i>
                                <div>
                                    <div class="quiz-item-title">
                                        {{ set.name }}
                                    </div>
                                    <div class="quiz-item-info quiz-info-detail">
                                        <div class="quiz-item-questions">
                                            <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                            {{ $t("dashboards.list_items.quiz.questions", set.totalQuestionCount) }}
                                        </div>
                                        <div class="quiz-item-created-by">
                                            {{ $t("class_question_set.other.created_by") }}
                                            {{ set.createBy }}
                                        </div>
                                    </div>
                                </div>
                                <div class="exam-item-actions">
                                    <a-button
                                        type="primary"
                                        class="me-3 main-color-btn"
                                        @click="handleOpenQuestionSet(set.id)"
                                    >
                                        {{ props.actionLabel || $t("class_question_set.buttons.view") }}
                                    </a-button>
                                </div>
                            </div>
                        </template>
                        <template v-else>
                            <div class="w-100 d-flex justify-content-center">
                                <a-empty>
                                    <template #description>
                                        <span> No data matches. </span>
                                    </template>
                                </a-empty>
                            </div>
                        </template>
                    </div>

                    <div class="pagination-container">
                        <a-pagination
                            @change="onPaginationChange"
                            v-model:current="pageParams.pageNumber"
                            :total="pageParams.totalCount"
                            :pageSize="pageParams.pageSize"
                            :show-total="
                                (total: any, range: any) =>
                                    `${range[0]}-${range[1]} of ${total} ${t('folder_detail.other.items')}`
                            "
                            show-size-changer
                            class="crud-layout-pagination"
                            :locale="{
                                items_per_page: t('folder_index.other.pages'),
                            }"
                        ></a-pagination>
                    </div>
                </div>
            </div>
        </div>
        <template #footer></template>
    </a-modal>
</template>
<style scoped>
.modal-title-container .main-title span:nth-child(1) {
    font-size: 20px;
    font-weight: 700;
}
.content-item {
    width: auto;
    max-width: none;
    margin: 0;
    padding: 20px;
    background-color: var(--c-surface-subtle);
}
.content-item .title-container {
    margin: 0 0 12px;
}
.content-item .title-container .main-title span:nth-child(1) {
    font-size: 18px;
    font-weight: 700;
}
.content-item .title-container .main-title span:nth-child(3) {
    font-size: 14px;
    font-weight: 400;
}
.quiz-item {
    margin: 0 0 10px;
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}
.quiz-item:hover {
    border-color: var(--main-color);
    transform: none;
    box-shadow: none;
}
.quiz-item-title {
    font-size: 16px;
}

.quiz-item-icon {
    display: flex;
    width: 35px;
    height: 35px;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    aspect-ratio: 1/1;
    font-size: 16px;
    border-radius: 50%;
    background: var(--main-color-theme);
    color: var(--c-primary-text);
    margin-right: 12px;
}
@media (max-width: 767.98px) {
    .content-item {
        padding: 14px;
    }
}
</style>
