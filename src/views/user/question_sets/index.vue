<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";
import type QuestionSet from "@/models/response/question_set/questionSet";
import type QuestionSetPublicPageParams from "@/models/request/question_set/publicPageParams";
import type QuestionSetPageParams from "@/models/request/question_set/questionSetPageParams";
import QUESTION_SET_SHARE_MODE from "@/constants/questionSetShareMode";
import VISIBILITY from "@/constants/visibility";

import { onMounted, ref, computed, reactive, onUpdated, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useI18n } from "vue-i18n";
import Input from "@/shared/components/Common/Input.vue";

const router = useRouter();
const route = useRoute();

const { t } = useI18n();

const emit = defineEmits(["updateSidebar"]);

//#region init data
const optionKeys = Object.values(QUESTION_SET_SHARE_MODE);

const share_mode_options = computed(() =>
    optionKeys.map((key) => ({
        label: t(`question_sets_index.credit.${key}`),
        value: key !== QUESTION_SET_SHARE_MODE.ALL ? key : "",
    })),
);

const loading = ref(false);
const quiz_data = ref<QuestionSet[]>([]);

const queryToString = (value: unknown, fallback = "") =>
    Array.isArray(value) ? String(value[0] ?? fallback) : String(value ?? fallback);

const pageParams = reactive({
    pageNumber: Number(queryToString(route.query.pageNumber)) || 1,
    pageSize: Number(queryToString(route.query.pageSize)) || 10,
    name: queryToString(route.query.name),
    filterBy: queryToString(route.query.filterBy, share_mode_options.value[0].value),
    totalCount: 0,
});

// đồng bộ tìm kiếm/bộ lọc/phân trang lên URL bằng replace (không tạo thêm history entry) và chỉ khi URL thực sự đổi
const syncUrlQuery = () => {
    if (route.name !== "User_Library") return; // response về muộn khi người dùng đã rời trang
    const query: Record<string, string> = {
        pageNumber: String(pageParams.pageNumber),
        pageSize: String(pageParams.pageSize),
        name: pageParams.name,
        filterBy: pageParams.filterBy,
    };
    const isSame = Object.entries(query).every(
        ([key, value]) => queryToString(route.query[key]) === value,
    );
    if (isSame) return;
    router.replace({ name: "User_Library", query });
};

const getData = async () => {
    try {
        loading.value = true;
        let result = await ApiQuestionSet.GetAllByLimit(pageParams as QuestionSetPageParams);
        if (result.data.success) {
            let resultData = result.data.data;
            quiz_data.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;

            // trang hiện tại vượt quá tổng số trang (vd: sau khi lọc) -> về trang 1 và tải lại
            if (resultData.pageNumber > resultData.totalPages && resultData.totalCount > 0) {
                pageParams.pageNumber = 1;
                syncUrlQuery();
                await getData();
                return;
            }
            syncUrlQuery();
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT class exam: " + error);
    } finally {
        loading.value = false;
    }
};

// Back/Forward hoặc điều hướng từ nơi khác: khôi phục trạng thái từ URL (bỏ qua nếu URL do chính trang này vừa ghi)
watch(
    () =>
        [
            route.query.pageNumber,
            route.query.pageSize,
            route.query.name,
            route.query.filterBy,
        ].join("|"),
    () => {
        if (route.name !== "User_Library") return;
        const pageNumber = Number(queryToString(route.query.pageNumber)) || 1;
        const pageSize = Number(queryToString(route.query.pageSize)) || 10;
        const name = queryToString(route.query.name);
        const filterBy = queryToString(route.query.filterBy, share_mode_options.value[0].value);

        if (
            pageNumber === Number(pageParams.pageNumber) &&
            pageSize === Number(pageParams.pageSize) &&
            name === pageParams.name &&
            filterBy === pageParams.filterBy
        ) {
            return;
        }
        pageParams.pageNumber = pageNumber;
        pageParams.pageSize = pageSize;
        pageParams.name = name;
        pageParams.filterBy = filterBy;
        getData();
    },
);

// đổi từ khoá / bộ lọc -> về trang 1
const onSearchOrFilterChange = () => {
    pageParams.pageNumber = 1;
    getData();
};

//change when page change (pageParams)
const onPaginationChange = (page: any, pageSize: any) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    getData();
};
//#endregion

//#region calculate UI

const getPercentageComplete = (total: number, completed: number) => {
    return Math.floor((completed / total) * 100);
};

const getTagColor = (visibility: string) => {
    switch (visibility) {
        case VISIBILITY.PUBLIC:
            return "#22C55E";
        case VISIBILITY.PRIVATE:
            return "#C52225";
        default:
            return "#C52225";
    }
};

//#endregion

//#region redirect
const onRedirectToDetail = (questionSetId: string) => {
    router.push({ name: "User_QuestionSet_Detail", params: { id: questionSetId } });
};

const onRedirectToCreate = () => {
    router.push({ name: "User_QuestionSet_Create" });
};
//#endregion

