<script lang="ts" setup>
import ApiTest from "@/api/ApiTest";

import { ref, onMounted, computed } from "vue";
import dayjs, { Dayjs } from "dayjs";

import "dayjs/locale/vi";
import "dayjs/locale/en";

import viVN from "ant-design-vue/es/locale/vi_VN";
import enUS from "ant-design-vue/es/locale/en_US";

import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

//#region locale
const locale = ref(viVN);
const changeLocale = () => {
    const lang = localStorage.getItem("locale") || "en";
    if (lang === "en") {
        locale.value = enUS;
        dayjs.locale("en");
    } else {
        locale.value = viVN;
        dayjs.locale("vi");
    }
};
//#endregion

//#region interface
interface TestSchedule {
    testId: string;
    testName: string;
    classId: string;
    className: string;
    // thời điểm thật (ISO, có offset) của bài test; dùng để gom nhóm theo ngày ĐỊA PHƯƠNG của người dùng
    timeStart: string;
    timeFinish?: string;
    // ngày do server gom theo UTC (chỉ dùng làm fallback nếu thiếu timeStart)
    date?: string;
}

interface ScheduleData {
    date: string;
    testSchedules: TestSchedule[];
}

//#endregion

const data = ref<ScheduleData[]>([]);

const DAY_KEY = "YYYY-MM-DD";

// Gom lại toàn bộ test theo ngày địa phương (server nhóm theo ngày UTC nên không dùng được trực tiếp)
const testsByLocalDay = computed(() => {
    const map = new Map<string, TestSchedule[]>();
    const seen = new Set<string>();
    for (const group of data.value) {
        for (const test of group.testSchedules ?? []) {
            if (seen.has(test.testId)) continue;
            seen.add(test.testId);

            const key = dayjs(test.timeStart ?? test.date ?? group.date).format(DAY_KEY);
            const list = map.get(key) ?? [];
            list.push(test);
            map.set(key, list);
        }
    }
    for (const list of map.values()) {
        list.sort((a, b) => dayjs(a.timeStart).valueOf() - dayjs(b.timeStart).valueOf());
    }
    return map;
});

const chosenDate = ref<Dayjs>(dayjs());
const watchChosenDate = ref<Dayjs>(dayjs());

const chosenDateTestSchedules = computed(() => {
    return chosenDate.value ? testsByLocalDay.value.get(dayjs(chosenDate.value).format(DAY_KEY)) || [] : [];
});

const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;
        const result = await ApiTest.GetTestSchedule(
            chosenDate.value.month() + 1,
            chosenDate.value.year(),
        );
        if (result.data.success) {
            data.value = result.data.data;
            watchChosenDate.value = chosenDate.value;
        }
    } catch (error) {
        console.log(error);
    } finally {
        loading.value = false;
    }
};

//change to another month or year
const GetCalendarData = async () => {
    if (
        !dayjs(chosenDate.value).isSame(dayjs(watchChosenDate.value), "month") ||
        !dayjs(chosenDate.value).isSame(dayjs(watchChosenDate.value), "year")
    ) {
        await getData();
    }
};

const getListData = (date: string | Dayjs) => {
    const numberOfTest = testsByLocalDay.value.get(dayjs(date).format(DAY_KEY))?.length;

    if (!numberOfTest) return null;

    return t("schedule.tests_count", { n: numberOfTest }, numberOfTest);
};

const onRedirectToClass = (classId: string) => {
    router.push({ name: "User_Class_Exam", params: { id: classId } });
};

const emit = defineEmits(["updateSidebar"]);
onMounted(async () => {
    const sidebarActiveItem = "schedule";
    emit("updateSidebar", sidebarActiveItem);
    changeLocale();

    await getData();
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <a-row class="w-100">
                <a-col class="main-title" :span="20">
                    <span>{{ $t("schedule.title") }}</span> <br />
                </a-col>
            </a-row>
        </div>
        <div class="content d-flex flex-row justify-content-between">
            <div class="col-md-9 content-item">
                <div class="schedule-container">
                    <a-config-provider :locale="locale">
                        <a-calendar v-model:value="chosenDate" @change="GetCalendarData">
                            <template #dateCellRender="{ current }">
                                <a-badge
                                    v-if="getListData(current)"
                                    :status="'success'"
                                    :text="getListData(current)"
                                />
                            </template>
                            <template #monthCellRender="{ current }"></template>
                        </a-calendar>
                    </a-config-provider>
                </div>
            </div>
            <div class="col-md-3 content-item">
                <div class="schedule-detail-title">
                    <div>
                        {{
                            $t("schedule.current_date", {
                                date: dayjs(chosenDate).format("DD/MM/YYYY"),
                            })
                        }}
                    </div>
                    <div class="schedule-detail-sub-title">
                        {{ $t("schedule.count_exam") }}
                        <span class="exam_count">{{ chosenDateTestSchedules.length }}</span>
                    </div>
                </div>
                <div class="schedule-item-container">
                    <template v-if="chosenDateTestSchedules.length > 0">
                        <div
                            v-for="(schedule, index) in chosenDateTestSchedules"
                            :key="schedule.testId"
                            class="schedule-item"
                        >
                            <div>{{ index + 1 }}.</div>
                            <div class="schedule-item-info">
                                <div
                                    class="schedule-item-info-test"
                                    @click="onRedirectToClass(schedule.classId)"
                                >
                                    {{ schedule.testName }}
                                </div>
                                <div class="schedule-item-info-class">{{ schedule.className }}</div>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div class="w-100 h-100 d-flex justify-content-center align-items-center">
                            <a-empty>
                                <template #description>
                                    <span> {{ $t("class_index.other.no_data_matches") }}</span>
                                </template>
                            </a-empty>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
/* .content-item mặc định rộng "100% - 60px": 2 cột bị tràn và cột phải bị cắt ở mép màn hình */
.content-item {
    width: auto;
    max-width: none;
    min-width: 0;
    padding: 20px;
}

.content-item.col-md-9 {
    flex: 3 1 0;
}

.content-item.col-md-3 {
    flex: 1 1 0;
    min-width: 260px;
}

.schedule-detail-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color);
}
.schedule-detail-sub-title {
    font-size: 13px;
    color: var(--c-text-muted);
}

