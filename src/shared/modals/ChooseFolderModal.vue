<script setup lang="ts">
import ApiFolder from "@/api/ApiFolder";
import FOLDER_SHARE_MODE from "@/constants/folderShareMode";
import type FolderPageParams from "@/models/request/folder/folderPageParams";
import type { Folder } from "@/models/response/folder/folder";

import { ref, reactive, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import Input from "@/shared/components/Common/Input.vue";

const route = useRoute();

const { t } = useI18n();

const optionKeys = Object.values(FOLDER_SHARE_MODE);

const folder_share_mode_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`folder_index.select_option.${key}`),
        value: key !== FOLDER_SHARE_MODE.ALL ? key : "",
    })),
);

//#region pagination
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
//         getData();
//     }
// });

watch(
    () => Object.keys(route.query).length,
    () => {
        if (Object.keys(route.query).length === 0) {
            pageParams.pageNumber = route.query.pageNumber || 1;
            pageParams.pageSize = route.query.pageSize || 10;
            pageParams.folderName = route.query.folderName?.toString() || "";
            pageParams.shareMode =
                route.query.shareMode || folder_share_mode_options.value[0].value;
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

const emit = defineEmits<{
    (e: "switchToQuestionSet"): void;
    (e: "openFolder", folder: Folder): void;
}>();

const handleSwitchToQuestionSet = () => {
    emit("switchToQuestionSet");
};

const handleOpenFolder = (folder: Folder) => {
    emit("openFolder", folder);
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
                        <span>{{ $t("create_test_modals.select_folder") }}</span>
                    </a-col>
                </a-row>
            </div>
            <div class="content">
                <div class="content-item">
                    <div class="title-container">
                        <div class="main-title">
                            <span>{{ $t("folder_index.title") }}</span> <br />
                            <span>
                                {{ $t("folder_index.sub_title") }}
                            </span>
                        </div>
                    </div>
                    <div class="content-item-functions">
                        <div class="content-item-navigators">
                            <div class="navigator-container">
                                <RouterLink
                                    class="navigator-item navigator-active"
                                    :to="{ name: '' }"
                                >
                                    {{ $t("folder_index.navigators.folder") }}
                                </RouterLink>
                                <RouterLink
                                    class="navigator-item"
                                    :to="{ name: '' }"
                                    @click="handleSwitchToQuestionSet"
                                >
                                    {{ $t("folder_index.navigators.question_set") }}
                                </RouterLink>
                            </div>
                        </div>
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
                                    :placeholder="t('class_index.other.search_class_placeholder')"
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
                                @click="handleOpenFolder(folder)"
                            >
                                <div class="folder-icon">
                                    <div class="folder-top"></div>
                                    <div class="folder-body"></div>
                                </div>
                                <div class="folder-name">{{ folder.name }}</div>
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
<style>
.medium-modal.large {
    .ant-modal {
        max-width: 70%;
    }
}
</style>
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
.folder {
    border: 1px solid transparent;
    border-radius: var(--ui-r-md);
}
.folder:hover {
    background-color: var(--c-surface);
    border-color: var(--main-color);
}

.title-container {
    width: auto;
}

.title-button-container {
    display: flex;
    margin-right: 36px;
}

.content-item-functions {
    margin: 10px 0px;
    display: flex;
    align-items: end;
    justify-content: end;
}

.filter-container {
    display: flex;
    justify-content: end;
    align-items: center;
}
@media (max-width: 767.98px) {
    .content-item {
        padding: 14px;
    }
}
</style>
