<script setup lang="ts">
import ApiFolder from "@/api/ApiFolder";
import type FolderQuestionSetPageParams from "@/models/request/folder/folderQuestionSetPageParams";
import type { FolderQuestionSet } from "@/models/response/folder/folder";
import type { Folder } from "@/models/response/folder/folder";

import { ref, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";

const route = useRoute();

const { t } = useI18n();

interface Props {
    folder: Folder | null;
}

const props = defineProps<Props>();

//#region pagination
const question_set_data = ref<FolderQuestionSet[]>([]);
const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    questionSetName: "",
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});
const loading = ref(false);
const getData = async () => {
    try {
        if (!props.folder?.folderTestId) return;
        loading.value = true;

        let result = await ApiFolder.GetAllQuestionSetByLimit(
            props.folder.folderTestId,
            pageParams as FolderQuestionSetPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            question_set_data.value = resultData.questionSets.items;

            pageParams.pageNumber = resultData.questionSets.pageNumber;
            pageParams.pageSize = resultData.questionSets.pageSize;
            pageParams.totalCount = resultData.questionSets.totalCount;
        }
    } catch (error) {
        console.log("ERROR: GETALLBYLIMIT folder question set: " + error);
    } finally {
        loading.value = false;
    }
};

watch(
    () => Object.keys(route.query).length,
    () => {
        if (Object.keys(route.query).length === 0) {
            pageParams.pageNumber = route.query.pageNumber || 1;
            pageParams.pageSize = route.query.pageSize || 10;
            pageParams.questionSetName = "";
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
const emit = defineEmits<{
    (e: "openQuestionSet", questionSetId: string, folder: Folder | null): void;
    (e: "backToFolderModal"): void;
}>();

const modal_open = ref(false);

const openModal = async () => {
    modal_open.value = true;
    await getData();
};

const closeModal = () => {
    modal_open.value = false;
    emit("backToFolderModal");
};

const handleOpenQuestionSet = (questionSetId: string) => {
    closeModal();
    emit("openQuestionSet", questionSetId, props.folder);
};

//expose functions to main ref
defineExpose({
    openModal,
    closeModal,
});
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
                            <span>
                                {{ $t("create_test_modals.folder", { name: folder?.name }) }}
                            </span>
                            <br />
                            <span>
                                {{ $t("folder_index.sub_title") }}
                            </span>
                        </div>
                    </div>
                    <div class="content-item-functions">
                        <div class="filter-container">
                            <div style="width: 300px; padding: 0px">
                                <Input
                                    @input="getData"
                                    v-model="pageParams.questionSetName"
                                    :placeholder="t('class_index.other.search_class_placeholder')"
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
                            <div
                                class="quiz-item"
                                v-for="set in question_set_data"
                                :key="set.questionSetId"
                                @click="handleOpenQuestionSet(set.questionSetId)"
                            >
                                <i class="bx bx-book-open quiz-item-icon"></i>
                                <div>
                                    <div class="quiz-item-title">
                                        {{ set.name }}
                                    </div>
                                    <div class="quiz-item-info quiz-info-detail">
                                        <div class="quiz-item-questions">
                                            <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                            {{ $t("dashboards.list_items.quiz.questions", set.numberOfQuestion) }}
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
                                        @click.stop="handleOpenQuestionSet(set.questionSetId)"
                                    >
                                        {{ $t("class_question_set.buttons.view") }}
                                    </a-button>
                                </div>
                            </div>
                        </template>
                        <template v-else>
                            <div class="w-100 d-flex justify-content-center">
                                <a-empty>
                                    <template #description>
                                        <span> {{ $t("class_index.other.no_data_matches") }}</span>
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
                                    `${range[0]}-${range[1]} of ${total} ${t('folder_index.other.items')}`
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
