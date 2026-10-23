<script setup lang="ts">
import ApiTest from "@/api/ApiTest";

import { ref, reactive, watch } from "vue";

import { message, Modal, type TableColumnType } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { formatScore } from "@/services/QuestionValidator";
import { at, attempt } from "lodash";
import TEST_STATUS from "@/constants/testStatus";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

//#region interface
type Props = {
    testId: string;
    userId: string | null;
    testName: string;
    studentName: string | null;
    passingScore: number | null;
};

const props = defineProps<Props>();

interface Attempt {
    attemptId: string;
    studentName: string;
    studentEmail: string;
    timeStart: string;
    timeSubmit: string;
    score: number;
    status: string;
    canReview: boolean;
}

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

//#endregion

//#region init data

const attemptData = ref<Attempt[]>([]);
const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;
        let result = await ApiTest.GetUserExamHistory(props.testId, props.userId);

        if (result.data.success) {
            let resultData = result.data.data;
            attemptData.value = resultData.items;
        }
    } catch (error) {
        console.log("ERROR: GETALLEXAMBYLIMIT user exam result: " + error);
    } finally {
        loading.value = false;
    }
};

type MyColumn = TableColumnType<Attempt>;

const columns: MyColumn[] = [
    {
        title: t("user_attempts_modal.columns.no"),
        key: "no",
        customRender: (info: { index: number }) => info.index + 1,
    },
    {
        title: t("user_attempts_modal.columns.start"),
        dataIndex: "timeStart",
        key: "timeStart",
        sorter: (a: any, b: any) => dayjs(a.timeStart).unix() - dayjs(b.timeStart).unix(),
    },
    {
        title: t("user_attempts_modal.columns.submit"),
        dataIndex: "timeSubmit",
        key: "timeSubmit",
        sorter: (a: any, b: any) => dayjs(a.timeSubmit).unix() - dayjs(b.timeSubmit).unix(),
    },
    {
        title: t("user_attempts_modal.columns.student_score"),
        dataIndex: "score",
        key: "score",
        sorter: (a: any, b: any) => a.score - b.score,
    },
    // {
    //     title: "Passing score",
    //     dataIndex: "passingScore",
    //     key: "passingScore",
    //     sorter: (a: any, b: any) => a.score - b.score,
    // },
    {
        title: t("user_attempts_modal.columns.result"),
        dataIndex: "status",
        key: "status",
    },
    {
        title: t("user_attempts_modal.columns.action"),
        dataIndex: "action",
        key: "action",
    },
];

//#endregion

const onRedirectToReview = (attemptId: string) => {
    router.push({ name: "User_Test_Review", params: { id: attemptId } });
};
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
                        <span>{{ testName }}</span>
                    </a-col>
                </a-row>
            </div>
            <div class="content">
                <div class="content-item">
                    <div class="content-item-title">
                        <div>
                            <span>{{ studentName }}</span>
                        </div>
                    </div>
                    <a-config-provider
                        v-if="attemptData.length > 0"
                        :locale="{
                            Table: {
                                cancelSort: '',
                                triggerAsc: '',
                                triggerDesc: '',
                            },
                        }"
                    >
                        <a-table
                            :columns="columns"
                            :data-source="attemptData"
                            row-key="studentId"
                            :pagination="false"
                        >
                            <template #bodyCell="{ column, record }">
                                <template v-if="column.key === 'score'">
                                    {{ formatScore(record.score) }}
                                </template>
                                <template v-if="column.key === 'timeStart'">
                                    <div class="text-nowrap">
                                        {{ dayjs(record.timeStart).format("DD/MM/YYYY HH:mm:ss") }}
                                    </div>
                                </template>
                                <template v-if="column.key === 'timeSubmit'">
                                    <div class="text-nowrap">
                                        {{ dayjs(record.timeSubmit).format("DD/MM/YYYY HH:mm:ss") }}
                                    </div>
                                </template>
                                <!-- <template v-if="column.key === 'passingScore' && passingScore">
                                    <div class="text-nowrap">{{ passingScore }}%</div>
                                </template> -->
                                <template v-if="column.key === 'status'">
                                    <a-tag
                                        :class="{
                                            'status-passed': record.status === TEST_STATUS.PASSED,
                                            'status-failed': record.status === TEST_STATUS.FAILED,
                                        }"
                                    >
                                        {{ record.status }}
                                    </a-tag>
                                </template>
                                <template v-if="column.key === 'action'">
                                    <a-button
                                        v-if="record.canReview"
                                        type="ghost"
                                        class="main-color-btn-ghost"
                                        @click="onRedirectToReview(record.attemptId)"
                                    >
                                        {{ $t("user_attempts_modal.buttons.review") }}
                                    </a-button>
                                </template>
                            </template>
                        </a-table>
                    </a-config-provider>
                    <template v-else>
                        <div class="w-110 d-flex justify-content-center">
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
        <template #footer> </template>
    </a-modal>
</template>
<style scoped>
.text-nowrap {
    white-space: nowrap;
}
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
.content-item .content-item-title {
    margin-bottom: 16px;
    font-size: 18px;
    font-weight: 700;
}
.status-passed {
    color: var(--c-success-text);
    background-color: color-mix(in srgb, var(--c-success) 16%, var(--c-surface));
    border-color: var(--c-success);
}
.status-failed {
    color: var(--c-danger-text);
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
    border-color: var(--c-danger);
}
@media (max-width: 767.98px) {
    .content-item {
        padding: 14px;
    }
}
</style>
