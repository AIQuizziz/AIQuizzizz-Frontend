<script setup lang="ts">
import user_image from "@/assets/user.png";
import { copyToClipboard } from "@/services/ClipboardService";

import ApiUser from "@/api/ApiUser";
import ApiQuestionSet from "@/api/ApiQuestionSet";
import ApiClass from "@/api/ApiClass";
import ApiFolder from "@/api/ApiFolder";

import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import Input from "../components/Common/Input.vue";
import { useAuthStore } from "@/stores/AuthStore";

import VISIBILITY from "@/constants/visibility";
import PERMISSION from "@/constants/permissions";
import { message } from "ant-design-vue";

const { t } = useI18n();
const authStore = useAuthStore();

//#region user
const user = ref(authStore.getUserInfo());
const isUserOwner = computed(() => {
    const ownerId = sharedUser.value.find((x) => x.shareMode === PERMISSION.OWNER)?.userId;
    return ownerId === user.value.id;
});
//#endregion

//#region interface
interface UserPermission {
    userId: string;
    email: string;
    fullName: string;
    shareMode: string;
}
interface SearchUserWithEmail {
    id: string;
    fullName: string;
    email: string;
}
interface SharingFormState {
    id: string;
    sharingModels: {
        shareMode: string;
        sharingUserId: string;
    }[];
    deleteUserIds: string[];
}

interface SharedClass {
    classId: string;
    className: string;
    isAdded: boolean;
}
//#endregion

//#region props
type Props = {
    id: string;
    name: string;
    mode: string; //quiz //folder
    visibility: string;
    options: any;
};
const props = defineProps<Props>();

//#endregion

//#region modal
const visibility = ref(false);

const openModal = async () => {
    visibility.value = true;
    if (props.mode === "quiz" && props.visibility === VISIBILITY.IN_CLASS) {
        await getSharedClasses();
        return;
    }

    await getSharedUser();
};

const closeModal = () => {
    visibility.value = false;
};

defineExpose({
    openModal,
});
//#endregion

//#region init data UI
/* visibility-select */
const visibilityKeys = Object.values(props.options);
const visibility_options = computed(() =>
    visibilityKeys.map((key) => ({
        label: t(`share_modal.visibility.${key}.mode`),
        value: key,
    })),
);
const selected_visibility_option = ref(props.visibility || visibility_options.value[0].value);
const selected_visibility_explain = ref("");

watch(
    () => selected_visibility_option.value,
    async (visibility) => {
        selected_visibility_explain.value = t(`share_modal.visibility.${visibility}.explain`);

        if (visibility === VISIBILITY.PRIVATE) {
            await getSharedUser();
        }
    },
);

/* permission-select */
const permissionKeys = [PERMISSION.EDITABLE, PERMISSION.VIEW_ONLY];
const permission_options = computed(() =>
    permissionKeys.map((key) => ({
        label: t(`share_modal.permission.${key}.mode`),
        value: key,
    })),
);
const selected_permission_option = ref(permission_options.value[0].value);
//#endregion

//#region sample data

/* user sample for quiz permission */

/* class sample for InClass mode */
const user_class_sample = ref([
    {
        id: "1",
        name: "SEP490 - Summer 2025",
    },
    {
        id: "2",
        name: "MLN111 - Spring 2025",
    },
    {
        id: "3",
        name: "MLN121 - Spring 2025",
    },
]);

//#endregion

//#region get sharedUser
const sharedUser = ref<UserPermission[]>([]);
const sharingFormState = ref<SharingFormState>();
const deleteUserIds = ref<string[]>([]);

const getSharedUser = async () => {
    let result;

    switch (props.mode) {
        case "quiz": {
            result = await ApiQuestionSet.GetSharedUser(props.id);
            break;
        }
        case "folder": {
            result = await ApiFolder.GetSharedUser(props.id);
            break;
        }
    }
    if (result?.data.success) {
        sharedUser.value = result.data.data.sharingModel;
    }
};

//#endregion

//#region share private user

