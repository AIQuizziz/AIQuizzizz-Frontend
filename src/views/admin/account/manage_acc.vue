<script setup lang="ts">
import { ref, onMounted, computed, reactive, nextTick, watch, h } from "vue";
import { useI18n } from "vue-i18n";
import ApiAdmin from "../../../../src/api/ApiAdmin";
import type ManageAccountsParams from "../../../../src/models/request/admin/manageAccountsParams";
import type ManageAccountsResp from "../../../../src/models/response/admin/manageAccountsResp";
import debounce from "lodash/debounce";
import { message, Modal, Textarea } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/AuthStore";
import UserAvatar from "@/shared/components/Common/UserAvatar.vue";

const emit = defineEmits(["updateSidebar"]);
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const user_info = authStore.getUserInfo();
// select box for account status
const optionKeysAccStatus = ["all", "active", "ban"];
const account_status_credit_options = computed(() =>
    optionKeysAccStatus.map((key) => ({
        label: t(`admin.manage_acc.acc_status.${key}`),
        value: key,
    })),
);
// const selected_acc_status_option = ref(account_status_credit_options.value[0].value);

// select box for user role
const optionKeysAccRole = ["all", "Administrator", "Moderator", "User"];
const account_role_credit_options = computed(() =>
    optionKeysAccRole.map((key) => ({
        label: t(`admin.manage_acc.acc_role.${key}`),
        value: key,
    })),
);
// const selected_acc_role_option = ref(account_role_credit_options.value[0].value);

const columns = computed(() => [
    {
        title: "ID",
        dataIndex: "id",
        customRender: ({ index }: { index: number }) => {
            return (Number(pageParams.pageNumber) - 1) * Number(pageParams.pageSize) + index + 1;
        },
        width: 50,
        align: "center",
    },
    {
        title: t("admin.manage_acc.col.fullname"),
        dataIndex: "fullName",
        key: "fullName",
        sorter: (a: { fullName: string }, b: { fullName: string }) =>
            a.fullName.localeCompare(b.fullName),
        width: 350,
        align: "center",
    },
    {
        title: t("admin.manage_acc.col.email"),
        dataIndex: "email",
        key: "email",
        sorter: (a: { email: string }, b: { email: string }) => a.email.localeCompare(b.email),
        width: 450,
        align: "center",
    },
    // {
    //     title: "Token",
    //     dataIndex: "token",
    //     key: "token",
    //     sorter: (a: { token: number }, b: { token: number }) => a.token - b.token,
    //     width: 100,
    //     align: "center",
    // },
    {
        title: t("admin.manage_acc.col.role"),
        dataIndex: "role",
        key: "role",
        sorter: (a: { role: string }, b: { role: string }) => a.role.localeCompare(b.role),
        width: 100,
        align: "center",
    },
    { title: "", key: "ban", width: 120, align: "center" },
]);

onMounted(() => {
    const sidebarActiveItem = "account";
    emit("updateSidebar", sidebarActiveItem);
    getUsersData();
});

// data cho bảng để hiển thị
const dataSource = ref<ManageAccountsResp[]>([]);

