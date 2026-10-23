<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import Input from "@/shared/components/Common/Input.vue";
import { message } from "ant-design-vue";
import ApiPlan from "../../../../src/api/ApiPlan";
import type HistoryPayment from "../../../../src/models/request/plan/historyPayment";
import type PaymentHistory from "../../../../src/models/response/plan/paymentHistory";
import { useAuthStore } from "@/stores/AuthStore";
import { useRoute } from "vue-router";
import ApiUser from "@/api/ApiUser";

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
// const user_info = authStore.getUserInfo();
const modal_qr_open = ref(false);
const isCreateQrLoading = ref(false);
const dataSource = ref<PaymentHistory[]>([]);
const historyPaymentPayload = ref<HistoryPayment>({
    pageNumber: 1,
    pageSize: 5,
});
const userData = reactive({
    id: "",
    email: "",
    fullName: "",
    tokenCount: 0,
    balance: 0,
    roles: [],
});
const qrSrc = ref<string>("");

// Ẩn tạm phần Nạp tiền (thông tin ngân hàng + QR). Bật lại bằng cách đổi thành true
const SHOW_DEPOSIT = false;

// số tiền nạp: chỉ nhận số nguyên >= 5000 (backend nhận int)
const MIN_TOP_UP_AMOUNT = 5000;
const MAX_TOP_UP_AMOUNT = 2000000000;

const inputAmountFormRef = ref({
    amount: "",
});
const errorMessage = ref("");

// trả về chuỗi lỗi (đã dịch) hoặc "" nếu hợp lệ
const validateAmount = (raw: string): string => {
    const value = String(raw ?? "").trim();
    if (!value) return t("settings.billing.err.required");
    if (!/^\d+$/.test(value)) return t("settings.billing.err.number_only");
    const num = Number(value);
    if (num < MIN_TOP_UP_AMOUNT) return t("settings.billing.err.greater_than_5000");
    if (num > MAX_TOP_UP_AMOUNT) return t("settings.billing.err.too_large");
    return "";
};

// chỉ hiển thị lỗi sau khi người dùng đã nhập hoặc bấm tạo QR
const onAmountInput = () => {
    errorMessage.value = validateAmount(inputAmountFormRef.value.amount);
};

const onOpenQrModal = async () => {
    errorMessage.value = validateAmount(inputAmountFormRef.value.amount);
    if (errorMessage.value) return;
    const created = await onQrGenerate();
    if (created) modal_qr_open.value = true;
};

const getUserData = async () => {
    try {
        let result = await ApiUser.GetUserInfo();

        Object.assign(userData, result.data.data);
    } catch (err) {
        console.log(err);
    }
};

const getHistoryPayment = async () => {
    try {
        let result = await ApiPlan.HistoryPayment(pageParams as HistoryPayment);
        dataSource.value = result.data.data.items;

        if (result.data.success) {
            let resultData = result.data.data;
            dataSource.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;
        }
    } catch (err) {
        console.log(err);
    }
};

const onQrGenerate = async (): Promise<boolean> => {
    isCreateQrLoading.value = true;
    try {
        const amount = Number(inputAmountFormRef.value.amount.trim());
        let result = await ApiPlan.QrCodeGenerate(amount);

        if (result.data.success) {
            qrSrc.value = result.data.data;
            return true;
        }
        message.error(t("settings.billing.err.qr_failed"));
    } catch (error: any) {
        message.error(t("settings.billing.err.qr_failed"));
        console.log("error", error?.response?.data);
    } finally {
        isCreateQrLoading.value = false;
    }
    return false;
};

const formatDate = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const formatCurrency = (num?: number) => {
    return Number(num).toLocaleString("en-US") + " VND";
};

const columns = computed(() => [
    {
        title: t("settings.billing.col.no"),
        dataIndex: "no",
        customRender: ({ index }: { index: number }) => {
            return (Number(pageParams.pageNumber) - 1) * Number(pageParams.pageSize) + index + 1;
        },
        width: 50,
        align: "center",
    },
    {
        title: t("settings.billing.col.date"),
        dataIndex: "date",
        key: "date",
        width: 300,
        align: "center",
    },
    {
        title: t("settings.billing.col.plan"),
        dataIndex: "planName",
        key: "planName",
        width: 200,
        align: "center",
    },
    {
        title: t("settings.billing.col.amount"),
        dataIndex: "price",
        key: "price",
        width: 200,
        align: "center",
        customRender: ({ text }: { text: number }) => formatCurrency(text),
    },
    {
        title: t("settings.billing.col.status"),
        dataIndex: "status",
        key: "status",
        defaultSortOrder: "ascend",
        width: 200,
        align: "center",
    },
]);

