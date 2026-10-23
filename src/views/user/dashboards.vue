<script setup lang="ts">
import ApiQuestionSet from "@/api/ApiQuestionSet";
import type QuestionSetPublicPageParams from "@/models/request/question_set/publicPageParams";
import QUESTION_SET_SORT_CATEGORY from "@/constants/questionSetSortCate";
import type QuestionSet from "@/models/response/question_set/questionSet";
import { getPlaceholderCount, rememberPlaceholderCount } from "@/services/PlaceholderCountService";

import { ref, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/AuthStore";

import Input from "@/shared/components/Common/Input.vue";
import { useI18n } from "vue-i18n";

const emit = defineEmits(["updateSidebar"]);

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const user = authStore.getUserInfo();

//#region calculate UI
const getPercentageComplete = (total: number, completed: number) => {
    return Math.floor((completed / total) * 100);
};

//#endregion

//#region search bar
type SearchResult = {
    id: string;
    name: string;
    totalQuestionCount: number;
    ratingAverage: number;
    createBy: string;
};
const search_data = ref<SearchResult[]>([]);
const searchPageParams = reactive<QuestionSetPublicPageParams>({
    pageNumber: 1,
    pageSize: 10,
    name: "",
    tagIds: [],
    sortBy: QUESTION_SET_SORT_CATEGORY.RATING,
});

const getSearchData = async () => {
    const result = await ApiQuestionSet.GetPublicByLimit(searchPageParams);
    if (result.data.success) {
        search_data.value = result.data.data.items;
        lastSearchResult.value = result.data.data.items;
    }
};

/* use this for tracking whether mouse is in search components */
const searchResultRef = ref<HTMLElement | null>(null);

/* use this for temporary when mouse leave */
const lastSearchResult = ref<SearchResult[]>([]);

function handleMouseClickOutside(event: MouseEvent) {
    if (!searchPageParams.name || !searchResultRef.value?.contains(event.target as Node)) {
        search_data.value = [];
    } else {
        search_data.value = [...lastSearchResult.value];
    }
}
//#endregion

//#region quiz
const quiz_data = ref<QuestionSet[]>([]);

const pageParams = reactive({
    pageNumber: 1,
    pageSize: 5,
});

// true ngay từ đầu: khung giữ chỗ hiện từ lần render đầu tiên, không nháy trạng thái rỗng
const recentLoading = ref(true);
const recentPlaceholderCount = getPlaceholderCount("dashboard_recent", 5, pageParams.pageSize);

const getData = async () => {
    try {
        recentLoading.value = true;
        let result = await ApiQuestionSet.GetRecentByLimit(
            pageParams as QuestionSetPublicPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            quiz_data.value = resultData.items;
            rememberPlaceholderCount("dashboard_recent", resultData.items.length);
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT class exam: " + error);
    } finally {
        recentLoading.value = false;
    }
};

//#endregion

//#region popular quiz

const public_quiz_data = ref<QuestionSet[]>([]);

const publicPageParams = reactive({
    pageNumber: 1,
    pageSize: 9,
    sortBy: QUESTION_SET_SORT_CATEGORY.RATING,
});

const publicLoading = ref(true);
const publicPlaceholderCount = getPlaceholderCount(
    "dashboard_public",
    3,
    publicPageParams.pageSize,
);

const getPublicQuizData = async () => {
    try {
        publicLoading.value = true;
        let result = await ApiQuestionSet.GetPublicByLimit(
            publicPageParams as QuestionSetPublicPageParams,
        );
        if (result.data.success) {
            let resultData = result.data.data;
            public_quiz_data.value = resultData.items;
            rememberPlaceholderCount("dashboard_public", resultData.items.length);
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT search qs: " + error);
    } finally {
        publicLoading.value = false;
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
    document.addEventListener("click", handleMouseClickOutside);
    const sidebarActiveItem = "dashboard";
    emit("updateSidebar", sidebarActiveItem);

    // tải song song: hai section có dữ liệu cùng lúc
    await Promise.all([getData(), getPublicQuizData()]);
});
</script>

<template>
    <div class="page-container">
        <div class="title-container">
            <a-row class="w-100">
                <a-col class="main-title" :span="20">
                    <span>{{ $t("dashboards.title") }}</span> <br />
                    <span>{{ $t("dashboards.sub_title", { username: user.fullName }) }}</span>
                </a-col>
            </a-row>
        </div>
        <div class="content">
            <div class="search-bar" ref="searchResultRef">
                <Input
                    @input="getSearchData"
                    v-model="searchPageParams.name"
                    :placeholder="t('class_question_set.other.search_placeholder')"
                >
                    <template #icon>
                        <i class="bx bx-search"></i>
                    </template>
                </Input>
                <div v-if="search_data.length > 0" :class="['search-result-container']">
                    <div class="search-result">
                        <div
                            class="search-result-item"
                            v-for="item in search_data"
                            @click="onRedirectToDetail(item.id)"
                        >
                            <div class="result-item-title">
                                {{ item.name }} ({{ item.ratingAverage }}⭐️)
                            </div>
                            <div class="result-item-description">
                                <span class="result-item-noq">
                                    {{
                                        $t(
                                            "dashboards.list_items.quiz.questions",
                                            item.totalQuestionCount,
                                        )
                                    }}
                                </span>
                                {{ $t("detail_QS.other.created_by", { username: item.createBy }) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="content-item">
                <div class="content-item-title">
                    <div>
                        <span>{{ $t("dashboards.sections.quiz.title") }}</span>
                        <span>{{ $t("dashboards.sections.quiz.sub_title") }}</span>
                    </div>
                    <RouterLink :to="{ name: 'User_Library' }" class="content-item-navigator">
                        <span>{{ $t("dashboards.buttons.viewAll") }}</span>
                        <i class="bx bx-chevron-right"></i>
                    </RouterLink>
                </div>
                <div class="quiz-container">
                    <!-- khung giữ chỗ cùng kích thước thẻ thật, số lượng = lần tải trước -> section không co giãn -->
                    <template v-if="recentLoading">
                        <div
                            v-for="n in recentPlaceholderCount"
                            :key="`placeholder-${n}`"
                            class="quiz-item item-placeholder"
                        ></div>
                    </template>
                    <template v-else>
                        <div
                            class="quiz-item"
                            v-for="quiz in quiz_data"
                            @click="onRedirectToDetail(quiz.id)"
                        >
                            <div class="quiz-item-title">
                                {{ quiz.name }} <i class="bx bx-chevron-right"></i>
                            </div>
                            <div class="quiz-item-info">
                                <i class="bx bx-message-square-edit bx-rotate-270"></i>
                                {{
                                    $t(
                                        "dashboards.list_items.quiz.questions",
                                        quiz.totalQuestionCount,
                                    )
                                }}
                            </div>
                            <div class="quiz-item-progress">
                                <div>{{ $t("dashboards.list_items.quiz.learningProgress") }}</div>
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
                    </template>
                    <div class="quiz-item add-button" @click="onRedirectToCreate">
                        <i class="bx bx-plus add-button-icon"></i>
                        <div class="add-button-context">
                            <span>{{ $t("dashboards.buttons.createNewQuiz") }}</span>
                            <span>{{ $t("dashboards.buttons.add_button_ins") }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="content-item">
                <div class="content-item-title">
                    <div>
                        <span>{{ $t("dashboards.sections.schedule.title") }}</span>
                        <span>{{ $t("dashboards.sections.schedule.sub_title") }}</span>
                    </div>
                    <RouterLink
                        :to="{ name: 'User_QuestionSet_Search' }"
                        class="content-item-navigator"
                    >
                        <span>{{ $t("dashboards.buttons.viewAll") }}</span>
                        <i class="bx bx-chevron-right"></i>
                    </RouterLink>
                </div>
                <div class="quiz-container">
                    <template v-if="publicLoading">
                        <div
                            v-for="n in publicPlaceholderCount"
                            :key="`placeholder-${n}`"
                            class="quiz-item item-placeholder"
                        ></div>
                    </template>
                    <template v-else>
                        <div
                            v-for="quiz in public_quiz_data"
                            class="quiz-item"
                            @click="onRedirectToDetail(quiz.id)"
                        >
                            <div class="p-quiz-item-info">
                                <div class="p-quiz-item-title">{{ quiz.name }}</div>
                                <!-- <div class="p-quiz-item-description">{{ quiz.description }}</div> -->
                            </div>
                            <div class="p-quiz-item-rating">
                                <div class="p-quiz-item-question-count">
                                    {{
                                        $t(
                                            "dashboards.list_items.quiz.questions",
                                            quiz.totalQuestionCount,
                                        )
                                    }}
                                </div>
                                <div class="p-quiz-item-question-rate">
                                    {{ quiz.ratingAverage }}⭐️ ({{ quiz.ratingCount }}
                                    {{ $t("detail_QS.other.reviews") }})
                                </div>
                            </div>
                            <div class="p-quiz-item-credit">
                                <span><i class="bx bx-user"></i> {{ quiz.createBy }}</span>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
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
.content-item-title a {
    font-size: 14px;
    font-weight: 600;
    color: var(--c-primary-text);
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
}
.content-item-title i {
    font-size: 20px;
    transition: transform 0.2s ease-in-out;
}

.content-item-title a:hover i {
    transform: translateX(4px);
}

.quiz-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
    padding: 0;
    color: var(--text-color);
}

.quiz-item {
    background-color: var(--content-item-background-color);
    margin: 0;
    box-sizing: border-box;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: start;
    width: 100%;
    max-width: none;
    height: 200px;
    max-height: 200px;
    cursor: pointer;
    box-shadow: none;
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
.quiz-item-title {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
}
.quiz-item-title i {
    flex: none;
    color: var(--c-text-muted);
}

.quiz-item-info {
    font-size: 13px;
    margin-bottom: 15px;
    color: var(--c-text-muted);
}
.quiz-item-info i {
    margin-right: 4px;
    font-size: 14px;
}

.quiz-item-progress {
    width: 100%;
    font-size: 12px;
    margin-bottom: 0;
    flex: 1;
    display: flex;
    align-items: start;
    flex-direction: column;
    justify-content: end;
    color: var(--c-text-muted);
}

::v-deep(.ant-progress-text) {
    color: var(--c-text-muted) !important;
    font-size: 12px;
}
::v-deep(.ant-progress-inner) {
    background-color: var(--content-item-border-color);
}

.add-button {
    justify-content: center;
    align-items: center;
    gap: 10px;
    background-color: transparent;
    border: 1px dashed var(--form-item-border-color);
    cursor: pointer;
}
.add-button:hover {
    border: 1px dashed var(--main-color);
}

.add-button-icon {
    display: flex;
    width: 40px;
    height: 40px;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    aspect-ratio: 1/1;
    font-size: 22px !important;
    border-radius: 50%;
    background: var(--main-color-theme);
    color: var(--c-primary-text);
}

.add-button-context {
    color: var(--text-color);
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    text-align: center;
    justify-content: center;
    gap: 2px;
    font-size: 14px;
    font-weight: 600;
}
.add-button-context span:nth-child(2) {
    font-size: 12px;
    font-weight: 400;
    color: var(--c-text-muted);
}

.search-bar {
    /* cùng bề rộng và lề với các khối .content-item bên dưới (width calc(100% - 60px), margin 8px) */
    width: calc(100% - 60px);
    max-width: calc(100% - 60px);
    margin: 8px 8px 0;
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

.search-result-item {
    margin: 0 0 8px;
    padding: 10px;
    color: var(--text-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    cursor: pointer;
    transition: border-color 0.15s ease-in-out;
}

.search-result-item:hover {
    border-color: var(--main-color);
    background-color: var(--c-surface-subtle);
}

.result-item-title {
    font-weight: 600;
}

.result-item-description {
    display: flex;
    align-items: center;
    color: var(--c-text-muted);
    font-size: 13px;
    margin-top: 6px;
}

::v-deep(.ant-input-affix-wrapper) {
    height: 40px;
}

.result-item-noq {
    font-size: 12px;
    font-weight: 500;
    color: var(--c-primary-text);
    padding: 2px 10px;
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-radius: 999px;
    width: fit-content;
    display: flex;
    align-items: center;
    margin-right: 10px;
}

.p-quiz-item-title {
    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    color: var(--text-color);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.p-quiz-item-description {
    font-size: 13px;
    color: var(--c-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 200px;
}

.p-quiz-item-rating {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    width: 100%;
}
.p-quiz-item-question-rate {
    font-size: 12px;
    color: var(--c-text-muted);
}

.p-quiz-item-question-count {
    font-size: 12px;
    font-weight: 500;
    padding: 2px 10px;
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    color: var(--c-primary-text);
    display: flex;
    align-items: center;
    height: fit-content;
    border-radius: 999px;
}
.p-quiz-item-credit {
    flex: 1;
    display: flex;
    align-items: end;
    font-size: 13px;
    color: var(--c-text-muted);
}
.p-quiz-item-credit span {
    display: flex;
    align-items: center;
}
.p-quiz-item-credit i {
    font-size: 16px;
    margin-right: 6px;
}
</style>