const searchUserEmailValue = ref("");

/* use this for result */
const userFound = ref<SearchUserWithEmail[]>([]);

/* use this for temporary when mouse leave */
const lastSearchResult = ref<SearchUserWithEmail[]>([]);

/* use this for tracking whether mouse is in search components */
const searchUserResultRef = ref<HTMLElement | null>(null);

function handleMouseClickOutside(event: MouseEvent) {
    if (searchUserEmailValue.value && !searchUserResultRef.value?.contains(event.target as Node)) {
        userFound.value = [];
    } else {
        userFound.value = [...lastSearchResult.value];
    }
}

const onSearchUser = async () => {
    if (!searchUserEmailValue.value.trim()) {
        userFound.value = [];
        lastSearchResult.value = [];
        return;
    }

    const result = await ApiUser.SearchByEmail(searchUserEmailValue.value);
    if (result.data.success) {
        userFound.value = result.data.data;
        lastSearchResult.value = [...result.data.data];
    }
};

/* use this for query and generate list of user when mode = private */
const updateSharedUsers = async ({
    sharingModels = [] as any[],
    deleteUserIds = [] as string[],
    successMsg = t("message.updated_successfully"),
    errorMsg = t("message.updated_failed"),
}) => {
    sharingFormState.value = {
        id: props.id,
        sharingModels,
        deleteUserIds,
    };
    let result;

    switch (props.mode) {
        case "quiz": {
            result = await ApiQuestionSet.UpdateSharedUser({
                ...sharingFormState.value,
                visibilityMode: selected_visibility_option.value,
            });
            break;
        }
        case "folder": {
            result = await ApiFolder.UpdateSharedUser({
                folderId: sharingFormState.value.id,
                ...sharingFormState.value,
            });
            break;
        }
    }

    if (result?.data.success) {
        await getSharedUser();
        message.success(successMsg);
    } else {
        message.error(errorMsg);
    }
};
const onShareWithResultUser = async (user: SearchUserWithEmail) => {
    await updateSharedUsers({
        sharingModels: [
            {
                sharingUserId: user.id,
                shareMode: PERMISSION.VIEW_ONLY,
            },
        ],
        successMsg: t("message.added_successfully"),
        errorMsg: t("message.added_failed"),
    });
};

//change people permission
const onChangePeoplePermission = async (userId: string, permission: string) => {
    await updateSharedUsers({
        sharingModels: [
            {
                sharingUserId: userId,
                shareMode: permission,
            },
        ],
        successMsg: t("message.updated_successfully"),
        errorMsg: t("message.updated_failed"),
    });
};

/* remove people access */
const onConfirmRemovePeopleAccess = async (id: string) => {
    deleteUserIds.value.push(id);
    await updateSharedUsers({
        sharingModels: [],
        deleteUserIds: deleteUserIds.value,
        successMsg: t("message.removed_successfully"),
        errorMsg: t("message.removed_failed"),
    });
};

const isSharedUserContain = (id: string) => {
    return sharedUser.value.some((x) => x.userId === id);
};
//#endregion

//#region share in class
const sharedClass = ref<SharedClass[]>([]);
const getSharedClasses = async () => {
    const result = await ApiQuestionSet.GetSharedClasses(props.id);
    if (result.data.success) {
        sharedClass.value = result.data.data;
    }
};

const onAddToClass = async (classId: string) => {
    const result = await ApiClass.AddQuestionSet(classId, props.id);
    if (result.data.success) {
        const classItem = sharedClass.value.find((x) => x.classId === classId);
        if (classItem) {
            classItem.isAdded = true;
        }
        message.success(t("message.added_successfully"));
    }
};

const onRemoveFromClass = async (classId: string) => {
    const result = await ApiClass.DeleteQuestionSetFromClass(classId, props.id);
    if (result.data.success) {
        const classItem = sharedClass.value.find((x) => x.classId === classId);
        if (classItem) {
            classItem.isAdded = false;
        }
        message.success(t("message.removed_successfully"));
    }
};

