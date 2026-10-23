<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";
import ApiTag from "@/api/ApiTag";
import type QuestionSetPublicPageParams from "@/models/request/question_set/publicPageParams";
import QUESTION_SET_SORT_CATEGORY from "@/constants/questionSetSortCate";
import type QuestionSet from "@/models/response/question_set/questionSet";
import type Tag from "@/models/response/tag/tag";

import { ref, reactive, onMounted, onUpdated, nextTick, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import TextArea from "@/shared/components/Common/TextArea.vue";
import Input from "@/shared/components/Common/Input.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

//#region init data
const optionKeys = Object.values(QUESTION_SET_SORT_CATEGORY);

const sort_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`question_sets_search.sort_category.${key}`),
        value: key,
    })),
);

const loading = ref(false);

const quiz_data = ref<QuestionSet[]>([]);

const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 10,
    name: route.query.name?.toString() || "",
    sortBy: route.query.sortBy || sort_options.value[0].value,
    tagIds: route.query.tags ? route.query.tags.toString().split(",") : [],
    totalCount: 0,
    statusFilter: false, //serve as a flag to check if pageParams is in url
});

const getData = async () => {
    try {
        loading.value = true;
        let result = await ApiQuestionSet.GetPublicByLimit(
            pageParams as QuestionSetPublicPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            quiz_data.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;

            if (pageParams.statusFilter) {
                //check if filter is active
                if (pageParams.pageNumber > resultData.totalPages && pageParams.totalCount > 0) {
                    pageParams.pageNumber = 1;

                    router.push({
                        name: "User_QuestionSet_Search",
                        query: {
                            pageNumber: 1,
                            pageSize: pageParams.pageSize,
                            name: pageParams.name,
                            sortBy: pageParams.sortBy,
                            tagIds: pageParams.tagIds.join(","),
                        },
                    });
                } else {
                    router.push({
                        name: "User_QuestionSet_Search",
                        query: {
                            pageNumber: pageParams.pageNumber,
                            pageSize: pageParams.pageSize,
                            name: pageParams.name,
                            sortBy: pageParams.sortBy,
                            tagIds: pageParams.tagIds.join(","),
                        },
                    });
                }
                pageParams.statusFilter = !pageParams.statusFilter; //toggle filter status
            }
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT search qs: " + error);
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
//         pageParams.sortBy = route.query.sortBy || sort_options.value[0].value;
//         pageParams.tagIds = route.query.tags
//             ? route.query.tags.toString().split(",")
//             : selectedTags.value.map((x) => x.id);
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
        pageParams.sortBy = route.query.sortBy || sort_options.value[0].value;
        pageParams.tagIds = route.query.tags
            ? route.query.tags.toString().split(",")
            : selectedTags.value.map((x) => x.id);
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

//#endregion

//#region tag
const selectedTags = ref<Tag[]>([]);
const tag_search_data = ref<Tag[]>([]);

const getSessionSelectedTag = () => {
    const session_data = sessionStorage.getItem("selected_tags");
    if (session_data) selectedTags.value.push(...(JSON.parse(session_data) as Tag[]));
    pageParams.tagIds = selectedTags.value.map((x) => x.id);
};

const searchTagPageParams = reactive({
    name: "",
    pageSize: 10,
});

const getSearchTagData = async () => {
    if (searchTagPageParams.name.trim().length >= 50) {
        return;
    }
    const result = await ApiTag.GetAllByLimit(searchTagPageParams);
    if (result.data.success) {
        tag_search_data.value = result.data.data;
        lastSearchResult.value = result.data.data;
        if (searchTagPageParams.name.trim().length === 0) {
            tag_search_data.value = [];
        }
    }
};

const addTag = (tag: Tag) => {
    if (!selectedTags.value.map((x) => x.id).includes(tag.id)) selectedTags.value.push(tag);
    sessionStorage.setItem("selected_tags", JSON.stringify(selectedTags.value)); //preserve tags when refresh
};

const removeTag = (index: number) => {
    selectedTags.value.splice(index, 1);
    sessionStorage.setItem("selected_tags", JSON.stringify(selectedTags.value));
};

watch(
    () => selectedTags.value.length,
    () => {
        pageParams.tagIds = selectedTags.value.map((x) => x.id);
        getData();
    },
);

/* use this for tracking whether mouse is in search components */
const searchResultRef = ref<HTMLElement | null>(null);

/* use this for temporary when mouse leave */
const lastSearchResult = ref<Tag[]>([]);
function handleMouseClickOutside(event: MouseEvent) {
    if (!searchTagPageParams.name || !searchResultRef.value?.contains(event.target as Node)) {
        tag_search_data.value = [];
    } else {
        tag_search_data.value = [...lastSearchResult.value];
    }
}

//#endregion

const onRedirectToDetail = (questionSetId: string) => {
    router.push({ name: "User_QuestionSet_Detail", params: { id: questionSetId } });
};

// các trang con của thư viện: highlight mục "Quizzes" ở sidebar
const emit = defineEmits(["updateSidebar"]);

onMounted(async () => {
    emit("updateSidebar", "library");
    document.addEventListener("click", handleMouseClickOutside);
    getSessionSelectedTag();
    await getData();
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <a-row class="w-100 d-flex align-items-center">
                <a-col :span="1">
                    <RouterLink :to="{ name: 'User_Library' }">
                        <i class="bx bx-chevron-left navigator-back-button"></i>
                    </RouterLink>
                </a-col>
                <a-col class="main-title" :span="23">
                    <span> {{ $t("detail_QS.other.library") }}</span> <br />
                </a-col>
            </a-row>
        </div>
        <div class="content">
            <div class="content-item">
                <div class="content-item-title">
                    <div>
                        <span>{{ $t("search_QS.title") }}</span>
                        <span>
                            {{ $t("search_QS.sub_title") }}
                        </span>
                    </div>
                </div>

                <div class="d-flex justify-content-between">
                    <div class="form-item">
                        <label>{{ $t("search_QS.form.key_word") }}</label>
                        <Input
                            @input="getData"
                            v-model="pageParams.name"
                            :placeholder="t('search_QS.form.key_word_placeholder')"
                        >
                            <template #icon>
                                <i class="bx bx-search"></i>
                            </template>
                        </Input>
                    </div>
                    <div class="form-item form-item-sort">
                        <label>{{ $t("search_QS.form.sort_by") }}</label>
                        <a-select
                            v-model:value="pageParams.sortBy"
                            style="width: 200px"
                            @change="getData"
                        >
                            <a-select-option v-for="option in sort_options" :value="option.value">
                                {{ option.label }}
                            </a-select-option>
                        </a-select>
                    </div>
                </div>

                <div class="d-flex justify-content-between">
                    <!-- <div class="form-item form-item-sort">
                        <label>Sort by</label>
                        <a-select
                            v-model:value="pageParams.sortBy"
                            style="width: 200px"
                            @change="getData"
                        >
                            <a-select-option v-for="option in sort_options" :value="option.value">
                                {{ option.label }}
                            </a-select-option>
                        </a-select>
                    </div> -->
                    <div class="form-item form-item-tag">
                        <label>{{ $t("create_QS.quiz.tag") }}</label>
                        <div class="tag-container">
                            <div
                                class="result-tag"
                                v-for="(tag, index) in selectedTags"
                                :key="index"
                            >
                                {{ tag.name }}
                                <span class="tag-item-qs-count">
                                    {{ tag.questionSetCount }}
                                </span>
                                <i class="bx bx-x" @click="removeTag(index)"></i>
                            </div>
                        </div>
                        <div class="search-bar" ref="searchResultRef">
                            <Input
                                @input="getSearchTagData"
                                v-model="searchTagPageParams.name"
                                :placeholder="t('search_QS.form.tag_placeholder')"
                            >
                            </Input>
                            <div
                                v-if="tag_search_data.length > 0"
                                :class="['search-result-container']"
                            >
                                <div class="search-result">
                                    <div class="search-result-tag" v-for="tag in tag_search_data">
                                        <div class="result-tag">
                                            {{ tag.name }}
                                            <div class="result-tag-qs-count">
                                                {{ tag.questionSetCount }}
                                            </div>
                                        </div>
                                        <div class="result-item-action">
                                            <a-button
                                                type="primary"
                                                class="main-color-btn"
                                                size="small"
                                                @click="addTag(tag)"
                                            >
                                                <i class="bx bx-plus"></i>
                                            </a-button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content-item-title">
                    <div>
                        <span>
                            {{ $t("search_QS.other.result_title", { number: pageParams.totalCount }) }}
                        </span>
                    </div>
                </div>
                <template v-if="loading">
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                    <a-skeleton :loading="loading"></a-skeleton>
                </template>
                <template v-else>
                    <div v-if="quiz_data.length > 0" class="quiz-item-container">
                        <div class="quiz-item" v-for="item in quiz_data">
                            <i class="bx bx-book-open quiz-item-icon"></i>
                            <div>
                                <div class="quiz-item-title">
                                    {{ item.name }}
                                </div>
                                <div class="quiz-item-description">
                                    {{
                                        $t("search_QS.other.rating", {
                                            average: item.ratingAverage,
                                            count: item.ratingCount,
                                        })
                                    }}
                                </div>
                                <div class="quiz-item-info quiz-info-detail">
                                    <div class="quiz-item-questions">
                                        <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                        {{ $t("dashboards.list_items.quiz.questions", item.totalQuestionCount) }}
                                    </div>
                                    <div class="quiz-item-created-by">
                                        {{ $t("class_question_set.other.created_by") }}
                                        {{ item.createBy }}
                                    </div>
                                </div>
                            </div>
                            <div class="exam-item-actions">
                                <a-button
                                    type="primary"
                                    class="me-3 main-color-btn"
                                    @click="onRedirectToDetail(item.id)"
                                >
                                    {{ $t("class_question_set.buttons.view") }}
                                </a-button>
                            </div>
                        </div>
                    </div>
                    <template v-else>
                        <div
                            class="w-100 d-flex align-items-center justify-content-center quiz-item-container"
                        >
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
                        class="crud-layout-pagination"
                        :locale="{
                            items_per_page: t('class_index.other.pages'),
                        }"
                    ></a-pagination>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
.page-container {
    height: 100vh;
}

.navigator-back-link {
    margin-left: 30px;
    color: var(--text-color);
    text-decoration: none;
    font-size: 16px;
}

.navigator-back-link i {
    font-size: 24px;
    transform: translateY(1px);
    transition: all 0.2s ease-in-out;
}

.navigator-back-link:hover i {
    transform: translate(-3px, 1px);
}

.content-item {
    width: 70%;
    margin: 10px auto;
    padding: 24px;
    overflow: visible;
}

.content-item-title {
    margin: 8px 0 16px;
    font-size: 20px;
}
.content-item-title span:nth-child(2) {
    font-size: 14px;
}

.form-item {
    padding: 6px 0;
}
@media (min-width: 768px) {
    .form-item + .form-item {
        margin-left: 16px;
    }
}
.form-item label {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
}

.tag-container {
    gap: 6px;
    align-content: flex-start;
    padding: 8px;
    border-color: var(--form-item-border-color);
    border-radius: var(--ui-r-sm);
}

.tag-item {
    border-color: var(--main-color);
}
.tag-item-qs-count {
    background-color: var(--main-color);
    color: var(--text-color-contrast);
    padding: 0px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
}
.form-item-sort {
    flex: 0.5;
}
.form-item-tag {
    flex: 1;
}

.search-result-container {
    position: relative;
    color: var(--text-color);
}

.search-result::-webkit-scrollbar {
    width: 10px;
}
.search-result::-webkit-scrollbar-thumb {
    background-color: var(--form-item-border-color);
    border-radius: 999px;
}

.search-result {
    background-color: var(--form-item-background-color);
    border: 1px solid var(--content-item-border-color);
    position: absolute;
    top: 4px;
    z-index: 10;
    width: 100%;
    margin: 0px;
    border-radius: var(--ui-r-lg);
    overflow-y: scroll;
    box-shadow: var(--ui-shadow-pop);
    height: 300px;
    padding: 10px;
}

.search-result-tag {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 4px;
    padding: 6px 10px;
    border-radius: var(--ui-r-sm);
    cursor: pointer;
}
.search-result-tag:hover {
    background-color: var(--c-surface-subtle);
}

.result-tag {
    margin: 0;
    padding: 2px 4px 2px 12px;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--c-primary-text);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-radius: 999px;
    border: 1px solid var(--main-color);
    display: flex;
    justify-content: space-between;
    height: fit-content;
}

.result-tag-qs-count {
    margin-left: 0;
    padding: 0px 8px;
    border-radius: 999px;
    font-size: 12px;
    background-color: var(--main-color);
    color: var(--text-color-contrast);
}

.result-tag i {
    background-color: transparent !important;
    color: var(--c-text-muted) !important;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    padding: 0;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
}
.result-tag i:hover {
    background-color: var(--c-solid-danger) !important;
    color: var(--c-on-primary) !important;
}
.quiz-item {
    cursor: default;
    margin: 0 0 10px;
    padding: 12px 14px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
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
    background: color-mix(in srgb, var(--main-color) 18%, transparent);
    color: var(--c-primary-text);
    margin-right: 12px;
}
.quiz-item-title {
    font-size: 15px;
}
.quiz-item-description,
.quiz-item-created-by {
    font-size: 13px;
    font-weight: 400;
    color: var(--c-text-muted);
}
.exam-item-actions .me-3 {
    margin-right: 0 !important;
}
.quiz-info-detail {
    margin-top: 4px;
    padding-top: 0;
    font-size: 13px;
}
.quiz-info-detail i {
    margin-right: 4px;
}
</style>
