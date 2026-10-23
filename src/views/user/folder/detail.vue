<script setup lang="ts">
import ApiFolder from "@/api/ApiFolder";

import { ref, onMounted, reactive, computed, onUpdated, h, watch } from "vue";
import { useI18n } from "vue-i18n";
import Validator from "@/services/Validator";

import type { Folder } from "@/models/response/folder/folder";
import type { FolderQuestionSet } from "@/models/response/folder/folder";
import type FolderQuestionSetPageParams from "@/models/request/folder/folderQuestionSetPageParams";

import { useRoute, useRouter } from "vue-router";
import Input from "@/shared/components/Common/Input.vue";
import { Modal, message } from "ant-design-vue";

const route = useRoute();
const router = useRouter();

const { t } = useI18n();
const emit = defineEmits(["updateSidebar"]);

const folderId = ref(route.params.id.toString() || "");
const folderData = ref<Folder>({
    folderTestId: "",
    name: "",
    createBy: "",
});

const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    questionSetName: route.query.questionSetName?.toString() || "",
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});

const question_set_data = ref<FolderQuestionSet[]>([]);
const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;
        if (!Validator.isValidGuid(folderId.value.toString())) {
            router.push({ name: "404" });
            return;
        }
        if (!folderId.value) router.push({ name: "404" });

        let result = await ApiFolder.GetAllQuestionSetByLimit(
            folderId.value.toString(),
            pageParams as FolderQuestionSetPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            question_set_data.value = resultData.questionSets.items;
            folderData.value.name = resultData.folderName;

            pageParams.pageNumber = resultData.questionSets.pageNumber;
            pageParams.pageSize = resultData.questionSets.pageSize;
            pageParams.totalCount = resultData.questionSets.totalCount;
            if (pageParams.statusFilter) {
                //check if filter is active
                if (pageParams.pageNumber > resultData.totalPages && pageParams.totalCount > 0) {
                    pageParams.pageNumber = 1;
                    router.push({
                        name: "User_Folder_Detail",
                        params: {
                            id: folderId.value,
                        },
                        query: {
                            pageNumber: 1,
                            pageSize: pageParams.pageSize,
                            questionSetName: pageParams.questionSetName,
                        },
                    });
                } else {
                    router.push({
                        name: "User_Folder_Detail",
                        params: {
                            id: folderId.value,
                        },
                        query: {
                            pageNumber: pageParams.pageNumber,
                            pageSize: pageParams.pageSize,
                            questionSetName: pageParams.questionSetName,
                        },
                    });
                }
                pageParams.statusFilter = !pageParams.statusFilter; //toggle filter status
            }
        }
    } catch (error) {
        console.log("ERROR: GETALLBYLIMIT folder question set: " + error);
    } finally {
        loading.value = false;
    }
};

//update when page change (url)
// onUpdated(() => {
//     if (Object.keys(route.query).length === 0) {
//         pageParams.pageNumber = route.query.pageNumber || 1;
//         pageParams.pageSize = route.query.pageSize || 10;
//         pageParams.questionSetName = route.query.questionSetName?.toString() || "";
//         pageParams.statusFilter = true;

//         getData();
//     }
// });

watch(
    () => Object.keys(route.query).length,
    () => {
        pageParams.pageNumber = route.query.pageNumber || 1;
        pageParams.pageSize = route.query.pageSize || 10;
        pageParams.questionSetName = route.query.questionSetName?.toString() || "";
        pageParams.statusFilter = true;

        getData();
    },
);

// //change when page change (pageParams)
const onPaginationChange = (page: number, pageSize: number) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    pageParams.statusFilter = true;
    getData();
};

const onRemoveQuestionSet = (questionSetId: string) => {
    Modal.confirm({
        title: t("folder_detail.modal.remove_question_set_warning"),
        content: t("folder_detail.modal.remove_question_set_ins"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            const result = await ApiFolder.DeleteQuestionSet(
                folderId.value.toString(),
                questionSetId,
            );
            if (!result.data.success) {
                message.error(t("message.removed_failed"));
                return;
            }
            message.success(t("message.removed_successfully"));
            await getData();
        },
    });
};

/* delete folder */
const onOpenConfirmDelete = () => {
    Modal.confirm({
        title: t("folder_detail.modal.delete_folder_warning"),
        content: h("div", { style: "color: red" }, t("folder_detail.danger_zone.warning_explain")),
        centered: true,
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        onOk: async () => {
            let result = await ApiFolder.DeleteFolder(folderId.value.toString());
            if (!result.data.success) {
                message.error(t("message.deleted_failed"));
                return;
            }
            message.success(t("message.deleted_successfully"));
            router.push({ name: "User_Folder" });
        },
    });
};

