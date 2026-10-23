<script setup lang="ts">
import ApiFolder from "@/api/ApiFolder";
import FOLDER_SHARE_MODE from "@/constants/folderShareMode";
import type FolderPageParams from "@/models/request/folder/folderPageParams";
import type { Folder } from "@/models/response/folder/folder";

import { ref, onMounted, reactive, computed, onUpdated, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/AuthStore";
import { useRoute, useRouter } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";
import { message } from "ant-design-vue";

const route = useRoute();
const router = useRouter();

const authStore = useAuthStore();
const { t } = useI18n();

const emit = defineEmits(["updateSidebar"]);

const optionKeys = Object.values(FOLDER_SHARE_MODE);

const folder_share_mode_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`folder_index.select_option.${key}`),
        value: key !== FOLDER_SHARE_MODE.ALL ? key : "",
    })),
);

const folder_data = ref<Folder[]>([]);
const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    folderName: route.query.folderName?.toString() || "",
    shareMode: route.query.shareMode || folder_share_mode_options.value[0].value,
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});
const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;
        let result = await ApiFolder.GetAllByLimit(pageParams as FolderPageParams);
        if (result.data.success) {
            let resultData = result.data.data;
            folder_data.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;

            if (pageParams.statusFilter) {
                //check if filter is active
                if (pageParams.pageNumber > resultData.totalPages && pageParams.totalCount > 0) {
                    pageParams.pageNumber = 1;

                    router.push({
                        name: "User_Folder",
                        query: {
                            pageNumber: 1,
                            pageSize: pageParams.pageSize,
                            folderName: pageParams.folderName,
                            shareMode: pageParams.shareMode,
                        },
                    });
                } else {
                    router.push({
                        name: "User_Folder",
                        query: {
                            pageNumber: pageParams.pageNumber,
                            pageSize: pageParams.pageSize,
                            folderName: pageParams.folderName,
                            shareMode: pageParams.shareMode,
                        },
                    });
                }
                pageParams.statusFilter = !pageParams.statusFilter; //toggle filter status
            }
        }
    } catch (error) {
        console.log("ERROR: GETALLBYLIMIT folder: " + error);
    } finally {
        loading.value = false;
    }
};

//update when page change (url)
// onUpdated(() => {
//     if (Object.keys(route.query).length === 0) {
//         pageParams.pageNumber = route.query.pageNumber || 1;
//         pageParams.pageSize = route.query.pageSize || 10;
//         pageParams.folderName = route.query.folderName?.toString() || "";
//         pageParams.shareMode = route.query.shareMode || folder_share_mode_options.value[0].value;
//         pageParams.statusFilter = true;

//         getData();
//     }
// });

watch(
    () => Object.keys(route.query).length,
    () => {
        pageParams.pageNumber = route.query.pageNumber || 1;
        pageParams.pageSize = route.query.pageSize || 10;
        pageParams.folderName = route.query.folderName?.toString() || "";
        pageParams.shareMode = route.query.shareMode || folder_share_mode_options.value[0].value;
        pageParams.statusFilter = true;

        getData();
    },
);

//change when page change (pageParams)
const onPaginationChange = (page: number, pageSize: number) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    pageParams.statusFilter = true;
    getData();
};