async function onToggle(record: ManageAccountsResp) {
    // console.log("Toggle active:", record.isBanned);
    // console.log("Toggle active:", record.id);
    try {
        if (!record.isBanned) {
            Modal.confirm({
                title: t("admin.manage_acc.unban_title"),
                content: t("admin.manage_acc.unban_content"),
                centered: true,
                onOk: async () => {
                    try {
                        await ApiAdmin.BanUser(record.id, { isBanned: false });
                        message.success(t("admin.manage_acc.unban_success"));
                    } catch (error) {
                        console.log(error);
                    }
                    await getUsersData();
                },
                onCancel: async () => {
                    await getUsersData();
                },
            });
        } else {
            const banReason = ref("");
            Modal.confirm({
                title: t("admin.manage_acc.ban_title"),
                content: () =>
                    h("div", [
                        h("p", t("admin.manage_acc.ban_content")),
                        h(Textarea, {
                            value: banReason.value,
                            "onUpdate:value": (v: string) => (banReason.value = v),
                            rows: 3,
                            maxlength: 1000,
                            placeholder: t("admin.manage_acc.ban_reason_placeholder"),
                        }),
                    ]),
                centered: true,
                onOk: async () => {
                    try {
                        await ApiAdmin.BanUser(record.id, {
                            isBanned: true,
                            message: banReason.value.trim() || undefined,
                        });
                        message.success(t("admin.manage_acc.ban_success"));
                    } catch (error) {
                        console.log(error);
                    }
                    await getUsersData();
                },
                onCancel: async () => {
                    await getUsersData();
                },
            });
        }
    } catch (error) {
        console.error("Toggle active ERROR:", error);
    }
}

async function onPromoteToModerator(record: ManageAccountsResp) {
    try {
        // console.log("Promote uid: ", record.id);
        Modal.confirm({
            title: t("admin.manage_acc.promote_title"),
            content: t("admin.manage_acc.promote_content"),
            centered: true,
            onOk: async () => {
                try {
                    await ApiAdmin.AssignRole(record.id, { role: "Moderator" });
                    message.success(t("admin.manage_acc.promote_success"));
                } catch (error) {
                    console.log(error);
                }
                await getUsersData();
            },
            onCancel: async () => {
                await getUsersData();
            },
        });
    } catch (error) {
        console.error("Promote to Moderator:", error);
    }
}

async function onDemoteToUser(record: ManageAccountsResp) {
    try {
        // console.log("Demote uid: ", record.id);
        Modal.confirm({
            title: t("admin.manage_acc.demote_title"),
            content: t("admin.manage_acc.demote_content"),
            centered: true,
            onOk: async () => {
                try {
                    await ApiAdmin.AssignRole(record.id, { role: "User" });
                    message.success(t("admin.manage_acc.demote_success"));
                } catch (error) {
                    console.log(error);
                }
                await getUsersData();
            },
            onCancel: async () => {
                await getUsersData();
            },
        });
    } catch (error) {
        console.error("Toggle active ERROR:", error);
    }
}