//#region update folder modal

const rules = {
    name: [
        {
            required: true,
            whitespace: true, // chỉ toàn khoảng trắng cũng coi là rỗng
            message: t("message.required"),
            trigger: "change",
        },
        {
            max: 100,
            message: t("message.out_of_range", { max_length: 100 }),
            trigger: "change",
        },
    ],
};

const modal_update_open = ref(false);

const updateFolderFormRef = ref();
const updateFolderFormState = reactive({
    name: folderData.value.name,
});

const openUpdateModal = () => {
    modal_update_open.value = true;
    updateFolderFormState.name = folderData.value.name;
    updateFolderFormRef.value?.validate();
};

const isUpdateLoading = ref(false);
const onUpdateFolder = async () => {
    isUpdateLoading.value = true;
    try {
        await updateFolderFormRef.value?.validate(); //this will throw err to catch
        const name = updateFolderFormState.name.trim();
        if (!name) return; // không gửi PATCH khi tên rỗng
        let result = await ApiFolder.Update(folderId.value.toString(), {
            folderId: folderId.value,
            name,
        });
        if (!result.data.success) {
            message.error(t("message.updated_failed"));
            return;
        }
        message.success(t("message.updated_successfully"));
        modal_update_open.value = false;
        await getData();
    } catch (error) {
        console.log(error);
    } finally {
        isUpdateLoading.value = false;
    }
};
//#endregion

//#region share modal
import ShareModal from "@/shared/modals/ShareModal.vue";
import VISIBILITY from "@/constants/visibility";
const shareModalRef = ref<InstanceType<typeof ShareModal> | null>(null);

const onOpenShareModal = () => {
    shareModalRef.value?.openModal();
};

//#endregion

//#region thêm bộ câu hỏi (của mình / được chia sẻ quyền sửa) vào thư mục
import ChooseQuestionSetModal from "@/shared/modals/ChooseQuestionSetModal.vue";
const questionSetModalRef = ref<InstanceType<typeof ChooseQuestionSetModal> | null>(null);

const onOpenAddQuestionSet = () => {
    questionSetModalRef.value?.openModal();
};

const onAddQuestionSet = async (questionSetId: string) => {
    try {
        const result = await ApiFolder.AddQuestionSet(folderId.value.toString(), questionSetId);
        if (result?.data?.success) {
            message.success(t("folder_detail.message.question_set_added"));
            questionSetModalRef.value?.closeModal();
            await getData();
        }
    } catch (error) {
        // lỗi (đã có trong thư mục / không có quyền sửa bộ) đã hiện toast ở interceptor
        console.log("ERROR: add question set to folder", error);
    }
};
//#endregion

const onRedirectToDetail = (questionSetId: string) => {
    router.push({
        name: "User_QuestionSet_Detail",
        params: { id: questionSetId },
    });
};

