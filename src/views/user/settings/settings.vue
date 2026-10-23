<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Component } from "vue";

import Account from "@/views/user/settings/account.vue";
import Subscription from "@/views/user/settings/subscription.vue";
import Billing from "@/views/user/settings/billing.vue";

import { useI18n } from "vue-i18n";
const { t } = useI18n();

type TabKey = "Account" | "Subscription" | "Billing";

const tabs = ref<{ key: TabKey; tab: string }[]>([
    { key: "Account", tab: "account" },
    { key: "Subscription", tab: "subscription" },
    { key: "Billing", tab: "billing" },
]);

//record = dictionary
const tab_component: Record<TabKey, Component> = {
    Account,
    Subscription,
    Billing,
};

const route = useRoute();
const router = useRouter();

// tab hiện tại nằm trên URL (?tab=appearance) để reload/chia sẻ link vẫn giữ nguyên tab
// Hồ sơ / Bảo mật / Giao diện đã gộp vào tab Tài khoản: link cũ (?tab=security ...) và khoá cũ trong sessionStorage vẫn trỏ đúng tab
const LEGACY_TABS: Record<string, string> = { profile: "account", security: "account", appearance: "account" };
const findTabKey = (value: unknown): TabKey | undefined => {
    if (typeof value !== "string") return undefined;
    const name = value.toLowerCase();
    const target = LEGACY_TABS[name] ?? name;
    return tabs.value.find((x) => x.tab === target)?.key;
};

const activeKey = ref<TabKey>(findTabKey(route.query.tab) ?? tabs.value[0].key);
const emit = defineEmits(["updateSidebar"]);

watch(activeKey, (key) => {
    const tab = tabs.value.find((x) => x.key === key)?.tab;
    if (tab && route.query.tab !== tab) {
        router.replace({ query: { ...route.query, tab } });
    }
});

onMounted(() => {
    const sidebarActiveItem = "settings";
    emit("updateSidebar", sidebarActiveItem);

    // các trang khác (hết quyền gói...) chuyển sang tab Subscription qua sessionStorage; URL ?tab= được ưu tiên
    const session_setting_key = sessionStorage.getItem("setting_key");
    if (session_setting_key) sessionStorage.removeItem("setting_key");
    if (!findTabKey(route.query.tab) && findTabKey(session_setting_key)) {
        activeKey.value = findTabKey(session_setting_key)!;
    }
    // đồng bộ URL ngay lần đầu để luôn có ?tab=
    const currentTab = tabs.value.find((x) => x.key === activeKey.value)?.tab;
    if (currentTab && route.query.tab !== currentTab) {
        router.replace({ query: { ...route.query, tab: currentTab } });
    }
});
</script>
<template>
    <div class="page-container">
        <div class="title-container">
            <a-row class="w-100">
                <a-col class="main-title" :span="20">
                    <span>{{ $t("settings.title") }}</span> <br />
                    <span>
                        {{ $t("settings.sub_title") }}
                    </span>
                </a-col>
            </a-row>
        </div>
        <a-tabs
            class="tab-container"
            v-model:activeKey="activeKey"
            type="card"
            :destroyInactiveTabPane="true"
        >
            <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="t(`settings.tabs.${tab.tab}`)">
                <component :is="tab_component[tab.key]"></component>
            </a-tab-pane>
        </a-tabs>
    </div>
</template>
<style scoped>
::v-deep(.ant-tabs-nav::before) {
    border-bottom: none;
}

::v-deep(.ant-tabs-nav-list) {
    padding: 4px;
    gap: 4px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    color: var(--c-text-muted);
    border-radius: var(--ui-r-md);
    margin-left: 10px;
}

::v-deep(.ant-tabs-tab) {
    width: 100px;
    margin: 0px !important;
    border-radius: var(--ui-r-sm) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    border-color: transparent !important;
    background: transparent !important;
}

::v-deep(.ant-tabs-tab:not(.ant-tabs-tab-active):hover) {
    background-color: var(--c-surface-subtle) !important;
}

::v-deep(.ant-tabs-tab:not(.ant-tabs-tab-active):hover .ant-tabs-tab-btn) {
    color: var(--c-text) !important;
}

::v-deep(.ant-tabs-tab-active) {
    background-color: var(--main-color) !important;
    border-color: transparent !important;
}

::v-deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    color: var(--c-on-primary) !important;
    font-weight: 600;
}
</style>