//rules for both modal
const rules = {
    folderName: [
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

/* create modal */
const modal_create_open = ref(false);

const createFolderFormRef = ref();
const createFolderFormState = reactive({
    folderName: "",
});

const isCreateLoading = ref(false);
const onCreateFolder = async () => {
    isCreateLoading.value = true;
    try {
        await createFolderFormRef.value.validate(); //this will throw err to catch
        const folderName = createFolderFormState.folderName.trim();
        if (!folderName) return; // không gửi POST khi tên rỗng
        createFolderFormState.folderName = folderName;
        let result = await ApiFolder.Create({ folderName });
        if (!result.data.success) {
            message.error(t("message.created_failed"));
            return;
        }
        message.success(t("message.created_successfully"));
        modal_create_open.value = false;
        await getData();
    } catch (error) {
        console.log(error);
    } finally {
        isCreateLoading.value = false;
    }
};

const onRedirectToFolderDetail = (folderId: string) => {
    router.push({
        name: "User_Folder_Detail",
        params: {
            id: folderId,
        },
    });
};

onMounted(async () => {
    const sidebarActiveItem = "folder";
    emit("updateSidebar", sidebarActiveItem);
    await getData();
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <div class="main-title">
                <span>{{ $t("folder_index.title") }}</span> <br />
                <span>
                    {{ $t("folder_index.sub_title") }}
                </span>
            </div>
        </div>
        <div class="content">
            <div class="content-item">
                <!-- giống trang Thư viện: tiêu đề section + nút tạo nằm trong section -->
                <div class="content-item-title d-flex align-items-center">
                    <div>
                        <span>{{ $t("folder_index.sections.folder.title") }}</span>
                        <span>{{ $t("folder_index.sections.folder.sub_title") }}</span>
                    </div>
                    <a-button
                        type="primary"
                        class="main-color-btn content-item-button"
                        size="large"
                        @click="modal_create_open = true"
                    >
                        {{ $t("folder_index.buttons.create_folder") }}
                        <i class="bx bx-plus"></i>
                    </a-button>
                </div>
                <div class="content-item-functions">
                    <div class="filter-container">
                        <a-select
                            class="me-3"
                            v-model:value="pageParams.shareMode"
                            style="width: 200px"
                            @change="getData"
                        >
                            <a-select-option
                                v-for="option in folder_share_mode_options"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </a-select-option>
                        </a-select>
                        <div style="width: 300px; padding: 0px">
                            <Input
                                @input="getData"
                                v-model="pageParams.folderName"
                                :placeholder="t('question_sets_index.search_placeholder')"
                            >
                                <template #icon>
                                    <i class="bx bx-search"></i>
                                </template>
                            </Input>
                        </div>
                    </div>
                </div>
                <div v-if="loading" class="folder-container">
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                </div>
                <div v-else class="folder-container">
                    <template v-if="folder_data.length > 0">
                        <div
                            class="folder"
                            v-for="folder in folder_data"
                            @click="onRedirectToFolderDetail(folder.folderTestId)"
                        >
                            <div class="folder-icon">
                                <div class="folder-top"></div>
                                <div class="folder-body"></div>
                            </div>
                            <div class="folder-name">{{ folder.name }}</div>
                        </div>
                    </template>
                    <template v-else>
                        <div class="w-100 m-2 d-flex justify-content-center">
                            <a-empty>
                                <template #description>
                                    <span> {{ $t("folder_index.other.no_data_matches") }}</span>
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
    <a-modal
        centered
        wrap-class-name="medium-modal"
        :open="modal_create_open"
        @cancel="modal_create_open = false"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="4">
                        <RouterLink @click="modal_create_open = false" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="20">
                        <span>{{ t("folder_index.modal.create_title") }}</span>
                    </a-col>
                </a-row>
            </div>
            <a-form
                ref="createFolderFormRef"
                layout="vertical"
                :rules="rules"
                :model="createFolderFormState"
            >
                <Input
                    :label="t('folder_index.modal.create_folder_name_label')"
                    :name="'folderName'"
                    v-model:value="createFolderFormState.folderName"
                    :placeholder="t('folder_index.modal.create_folder_name_placeholder')"
                    :is-required="true"
                    :max-length="100"
                ></Input>
            </a-form>
        </div>
        <template #footer>
            <a-button
                :loading="isCreateLoading"
                class="main-color-btn"
                key="submit"
                type="primary"
                @click="onCreateFolder"
            >
                {{ t("folder_index.buttons.create") }}
            </a-button>
        </template>
    </a-modal>
</template>
<style scoped>
.title-container {
    width: auto;
}

.content-item {
    padding: 20px;
}

.content-item-title {
    align-items: center;
    margin-bottom: 16px;
    font-size: 20px;
}
.content-item-title span:nth-child(2) {
    font-size: 14px;
}

.content-item-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background-color: var(--main-color);
    border: none;
    padding: 0 16px;
    font-size: 14px;
    transition: all 0.2s ease-in-out;
    height: 40px;
    text-decoration: none;
}

.content-item-button:hover {
    background-color: var(--main-sub-color);
}

.content-item-button i {
    font-size: 18px;
    margin-left: 0;
    transform: none;
}

.filter-container {
    display: flex;
    justify-content: end;
    align-items: center;
}

.folder-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    grid-auto-rows: min-content;
    gap: 12px;
    align-content: start;
}

.folder-container > .ant-skeleton,
.folder-container > .w-100 {
    grid-column: 1 / -1;
}

.folder {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    min-width: 0;
    margin: 0;
    padding: 12px 14px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    transition: border-color 0.15s ease-in-out;
}
.folder:hover {
    background-color: var(--content-item-background-color);
    border-color: var(--main-color);
}

.folder-icon {
    flex: none;
    width: 44px;
    height: 32px;
    border-radius: var(--ui-r-xs);
}
.folder-top {
    height: 25%;
    border-radius: var(--ui-r-xs);
    background-color: color-mix(in srgb, var(--main-color) 70%, var(--c-surface));
}
.folder-body {
    height: 88%;
    border-radius: var(--ui-r-xs);
    background: var(--main-color);
}

.folder-name {
    flex: 1;
    width: auto;
    min-width: 0;
    max-width: none;
    margin-top: 0;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
}
</style>