onMounted(async () => {
    const sidebarActiveItem = "folder";
    emit("updateSidebar", sidebarActiveItem);

    // await getFolderData();
    await getData();
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <div class="main-title">
                <span>{{ $t("folder_detail.title") }}</span> <br />
            </div>
            <div class="title-button-container">
                <a-button
                    type="primary"
                    class="ms-3 main-color-btn"
                    size="large"
                    @click="onOpenShareModal"
                >
                    <i class="me-2 bx bx-share-alt"></i>
                    {{ $t("folder_detail.buttons.share_folder") }}
                </a-button>
                <a-button
                    type="primary"
                    class="ms-3 main-color-btn"
                    size="large"
                    @click="onOpenAddQuestionSet"
                >
                    <i class="me-2 bx bx-plus"></i>
                    {{ $t("folder_detail.buttons.add_question_set") }}
                </a-button>
            </div>
        </div>
        <div class="content">
            <div class="content-item">
                <div class="content-item-title">
                    <span>
                        {{ folderData.name }}
                        <i class="bx bx-edit" @click="openUpdateModal"></i>
                    </span>
                </div>
                <div class="content-item-functions">
                    <div class="filter-container">
                        <div style="width: 300px; padding: 0px">
                            <Input
                                @input="getData"
                                v-model="pageParams.questionSetName"
                                :placeholder="t('folder_detail.search_placeholder')"
                            >
                                <template #icon>
                                    <i class="bx bx-search"></i>
                                </template>
                            </Input>
                        </div>
                    </div>
                </div>
                <template v-if="loading">
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                </template>
                <template v-else>
                    <div v-if="question_set_data.length > 0" class="quiz-item-container">
                        <div class="quiz-item" v-for="set in question_set_data" :key="set.questionSetId">
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
                                    @click="onRedirectToDetail(set.questionSetId)"
                                >
                                    {{ $t("class_question_set.buttons.view") }}
                                </a-button>
                                <i
                                    class="text-danger bx bx-trash-alt"
                                    @click="onRemoveQuestionSet(set.questionSetId)"
                                ></i>
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
            <div class="mt-4 content-item">
                <div class="content-item-title">
                    <div>
                        <span class="text-danger">{{ $t("folder_detail.danger_zone.title") }}</span>
                        <span>{{ $t("folder_detail.danger_zone.sub_title") }}</span>
                    </div>
                </div>
                <div class="danger-zone mt-3 p-4">
                    <div class="text-danger fs-6 fw-bold">
                        {{ $t("folder_detail.danger_zone.warning") }}
                    </div>
                    <div class="text-secondary">
                        {{ $t("folder_detail.danger_zone.warning_explain") }}
                    </div>
                    <a-button
                        class="mt-3"
                        type="primary"
                        danger
                        size="large"
                        @click="onOpenConfirmDelete"
                    >
                        {{ $t("folder_detail.danger_zone.warning") }}
                    </a-button>
                </div>
            </div>
        </div>
    </div>

    <a-modal
        centered
        wrap-class-name="medium-modal"
        :open="modal_update_open"
        @cancel="modal_update_open = false"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="4">
                        <RouterLink @click="modal_update_open = false" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="20">
                        <span>{{ t("folder_detail.modal.create_title") }}</span>
                    </a-col>
                </a-row>
            </div>
            <a-form
                ref="updateFolderFormRef"
                layout="vertical"
                :rules="rules"
                :model="updateFolderFormState"
            >
                <Input
                    :label="'Folder name'"
                    :name="'name'"
                    v-model="updateFolderFormState.name"
                    :placeholder="t('folder_index.modal.create_folder_name_placeholder')"
                    :is-required="true"
                    :max-length="100"
                ></Input>
            </a-form>
        </div>
        <template #footer>
            <a-button
                :loading="isUpdateLoading"
                class="main-color-btn"
                key="submit"
                type="primary"
                @click="onUpdateFolder"
            >
                {{ $t("update_QS.buttons.update") }}
            </a-button>
        </template>
    </a-modal>

    <ChooseQuestionSetModal
        ref="questionSetModalRef"
        hide-folder-tab
        :action-label="$t('folder_detail.buttons.add')"
        @open-question-set="onAddQuestionSet"
    />
    <ShareModal
        ref="shareModalRef"
        :id="folderId"
        :name="folderData.name"
        :mode="'folder'"
        :options="[VISIBILITY.PRIVATE]"
        :visibility="VISIBILITY.PRIVATE"
    />
</template>
<style scoped>
.content-item {
    padding: 20px;
}

.quiz-item {
    margin: 0 0 10px;
    padding: 12px 14px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    cursor: default;
    transition: border-color 0.15s ease-in-out;
}
.quiz-item:hover {
    border: 1px solid var(--main-color);
    transform: none;
    box-shadow: none;
}
.quiz-item-icon {
    display: flex;
    width: 36px;
    height: 36px;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    aspect-ratio: 1/1;
    font-size: 18px;
    border-radius: 50%;
    background: var(--main-color-theme);
    color: var(--c-primary-text);
    margin-right: 12px;
}
.quiz-item-title {
    font-size: 15px;
}
.quiz-item-created-by {
    font-size: 13px;
    color: var(--c-text-muted);
}
.quiz-info-detail {
    margin-top: 4px;
    padding-top: 0;
    font-size: 13px;
    color: var(--c-text-muted);
}
.quiz-info-detail i {
    margin-right: 4px;
}

.exam-item-actions {
    gap: 8px;
}
.exam-item-actions .me-3 {
    margin-right: 0 !important;
}
.exam-item-actions .bx-trash-alt {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 18px;
    border-radius: var(--ui-r-md);
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
}
.exam-item-actions .bx-trash-alt:hover {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
}

.text-danger {
    color: var(--c-danger-text) !important;
}
.text-secondary {
    color: var(--c-text-muted) !important;
}
.danger-zone {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
    border: 1px solid color-mix(in srgb, var(--c-danger) 30%, var(--c-surface));
    border-radius: var(--ui-r-md);
}
.title-container {
    width: auto;
}
.title-button-container {
    display: flex;
    margin-right: 36px;
}

.content-item-title {
    align-items: center;
    margin-bottom: 16px;
    font-size: 20px;
}
.content-item-title span:nth-child(2) {
    font-size: 14px;
}
.content-item-title i {
    cursor: pointer;
    color: var(--c-text-muted);
    font-size: 20px;
    transition: all 0.2s ease-in-out;
}
.content-item-title i:hover {
    color: var(--c-primary-text);
}
</style>