// bộ lọc + trang hiện tại được giữ trên URL (?pageNumber=2&role=User...) và khôi phục khi reload
const queryNumber = (value: unknown, fallback: number) => {
    const n = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
};
const queryOption = (value: unknown, allowed: string[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    return typeof v === "string" && allowed.includes(v) ? v : allowed[0];
};

const pageParams = reactive({
    pageNumber: queryNumber(route.query.pageNumber, 1),
    pageSize: queryNumber(route.query.pageSize, 10),
    keyword: route.query.keyword?.toString() || "",
    isBanned: queryOption(route.query.isBanned, optionKeysAccStatus),
    role: queryOption(route.query.role, optionKeysAccRole),
    fieldName: "Email",
    totalCount: 0,
    statusFilter: false,
});

const syncQuery = () => {
    router.replace({
        query: {
            pageNumber: String(pageParams.pageNumber),
            pageSize: String(pageParams.pageSize),
            ...(pageParams.keyword ? { keyword: pageParams.keyword } : {}),
            isBanned: pageParams.isBanned,
            role: pageParams.role,
        },
    });
};

// đổi bộ lọc/từ khoá thì quay về trang 1
const onFilterChange = () => {
    pageParams.pageNumber = 1;
    getUsersData();
};
const onKeywordChange = debounce(onFilterChange, 300);

//change when page change (pageParams)
const onPaginationChange = (page: any, pageSize: any) => {
    pageParams.pageNumber = page;
    pageParams.pageSize = pageSize;
    pageParams.statusFilter = true;
    getUsersData();
};

const mapStatusToApi = (status: string) => {
    if (status === "active") return false;
    if (status === "ban") return true;
    return undefined; // all
};

const mapRoleToApi = (role: string) => {
    if (role === "Administrator") return "Administrator";
    if (role === "Moderator") return "Moderator";
    if (role === "User") return "User";
    return "";
};

const getUsersData = async () => {
    try {
        const payload: any = { ...pageParams };
        const mappedStatus = mapStatusToApi(payload.isBanned as string);
        if (mappedStatus !== undefined) {
            payload.isBanned = mappedStatus;
        } else {
            delete payload.isBanned;
        }

        const mappedRole = mapRoleToApi(payload.role as string);
        if (mappedRole !== undefined) {
            payload.role = mappedRole;
        } else {
            delete payload.role;
        }

        let result = await ApiAdmin.GetAllUser(payload as ManageAccountsParams);
        if (result.data.success) {
            let resultData = result.data.data;
            dataSource.value = resultData.items;
            pageParams.pageNumber = resultData.pageNumber;
            pageParams.pageSize = resultData.pageSize;
            pageParams.totalCount = resultData.totalCount;
            syncQuery();
        }
    } catch (error) {
        console.log("ERROR: " + error);
    }
};
</script>

<template>
    <div class="page-container">
        <!-- header title -->
        <div class="title-container">
            <a-row class="w-100">
                <a-col class="main-title" :span="20">
                    <span>{{ t(`admin.manage_acc.title`) }}</span>
                </a-col>
            </a-row>
        </div>

        <div class="content">
            <!-- filter area -->
            <div class="filter-input-item">
                <!-- filter text input  -->
                <div class="filter-input-full">
                    <!-- gắn trực tiếp vào pageParams.keyword nên giá trị khôi phục từ ?keyword= hiển thị đúng -->
                    <a-input
                        class="custom-input"
                        v-model:value="pageParams.keyword"
                        :placeholder="t('admin.manage_acc.search_placeholder')"
                        allow-clear
                        @input="onKeywordChange"
                        @press-enter="onFilterChange"
                    >
                        <template #prefix>
                            <i class="bx bx-search"></i>
                        </template>
                    </a-input>
                </div>

                <!-- filter account status -->
                <a-select
                    class="filter-select"
                    v-model:value="pageParams.isBanned"
                    @change="onFilterChange"
                >
                    <a-select-option
                        v-for="option in account_status_credit_options"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </a-select-option>
                </a-select>

                <!-- filter account role -->
                <a-select
                    class="filter-select"
                    v-model:value="pageParams.role"
                    @change="onFilterChange"
                >
                    <a-select-option
                        v-for="option in account_role_credit_options"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </a-select-option>
                </a-select>
            </div>

            <!-- table list account -->
            <div class="account-table">
                <a-table
                    :data-source="dataSource"
                    :columns="columns"
                    row-key="id"
                    :pagination="false"
                >
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'fullName'">
                            <div class="account-name-cell">
                                <UserAvatar :avatar-id="record.avatarId" :size="32" :alt="record.fullName" />
                                <span>{{ record.fullName }}</span>
                            </div>
                        </template>
                        <template v-if="column.key === 'role'">
                            <span :class="['role-badge', `role-${String(record.role).toLowerCase()}`]">{{
                                record.role
                            }}</span>
                        </template>
                        <template v-if="column.key === 'ban'">
                            <div class="action-cell">
                                <template v-if="user_info.roles.includes('Administrator')">
                                    <!-- icon assign moderator -->
                                    <a-tooltip>
                                        <template #title>
                                            {{ t("admin.manage_acc.tooltip_demote") }}
                                        </template>
                                        <i
                                            v-if="record.role === 'Moderator'"
                                            class="bx bx-id-card role-action role-action-demote"
                                            @click="onDemoteToUser(record)"
                                        ></i>
                                    </a-tooltip>

                                    <!-- icon assign user -->
                                    <a-tooltip>
                                        <template #title>
                                            {{ t("admin.manage_acc.tooltip_promote") }}
                                        </template>
                                        <i
                                            v-if="record.role === 'User'"
                                            class="bx bx-id-card role-action role-action-promote"
                                            @click="onPromoteToModerator(record)"
                                        ></i>
                                    </a-tooltip>
                                </template>

                                <!-- button ban.active user -->
                                <a-tooltip>
                                    <template #title>
                                        {{ t("admin.manage_acc.tooltip_ban") }}
                                    </template>
                                    <a-switch
                                        v-if="record.role !== 'Administrator'"
                                        v-model:checked="record.isBanned"
                                        :checked-children="''"
                                        :un-checked-children="''"
                                        @change="onToggle(record)"
                                    />
                                </a-tooltip>
                            </div>
                        </template>
                    </template>
                </a-table>
            </div>
            <div class="pagination-container">
                <a-pagination
                    @change="onPaginationChange"
                    v-model:current="pageParams.pageNumber"
                    :total="pageParams.totalCount"
                    :pageSize="pageParams.pageSize"
                    :show-total="
                        (total: any, range: any) =>
                            `${range[0]}-${range[1]} of ${total} ${t('class_member.other.items')}`
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
</template>

<style scoped>
.account-name-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.filter-input-item {
    width: calc(100% - 60px);
    margin: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}
.filter-input-full {
    flex: 1 1 220px;
    min-width: 0;
}
.filter-select {
    flex: 0 0 19%;
    min-width: 130px;
}
.custom-input {
    width: 100%;
    min-width: 0;
    height: 40px;
    border-radius: var(--ui-r-sm);
}
.custom-input :deep(input) {
    min-width: 0;
    text-overflow: ellipsis;
}
.custom-input :deep(i) {
    margin-right: 6px;
}
.account-table {
    width: calc(100% - 60px);
    margin: 8px;
}
.action-cell {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
}

/* nút icon vuông 36px, không viền; hover nền nhạt */
.role-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 24px;
    border-radius: var(--ui-r-md);
    cursor: pointer;
    transition: background-color 0.15s ease;
}
.role-action-demote {
    color: var(--c-danger-text);
}
.role-action-demote:hover {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
}
.role-action-promote {
    color: var(--c-primary-text);
}
.role-action-promote:hover {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
}