//#endregion

//#region share public
const getPublicShareUrl = () => {
    const origin = window.location.origin;
    return origin + `/user/question-set/${props.id}`;
};

const onCopyPublicShareUrl = async () => {
    const success = await copyToClipboard(getPublicShareUrl());

    if (success) message.success(t("message.copied"));
    else message.error(t("message.copied_failed"));
};
//#endregion

//#region change visibility
// const emit = defineEmits<(e: "updateVisibility", visibility: string) => void>();

const onChangeVisibility = async () => {
    await updateSharedUsers({
        sharingModels: [],
        successMsg: t("message.updated_successfully"),
        errorMsg: t("message.updated_failed"),
    });
    // emit("updateVisibility", selected_visibility_option.value as string);
};

//#endregion

onMounted(() => {
    document.addEventListener("click", handleMouseClickOutside);
    // userWithPermission.value.push(...(user_permission_sample as UserPermission[]));

    selected_visibility_explain.value = t(
        `share_modal.visibility.${selected_visibility_option.value}.explain`,
    );
});
</script>
<template>
    <a-modal
        centered
        width="100%"
        wrap-class-name="medium-modal"
        :open="visibility"
        @cancel="closeModal"
    >
        <div
            :class="[
                'page-container',
                selected_visibility_option === VISIBILITY.PRIVATE ? 'larger' : '',
            ]"
        >
            <div class="title-container">
                <a-row class="w-100 d-flex align-items-center justify-content-between">
                    <a-col :span="1">
                        <RouterLink :to="{ name: '' }" @click="closeModal">
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="22">
                        <span>
                            {{ $t("share_modal.title") }}
                            {{ $t(`share_modal.mode.${mode}`) }}
                            {{ name }}
                        </span>
                        <br />
                        <span>{{ $t("share_modal.sub_title") }}</span>
                    </a-col>
                </a-row>
            </div>
            <a-form layout="vertical">
                <a-row class="p-3 d-flex justify-content-between">
                    <a-col :span="24">
                        <a-form-item :label="$t('share_modal.component_title.visibility')">
                            <a-select
                                :disabled="!isUserOwner"
                                @change="onChangeVisibility"
                                class="me-3"
                                v-model:value="selected_visibility_option"
                                style="width: 200px"
                            >
                                <a-select-option
                                    v-for="option in visibility_options"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </a-select-option>
                            </a-select>
                            <div class="visibility-explain">{{ selected_visibility_explain }}</div>
                        </a-form-item>
                    </a-col>
                    <!-- <a-col
                        :span="24"
                        :class="[
                            'shareable-link-container',
                            selected_visibility_option === VISIBILITY.PUBLIC ? '' : 'd-none',
                        ]"
                    >
                        <a-qrcode :value="getPublicShareUrl()" />
                        <div>
                            <a-input class="share-link" :value="getPublicShareUrl()" />
                            <a-button
                                class="mt-2 main-color-btn"
                                type="primary"
                                @click="onCopyPublicShareUrl"
                            >
                                <i class="me-3 bx bx-link-alt"></i>
                                {{ $t("share_modal.buttons.copy_link") }}
                            </a-button>
                        </div>
                    </a-col> -->
                    <a-col
                        :span="24"
                        :class="[
                            selected_visibility_option === VISIBILITY.PRIVATE ||
                            selected_visibility_option === VISIBILITY.PUBLIC
                                ? ''
                                : 'd-none',
                        ]"
                    >
                        <a-col
                            :span="24"
                            :class="[
                                'shareable-link-container',
                                selected_visibility_option === VISIBILITY.PUBLIC ? '' : 'd-none',
                            ]"
                        >
                            <a-qrcode :value="getPublicShareUrl()" />
                            <div>
                                <a-input class="share-link" :value="getPublicShareUrl()" />
                                <a-button
                                    class="mt-2 main-color-btn"
                                    type="primary"
                                    @click="onCopyPublicShareUrl"
                                >
                                    <i class="me-3 bx bx-link-alt"></i>
                                    {{ $t("share_modal.buttons.copy_link") }}
                                </a-button>
                            </div>
                        </a-col>

                        <div
                            v-if="isUserOwner"
                            class="form-item search-user"
                            ref="searchUserResultRef"
                        >
                            <label>
                                {{ $t("share_modal.component_title.share_with_email") }} -
                                <span>{{ $t("share_modal.other.search_ins") }}</span>
                            </label>
                            <Input
                                @change="onSearchUser"
                                v-model:value="searchUserEmailValue"
                                :placeholder="t('share_modal.other.search_email_placeholder')"
                            >
                                <template #icon>
                                    <i class="bx bx-envelope"></i>
                                </template>
                            </Input>
                            <div v-if="userFound.length > 0" :class="['search-user-container']">
                                <div class="search-user-result">
                                    <div class="search-user-item" v-for="user in userFound">
                                        <div class="user-item-email">{{ user.email }}</div>
                                        <div
                                            :class="[
                                                'user-item-access',
                                                isSharedUserContain(user.id) ? 'd-none' : '',
                                            ]"
                                        >
                                            <a-button
                                                type="primary"
                                                class="main-color-btn"
                                                @click="onShareWithResultUser(user)"
                                            >
                                                <i class="bx bxs-user-plus"></i>
                                            </a-button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="list-item-section">
                            <div class="list-item-title">
                                {{
                                    $t("share_modal.component_title.people_with_access", {
                                        number: sharedUser.length,
                                    })
                                }}
                            </div>
                            <div class="list-item-container">
                                <template v-for="people in sharedUser">
                                    <div class="list-item">
                                        <img class="people-access-img" :src="user_image" alt="" />
                                        <div class="people-access-info">
                                            <span>{{ people.fullName }}</span>
                                            <span>{{ people.email }}</span>
                                        </div>
                                        <div class="people-access-permission">
                                            <a-select
                                                :disabled="
                                                    people.shareMode === PERMISSION.OWNER ||
                                                    people.userId === user.id
                                                "
                                                @change="
                                                    onChangePeoplePermission(
                                                        people.userId,
                                                        people.shareMode,
                                                    )
                                                "
                                                style="width: 130px"
                                                v-model:value="people.shareMode"
                                            >
                                                <a-select-option
                                                    v-for="option in permission_options"
                                                    :value="option.value"
                                                >
                                                    {{ option.label }}
                                                </a-select-option>
                                                <a-select-option
                                                    v-if="people.shareMode === PERMISSION.OWNER"
                                                    :value="PERMISSION.OWNER"
                                                >
                                                    {{
                                                        t(
                                                            `share_modal.permission.${PERMISSION.OWNER}.mode`,
                                                        )
                                                    }}
                                                </a-select-option>
                                            </a-select>
                                            <a-popconfirm
                                                :title="$t('share_modal.other.delete_warning')"
                                                :ok-text="$t('share_modal.buttons.yes')"
                                                :cancel-text="$t('share_modal.buttons.no')"
                                                @confirm="
                                                    onConfirmRemovePeopleAccess(people.userId)
                                                "
                                            >
                                                <i
                                                    v-if="
                                                        people.userId !== user.id &&
                                                        people.shareMode !== PERMISSION.OWNER
                                                    "
                                                    class="ms-2 text-danger bx bx-trash"
                                                ></i>
                                            </a-popconfirm>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </a-col>

                    <a-col
                        :span="24"
                        :class="[
                            selected_visibility_option === VISIBILITY.IN_CLASS ? '' : 'd-none',
                        ]"
                    >
                        <div class="list-item-section">
                            <div class="list-item-container">
                                <template v-for="item in sharedClass">
                                    <div class="list-item">
                                        <span class="d-flex align-items-center">
                                            {{ item.className }}
                                            <i
                                                v-if="item.isAdded"
                                                class="fs-4 bx bx-check result-correct"
                                            ></i>
                                        </span>

                                        <div class="people-access-permission">
                                            <i
                                                v-if="item.isAdded"
                                                class="text-danger bx bx-trash-alt"
                                                @click="onRemoveFromClass(item.classId)"
                                            ></i>
                                            <a-button
                                                v-else
                                                type="ghost"
                                                size="small"
                                                class="main-color-btn"
                                                @click="onAddToClass(item.classId)"
                                            >
                                                <i class="bx bx-plus"></i>
                                            </a-button>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </a-col>
                </a-row>
            </a-form>
        </div>
        <template #footer></template>
    </a-modal>