::v-deep(.ant-picker-calendar) {
    background: var(--content-item-background-color);
}

::v-deep(.ant-picker-calendar-header) {
    padding: 0 0 12px;
    background: transparent;
}

::v-deep(.ant-picker-body) {
    background: var(--content-item-background-color);
}

::v-deep(.ant-picker-content th) {
    color: var(--c-text-muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

::v-deep(.ant-picker-cell-inner) {
    color: var(--text-color-grey);
    border-color: var(--content-item-border-color) !important;
}

::v-deep(.ant-picker-cell-inner):hover {
    background: var(--c-surface-subtle) !important;
}

::v-deep(.ant-picker-cell-in-view .ant-picker-cell-inner) {
    color: var(--text-color) !important;
}

/* ô ngày: khung viền mảnh bo góc, hôm nay / đang chọn viền nhấn + nền nhấn nhạt */
::v-deep(.ant-picker-calendar.ant-picker-calendar-full .ant-picker-calendar-date) {
    margin: 2px;
    padding: 6px 8px;
    border: 1px solid var(--content-item-border-color) !important;
    border-radius: var(--ui-r-md);
    transition: border-color 0.15s ease-in-out;
}

::v-deep(.ant-picker-calendar.ant-picker-calendar-full .ant-picker-calendar-date-value) {
    font-size: 13px;
    font-weight: 500;
}

::v-deep(.ant-picker-calendar-date-today.ant-picker-cell-selected) {
    background: color-mix(in srgb, var(--main-color) 14%, var(--c-surface)) !important;
    border-color: var(--main-color) !important;
    color: var(--text-color) !important;
}

::v-deep(.ant-picker-calendar.ant-picker-calendar-full .ant-picker-calendar-date-today) {
    border-color: var(--main-color) !important;
}

::v-deep(.ant-picker-cell-inner.ant-picker-calendar-date-today .ant-picker-calendar-date-value) {
    color: var(--c-primary-text) !important;
}
::v-deep(
    .ant-picker-calendar.ant-picker-calendar-full
        .ant-picker-cell-selected
        .ant-picker-calendar-date
        .ant-picker-calendar-date-value
) {
    color: var(--c-primary-text) !important;
}

::v-deep(.ant-picker-calendar-date-content) {
    color: var(--text-color) !important;
}

::v-deep(.ant-picker-calendar-date-content::-webkit-scrollbar) {
    width: 10px;
}

::v-deep(.ant-picker-calendar-date-content::-webkit-scrollbar-thumb) {
    width: 5px;
    max-height: 5px;
    background-color: var(--main-color);
    border-radius: 999px;
}

::v-deep(.ant-picker-cell-selected .ant-picker-cell-inner) {
    background: color-mix(in srgb, var(--main-color) 14%, var(--c-surface)) !important;
    border-color: var(--main-color) !important;
}

::v-deep(.ant-radio-button-wrapper) {
    background: var(--form-item-background-color);
    border-color: var(--form-item-border-color);
    color: var(--text-color);
    display: none;
}

::v-deep(.ant-radio-button-wrapper-checked) {
    border-color: var(--main-color) !important;
    color: var(--c-primary-text) !important;
}

::v-deep(.ant-badge-status-text) {
    color: var(--text-color) !important;
    font-size: 12px;
}
::v-deep(.ant-badge-status-success) {
    background-color: var(--main-color) !important;
}

@media (max-width: 575.98px) {
    ::v-deep(.ant-picker-calendar-date-content .ant-badge) {
        display: block;
        white-space: nowrap;
    }
    ::v-deep(.ant-picker-calendar-date-content .ant-badge-status-dot) {
        display: none;
    }
    ::v-deep(.ant-picker-calendar-date-content .ant-badge-status-text) {
        margin-inline-start: 0;
        font-size: 10px;
        line-height: 1.2;
    }
}

.schedule-item-container {
    height: 500px;
    max-height: 700px;
    overflow-y: auto;
    padding: 0px 5px;
    margin-top: 12px;
}

.schedule-item {
    display: flex;
    padding: 10px 12px;
    margin-bottom: 8px;
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    transition: border-color 0.15s ease-in-out;
}

.schedule-item:hover {
    border-color: var(--main-color);
}

.schedule-item-info {
    display: flex;
    flex-direction: column;
    margin-left: 10px;
}

.schedule-item-info-test {
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.schedule-item-info-test:hover {
    color: var(--c-primary-text);
}

.schedule-item-info-class {
    font-size: 13px;
    color: var(--c-text-muted);
}
.exam_count {
    font-weight: 600;
    color: var(--c-primary-text);
}
</style>