onMounted(async () => {
    const sidebarActiveItem = "library";
    emit("updateSidebar", sidebarActiveItem);
    await getData();
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <a-row class="w-100">
                <a-col class="main-title" :span="20">
                    <span>{{ $t("question_sets_index.title") }}</span> <br />
                    <span>
                        {{ $t("question_sets_index.sub_title") }}
                    </span>
                </a-col>
            </a-row>
        </div>
        <div class="content">
            <div class="content-item">
                <div class="content-item-title d-flex align-items-center">
                    <div>
                        <span>{{ $t("question_sets_index.sections.quiz.title") }}</span>
                        <span>{{ $t("question_sets_index.sections.quiz.sub_title") }}</span>
                    </div>

                    <a-button
                        @click="onRedirectToCreate"
                        type="primary"
                        class="main-color-btn content-item-button"
                        size="large"
                    >
                        {{ $t("dashboards.buttons.createNewQuiz") }}
                        <i class="bx bx-plus"></i>
                    </a-button>
                </div>
                <div class="content-item-functions">
                    <a-select
                        v-model:value="pageParams.filterBy"
                        style="width: 200px"
                        @change="onSearchOrFilterChange"
                    >
                        <a-select-option v-for="option in share_mode_options" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                    <div style="width: 300px; padding: 0px">
                        <Input
                            v-model="pageParams.name"
                            :placeholder="t('question_sets_index.search_placeholder')"
                            @input="onSearchOrFilterChange"
                        >
                            <template #icon>
                                <i class="bx bx-search"></i>
                            </template>
                        </Input>
                    </div>
                </div>
                <div class="quiz-item-container">
                    <div v-if="loading">
                        <a-skeleton :loading="loading"></a-skeleton>
                        <a-skeleton :loading="loading"></a-skeleton>
                    </div>
                    <template v-else>
                        <template v-if="quiz_data.length > 0">
                            <div
                                class="quiz-item"
                                v-for="quiz in quiz_data"
                                @click="onRedirectToDetail(quiz.id)"
                            >
                                <i class="bx bx-book-open quiz-item-icon"></i>
                                <div>
                                    <div class="quiz-item-title">
                                        {{ quiz.name }}
                                    </div>
                                    <div class="quiz-item-info">
                                        <div>
                                            <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                            {{ $t("dashboards.list_items.quiz.questions", quiz.totalQuestionCount) }}
                                        </div>
                                        <div class="quiz-item-progress">
                                            <a-progress
                                                stroke-color="var(--main-color)"
                                                :percent="
                                                    getPercentageComplete(
                                                        quiz.totalQuestionCount,
                                                        quiz.completedQuestionCount,
                                                    )
                                                "
                                            />
                                        </div>
                                    </div>
                                    <div class="quiz-item-credit">
                                        <a-tag :color="getTagColor(quiz.visibilityMode)">
                                            {{
                                                $t(
                                                    `question_sets_index.visibility.${quiz.visibilityMode}`,
                                                )
                                            }}
                                        </a-tag>
                                        <span>
                                            |
                                            {{
                                                $t("question_sets_index.credit.createdBy", {
                                                    user: quiz.createBy,
                                                })
                                            }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <a-empty v-else>
                            <template #description>
                                <span>{{ $t("question_sets_index.empty_description") }}</span>
                            </template>
                        </a-empty>
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
.content-item {
    width: 100%;
    padding: 20px;
    overflow-y: hidden;
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

.quiz-container {
    padding: 10px;
    display: flex;
    flex-wrap: wrap;
    color: var(--text-color);
}

.quiz-item {
    background-color: var(--content-item-background-color);
    margin: 0 0 10px;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    cursor: pointer;
    transition: border-color 0.15s ease-in-out;
}

.quiz-item:hover {
    border: 1px solid var(--main-color);
    transform: none;
    box-shadow: none;
}

.quiz-item i {
    font-size: 18px;
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
    font-weight: 600;
}

.quiz-item-info {
    font-size: 13px;
    color: var(--c-text-muted);
    display: flex;
    align-items: center;
    justify-content: start;
    margin: 4px 0px;
}
.quiz-item-info i {
    margin-right: 4px;
    font-size: 14px;
}

.quiz-item-progress {
    font-size: 12px;
    margin-bottom: 0 !important;
    min-width: 250px;
    margin-left: 10px;
}
.quiz-item-credit {
    color: var(--c-text-muted);
    font-size: 12px;
    font-weight: 400;
    display: flex;
    align-items: center;
    gap: 8px;
}

.quiz-item-actions {
    flex: 1;
    display: flex;
    justify-content: end;
    align-items: center;
}
.quiz-item-actions button {
    background-color: var(--main-color);
}

.quiz-item-actions button:hover {
    background-color: var(--main-color);
}

::v-deep(.ant-progress) {
    margin: 0 !important;
}

::v-deep(.ant-progress-text) {
    color: var(--c-text-muted) !important;
    font-size: 12px;
}
::v-deep(.ant-progress-inner) {
    background-color: var(--content-item-border-color);
}
/* nhãn hiển thị: nền nhạt + chữ đậm theo trạng thái thay cho nền đặc */
::v-deep(.ant-tag) {
    margin: 0;
    padding: 1px 8px;
    font-size: 12px !important;
    font-weight: 500 !important;
    line-height: 18px;
    border-radius: var(--ui-r-xs);
}
::v-deep(.ant-tag-has-color[style*="rgb(34, 197, 94)"]) {
    color: var(--c-success-text) !important;
    background-color: color-mix(in srgb, var(--c-success) 14%, var(--c-surface)) !important;
    border-color: color-mix(in srgb, var(--c-success) 40%, var(--c-surface)) !important;
}
::v-deep(.ant-tag-has-color[style*="rgb(197, 34, 37)"]) {
    color: var(--c-danger-text) !important;
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface)) !important;
    border-color: color-mix(in srgb, var(--c-danger) 40%, var(--c-surface)) !important;
}

.ant-dropdown-link {
    padding: 6px;
    border-radius: var(--ui-r-md);
    border: 1px solid var(--content-item-border-color);
}

.drop-down-container {
    background: var(--content-item-background-color) !important;
    border: 1px solid var(--main-color);
}
</style>
