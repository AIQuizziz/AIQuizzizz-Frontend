<script setup lang="ts">
import UserAvatar from "@/shared/components/Common/UserAvatar.vue";

import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useAuthStore } from "@/stores/AuthStore";
import { Modal } from "ant-design-vue";
import { useRoute } from "vue-router";
import {
    sidebarOpen,
    isDrawerMode,
    isCompact,
    closeSidebarDrawer,
} from "@/shared/composables/useSidebar";
import { useI18n } from "vue-i18n";

const { activeItem } = defineProps(["activeItem"]);
const { t } = useI18n();

// tablet/laptop nhỏ (< 1200px): tự thu gọn thành mini sidebar; < 992px: dùng drawer nên không thu gọn
const isShrinkView = ref(isCompact.value && !isDrawerMode.value);
watch([isCompact, isDrawerMode], ([compact, drawer]) => {
    isShrinkView.value = compact && !drawer;
});

const route = useRoute();
watch(
    () => route.fullPath,
    () => closeSidebarDrawer(),
);
const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeSidebarDrawer();
};
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
    closeSidebarDrawer();
});
// chạm vào một liên kết trong drawer thì đóng drawer (kể cả khi liên kết trỏ về trang hiện tại)
const onSidebarClick = (e: MouseEvent) => {
    if (isDrawerMode.value && (e.target as HTMLElement).closest("a")) closeSidebarDrawer();
};

const toggleSidebar = () => {
    isShrinkView.value = !isShrinkView.value;
};

const authStore = useAuthStore();
// computed: tự cập nhật khi đổi tên / ảnh đại diện ở trang Cài đặt
const user = computed<any>(() => authStore.getUserInfo() ?? {});

const onSignOut = () => {
    Modal.confirm({
        title: t("sidebar.popUp.signOut.message"),
        content: t("sidebar.popUp.signOut.content"),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: () => {
            authStore.logOut();
        },
        onCancel: () => {},
    });
};
</script>
<template>
    <div
        v-if="isDrawerMode && sidebarOpen"
        class="sidebar-backdrop"
        aria-hidden="true"
        @click="closeSidebarDrawer"
    ></div>
    <div
        :class="[
            'sidebar-container',
            { shrink: isShrinkView && !isDrawerMode, drawer: isDrawerMode, open: sidebarOpen },
        ]"
        :aria-hidden="isDrawerMode && !sidebarOpen ? 'true' : undefined"
        :inert="isDrawerMode && !sidebarOpen ? true : undefined"
        @click="onSidebarClick"
    >
        <button
            class="sidebar-viewButton"
            type="button"
            :aria-label="isShrinkView ? 'Expand Sidebar' : 'Shrink Sidebar'"
            :aria-expanded="!isShrinkView"
            @click="toggleSidebar"
        >
            <i class="bx bx-left-arrow-alt"></i>
        </button>
        <div class="sidebar-wrapper">
            <ul class="sidebar-list">
                <!-- <li :class="['sidebar-listItem active', { active: activeItem === 'dashboard' }]">
                    <RouterLink :to="{ name: 'Admin_Dashboards_View' }">
                        <i class="bx bxs-dashboard"></i>
                        <span class="sidebar-listItemText">Dashboards</span>
                    </RouterLink>
                </li>
                <li :class="['sidebar-listItem', { active: activeItem === 'appointment' }]">
                    <RouterLink :to="{}">
                        <i class="bx bx-book-open"></i>
                        <span class="sidebar-listItemText">Quizzes</span>
                    </RouterLink>
                </li>
                <li :class="['sidebar-listItem', { active: activeItem === 'user' }]">
                    <RouterLink :to="{}">
                        <i class="bx bxs-calendar"></i>
                        <span class="sidebar-listItemText">Exam Schedule</span>
                    </RouterLink>
                </li>
                <li :class="['sidebar-listItem', { active: activeItem === 'doctor' }]">
                    <RouterLink :to="{}">
                        <i class="bx bx-group"></i>
                        <span class="sidebar-listItemText">Class</span>
                    </RouterLink>
                </li> -->
                <a-divider
                    class="divider"
                    orientation="left"
                    orientation-margin="0px"
                    style="margin-bottom: 0px; color: var(--text-color)"
                >
                    {{ $t("sidebar.others.Manage") }}
                </a-divider>
                <a-divider
                    class="divider"
                    style="margin-top: 0px; background-color: var(--border-color-contrast)"
                />

                <!-- <li :class="['sidebar-listItem', { active: activeItem === 'specialty' }]">
                    <RouterLink :to="{}">
                        <i class="bx bx-cog"></i>
                        <span class="sidebar-listItemText">Settings</span>
                    </RouterLink>
                </li> -->
                <li :class="['sidebar-listItem', { active: activeItem === 'account' }]">
                    <RouterLink :to="{ name: 'Admin_Manager_Account' }">
                        <i class="bx bx-user-circle"></i>
                        <span class="sidebar-listItemText">{{ $t("sidebar.admin.account") }}</span>
                    </RouterLink>
                </li>
                <li :class="['sidebar-listItem', { active: activeItem === 'subscription' }]">
                    <RouterLink :to="{ name: 'Admin_Manager_Subscription' }">
                        <i class="bx bx-credit-card"></i>
                        <span class="sidebar-listItemText">{{
                            $t("sidebar.admin.subscription")
                        }}</span>
                    </RouterLink>
                </li>
                <li :class="['sidebar-listItem', { active: activeItem === 'system_settings' }]">
                    <RouterLink :to="{ name: 'Admin_System_Settings' }">
                        <i class="bx bx-slider-alt"></i>
                        <span class="sidebar-listItemText">{{
                            $t("sidebar.admin.system_settings")
                        }}</span>
                    </RouterLink>
                </li>
                <li :class="['sidebar-listItem']">
                    <RouterLink :to="{ name: 'User_Dashboard' }">
                        <i class="bx bx-refresh"></i>
                        <span class="sidebar-listItemText">{{
                            $t("sidebar.admin.switch_to_user")
                        }}</span>
                    </RouterLink>
                </li>
                <!-- <li :class="['sidebar-listItem', { active: activeItem === 'class' }]">
                    <RouterLink :to="{ name: 'Admin_Manager_Class' }">
                        <i class="bx bx-cog"></i>
                        <span class="sidebar-listItemText">Manager Class</span>
                    </RouterLink>
                </li> -->
                <li
                    :class="['sidebar-listItem sign-out', { active: activeItem === 'specialty' }]"
                    @click="onSignOut"
                >
                    <RouterLink :to="{}">
                        <i class="bx bx-download bx-rotate-270"></i>
                        <span class="sidebar-listItemText">{{
                            $t("sidebar.buttons.signOut")
                        }}</span>
                    </RouterLink>
                </li>
            </ul>
            <div class="sidebar-profileSection">
                <UserAvatar :avatar-id="user?.avatarId" :size="60" :alt="user?.fullName" />
                <div>
                    <span>{{ user.fullName }}</span>
                    <span class="sign-out-btn" @click="onSignOut">
                        {{ $t("sidebar.buttons.signOut") }}
                        <i class="bx bx-download bx-rotate-270"></i>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
* {
    box-sizing: border-box;
}
</style>