const statusLabel = (status: string) => {
    const key = String(status).toLowerCase() === "topup" ? "topup" : String(status).toLowerCase();
    return ["topup", "paid"].includes(key) ? t(`settings.billing.status.${key}`) : status;
};

const pageParams = reactive({
    pageNumber: route.query.pageNumber || 1,
    pageSize: route.query.pageSize || 5,
    totalCount: 0,
    statusFilter: false,
});

//change when page change (pageParams)
const onPaginationChange = (page: any, pageSize: any) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    pageParams.statusFilter = true;
    getHistoryPayment();
};

onMounted(() => {
    getHistoryPayment();
    getUserData();
});
</script>
<template>
    <div class="content">
        <div class="content-item">
            <div class="content-item-title">
                <div class="w-50">
                    <span>{{ $t("settings.billing.title") }}</span>
                    <span>{{ $t("settings.billing.sub_title") }}</span>
                </div>
                <div class="w-50 justify-content-center m-2">
                    <span class="text-end"
                        >{{ $t("settings.billing.points") }}:
                        {{ formatCurrency(userData.balance) }}</span
                    >
                </div>
            </div>

            <div class="w-100">
                <a-table
                    :data-source="dataSource"
                    :columns="columns"
                    row-key="id"
                    :pagination="false"
                >
                    <template #bodyCell="{ column, text }">
                        <template v-if="column.key === 'date'"> {{ formatDate(text) }}</template>

                        <template v-if="column.key === 'status'">
                            <span
                                :class="['status-pill', `status-${String(text).toLowerCase()}`]"
                                >{{ statusLabel(text) }}</span
                            >
                        </template>
                    </template>
                </a-table>
            </div>
            <div class="pagination-container" style="margin-top: 10px">
                <a-pagination
                    @change="onPaginationChange"
                    v-model:current="pageParams.pageNumber"
                    :total="pageParams.totalCount"
                    :pageSize="pageParams.pageSize"
                    :show-total="
                        (total: any, range: any) =>
                            `${range[0]}-${range[1]} of ${total} ${t('settings.billing.transaction_count')}`
                    "
                    show-size-changer
                    class="crud-layout-pagination"
                    :locale="{
                        items_per_page: t('class_index.other.pages'),
                    }"
                ></a-pagination>
            </div>
        </div>

        <!-- Nạp tiền: ẩn tạm (đặt SHOW_DEPOSIT = true để hiện lại) -->
        <div v-if="SHOW_DEPOSIT" class="content-item">
            <div class="content-item-title">
                <div class="w-50">
                    <span>{{ $t("settings.billing.deposit.title") }}</span>
                    <span>{{ $t("settings.billing.deposit.content") }}</span>
                </div>
            </div>
            <div class="d-flex justify-content-center">
                <div class="content-item-title w-50 d-flex flex-column align-items-center">
                    <div class="content-item">
                        <span>{{ t("settings.billing.bank.name") }}</span>
                        <span>Nguyen Khac Thanh</span>
                    </div>
                    <div class="content-item">
                        <span>{{ t("settings.billing.bank.number") }}</span>
                        <span>4271033443</span>
                    </div>
                    <div class="content-item">
                        <span>{{ t("settings.billing.bank.bank_name") }}</span>
                        <span>BIDV</span>
                    </div>
                </div>
                <div class="w-50" style="justify-items: center">
                    <div class="content-item d-flex flex-column gap-2">
                        <div class="d-flex justify-content-center">
                            <i class="me-2 bx bx-qr" style="font-size: 24px"></i>
                            <span>{{ t("settings.billing.qr.title") }}</span>
                        </div>

                        <div class="d-flex gap-2 justify-content-center align-items-center">
                            <span class="">{{ t("settings.billing.qr.amount") }}:</span>
                            <span>
                                <Input
                                    v-model:value="inputAmountFormRef.amount"
                                    :placeholder="t('settings.billing.amount_placeholder')"
                                    style="width: 100%"
                                    :is-required="true"
                                    @change="onAmountInput"
                                />
                            </span>
                            <span>VNĐ</span>
                        </div>
                        <div class="d-flex gap-2 justify-content-center align-items-center">
                            <span v-if="errorMessage" class="text-danger">{{ errorMessage }}</span>
                        </div>

                        <div class="d-flex gap-2 justify-content-center align-items-center">
                            <a-button
                                :loading="isCreateQrLoading"
                                class="main-color-btn"
                                type="primary"
                                size="large"
                                @click="onOpenQrModal"
                            >
                                <i class="me-2 bx bx-qr"></i>
                                {{ t("settings.billing.qr.qr_gen") }}
                            </a-button>
                        </div>
                        <div class="d-flex flex-column justify-content-center align-items-center">
                            <div class="d-flex">
                                <i class="me-2 bx bx-info-circle" style="font-size: 24px"></i>
                                <span class="fw-bold">{{ t("settings.billing.noti.title") }}</span>
                            </div>
                            <span>• {{ t("settings.billing.noti.content1") }}: 5,000 VNĐ</span>
                            <span>• {{ t("settings.billing.noti.content2") }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="noti-content">
                <div class="text-white fw-bold fs-6">
                    {{ $t("settings.billing.note.title") }}
                </div>
                <div class="text-white">
                    {{ $t("settings.billing.note.content1") }}
                </div>
                <div class="text-white">
                    {{ $t("settings.billing.note.content2") }}
                </div>
                <div class="text-white">{{ $t("settings.billing.note.contact") }}: 0986386984</div>
            </div>
        </div>
    </div>

    <!-- qr modal -->
    <a-modal
        width="750px"
        centered
        wrap-class-name="medium-modal"
        :open="modal_qr_open"
        @cancel="modal_qr_open = false"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="2">
                        <RouterLink @click="modal_qr_open = false" :to="{ name: '' }">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col :span="1" class="d-flex align-items-center justify-content-center">
                        <i class="me-2 bx bx-qr" style="font-size: 27px"></i>
                    </a-col>
                    <a-col class="main-title" :span="21">
                        <span>{{ t("settings.billing.modal.title") }}</span> <br />
                        <span>{{ t("settings.billing.modal.content") }}</span> <br />
                    </a-col>
                </a-row>
            </div>
        </div>
        <div class="d-flex justify-content-center">
            <div class="content-item w-25 d-flex justify-content-center">
                {{ t("settings.billing.qr.amount") }}: {{ inputAmountFormRef.amount }} VND
            </div>
        </div>
        <div class="d-flex justify-content-center">
            <img v-if="qrSrc" :src="qrSrc" alt="QR Code" />
        </div>

        <template #footer>
            <a-button
                class="main-color-btn"
                key="submit"
                type="primary"
                @click="
                    () => {
                        modal_qr_open = false;
                        getUserData();
                        getHistoryPayment();
                    }
                "
            >
                {{ t("settings.billing.modal.close_btn") }}
            </a-button>
        </template>
    </a-modal>
</template>

<style scoped>
/* badge trạng thái: tag tròn, nền nhạt theo màu trạng thái */
.status-pill {
    display: inline-block;
    padding: 2px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    background-color: var(--c-surface-subtle);
    color: var(--c-text-muted);
    border: 1px solid var(--c-border);
}

.status-paid {
    background-color: color-mix(in srgb, var(--c-success) 14%, var(--c-surface));
    color: var(--c-success-text);
    border: 1px solid color-mix(in srgb, var(--c-success) 45%, var(--c-surface));
}
.status-topup {
    background-color: color-mix(in srgb, var(--c-warning) 14%, var(--c-surface));
    color: var(--c-warning-text);
    border: 1px solid color-mix(in srgb, var(--c-warning) 45%, var(--c-surface));
}
/* vạch ngăn giữa các tiêu đề cột: mờ hơn, theo token */
:deep(.ant-table-thead > tr > th::before) {
    background-color: var(--c-border) !important;
}
.noti-content {
    width: calc(100% - 20px);
    margin: 8px;
    margin-bottom: 0px;
    padding: 10px;
    background-color: var(--main-color);
    border: 1px solid var(--main-sub-color);
    color: var(--text-color);
    border-radius: var(--ui-r-md);
    overflow-y: hidden;
    z-index: 2;
}
</style>