/* badge vai trò: 6px; Administrator dùng màu nhấn, Moderator màu cảnh báo, User trung tính */
.role-badge {
    display: inline-block;
    padding: 2px 10px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-xs);
    background-color: var(--c-surface-subtle);
    color: var(--c-text-muted);
    font-size: 12px;
    font-weight: 500;
}
.role-administrator {
    border-color: color-mix(in srgb, var(--main-color) 45%, var(--c-surface));
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    color: var(--c-primary-text);
}
.role-moderator {
    border-color: color-mix(in srgb, var(--c-warning) 45%, var(--c-surface));
    background-color: color-mix(in srgb, var(--c-warning) 14%, var(--c-surface));
    color: var(--c-warning-text);
}

.account-table :deep(.ant-table) {
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-lg);
    overflow: hidden;
}

.account-table :deep(.ant-table-thead > tr > th) {
    background-color: var(--c-surface-subtle);
    color: var(--c-text-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 12px 16px;
}

.account-table :deep(.ant-table-thead > tr > th::before) {
    background-color: var(--c-border) !important;
}

::v-deep(.ant-empty-description) {
    color: var(--text-color) !important;
}
@media (max-width: 768px) {
    .filter-input-item {
        width: 100%;
        margin: 8px 0;
        flex-wrap: wrap;
    }
    .filter-input-full {
        flex: 1 1 100%;
    }
    .filter-select {
        flex: 1 1 calc(50% - 6px);
    }
    .account-table {
        width: 100%;
        margin: 8px 0;
        overflow-x: auto;
    }
}
</style>