</template>
<style scoped>
.page-container {
    margin-left: 0px;
    padding: 6px 10px 10px;
    transition: all 0.3s ease-in-out;
}

.page-container.larger {
    height: 650px;
}

.page-container::-webkit-scrollbar {
    width: 0px;
}

.title-container .main-title span:nth-child(1) {
    font-size: 20px;
    font-weight: 700;
}

.title-container .main-title span:nth-child(3) {
    font-size: 14px;
    font-weight: 400;
}

::v-deep(.ant-form-item-label label) {
    color: var(--c-text);
    font-weight: 600;
}

.visibility-explain {
    margin-top: 6px;
    font-size: 13px;
    color: var(--c-text-muted);
}

.shareable-link-container {
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: start;
}

::v-deep(.ant-qrcode) {
    background-color: #fff !important;
}

.share-link {
    width: 350px;
    max-height: 40px;
    padding: 5px 10px;
    background-color: var(--form-item-background-color);
    border: 1px solid var(--form-item-border-color);
    color: var(--c-text);
    border-radius: var(--ui-r-sm);
}

.search-user {
    padding: 0px;
}

.search-user-container {
    position: relative;
    color: var(--text-color);
}

.search-user-result {
    background-color: var(--form-item-background-color);
    border: 1px solid var(--form-item-border-color);
    position: absolute;
    top: 0px;
    z-index: 10;
    width: 100%;
    margin: 4px 0 0;
    padding: 6px;
    border-radius: var(--ui-r-lg);
    overflow-y: scroll;
    box-shadow: var(--ui-shadow-pop);
    height: 300px;
}

.search-user-result::-webkit-scrollbar {
    width: 0px;
}

.search-user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--c-text);
    padding: 8px 10px;
    border-radius: var(--ui-r-sm);
    cursor: pointer;
}

.search-user-item:hover {
    background-color: var(--c-surface-subtle);
}

.user-item-access {
    display: flex;
    align-items: center;
}

.user-item-access i {
    font-size: 26px;
}

.list-item-section {
    color: var(--text-color);
    margin-top: 15px;
}

.list-item-title {
    font-size: 18px;
    font-weight: 700;
}

.list-item-container {
    margin-top: 10px;
    padding: 8px;
    gap: 8px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-lg);
    height: 230px;
    max-height: 300px;
    overflow-y: scroll;
    display: flex;
    flex-direction: column;
}

.list-item-container::-webkit-scrollbar {
    width: 0px;
}

.list-item {
    flex-shrink: 0;
    padding: 8px 10px;
    background-color: var(--c-surface);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    transition: border-color 0.15s;
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
}

.list-item span {
    margin-left: 10px;
    color: var(--c-text);
}

.list-item:hover {
    border-color: var(--main-color);
}

.people-access-img {
    width: 40px;
    height: 40px;
    background-color: var(--c-surface-raised);
    border-radius: 50%;
    margin-right: 10px;
    padding: 5px;
}

.people-access-info {
    display: flex;
    flex-direction: column;
}

.people-access-info span:first-child {
    color: var(--c-text);
    font-size: 15px;
    font-weight: 600;
}

.people-access-info span:last-child {
    color: var(--c-text-muted);
    font-size: 13px;
}

.people-access-permission {
    flex: 1;
    display: flex;
    justify-content: end;
    align-items: center;
}

.people-access-permission i {
    font-size: 20px;
    cursor: pointer;
}
</style>
