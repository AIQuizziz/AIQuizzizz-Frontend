<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

import SUPPORTED_LOCALES from "@/constants/languages";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const ACCENT_COLOR = "accent_color";
const THEME = "theme";

const themes = computed(() => [
    {
        key: "dark",
        label: t("settings.appearance.theme.dark"),
        class: "theme-dark",
        icon: "moon",
    },
    {
        key: "light",
        label: t("settings.appearance.theme.light"),
        class: "theme-light",
        icon: "sun",
    },
    {
        key: "system",

        label: t("settings.appearance.theme.system"),
        class: "theme-system",
        icon: "globe",
    },
]);

const accent_color = computed(() => [
    {
        code: "#7c3aed",
        name: t("settings.appearance.color.purple"),
        class: "purple",
    },
    {
        code: "#3B82F6",
        name: t("settings.appearance.color.blue"),
        class: "blue",
    },
    {
        code: "#22C55E",
        name: t("settings.appearance.color.green"),
        class: "green",
    },
    {
        code: "#EF4444",
        name: t("settings.appearance.color.red"),
        class: "red",
    },
    {
        code: "#F59E0B",
        name: t("settings.appearance.color.amber"),
        class: "amber",
    },
    {
        code: "#EC4899",
        name: t("settings.appearance.color.pink"),
        class: "pink",
    },
]);

const color_active = ref(accent_color.value[0].class);
const theme_active = ref("theme-light");

const media = window.matchMedia("(prefers-color-scheme: dark)");
const isSystemDark = ref(media.matches);

const getTheme = () => {
    const stored = localStorage.getItem(THEME);
    const validTheme = themes.value.map((x) => x.class);
    return validTheme.includes(stored || "") ? stored! : "theme-light";
};

const getAccentColor = () => {
    const stored = localStorage.getItem(ACCENT_COLOR);
    const validColor = accent_color.value.map((x) => x.class.toLowerCase());
    return validColor.includes(stored || "") ? stored! : accent_color.value[0].class;
};

const applyTheme = (themeClass: string) => {
    themes.value.forEach((x) => document.documentElement.classList.remove(x.class));

    let targetClass = "";
    if (themeClass === "theme-system") {
        targetClass = isSystemDark.value ? "theme-dark" : "theme-light";
    } else {
        targetClass = themes.value.find((x) => x.class === themeClass)?.class || "theme-light";
    }
    document.documentElement.classList.add(targetClass);
};

const applyColor = (colorClass: string) => {
    accent_color.value.forEach((x) => document.documentElement.classList.remove(x.class));
    document.documentElement.classList.add(colorClass);
};

const toggleTheme = (themeClass: string) => {
    theme_active.value = themeClass;
    localStorage.setItem(THEME, themeClass);
    applyTheme(themeClass);
};

const toggleColor = (colorClass: string) => {
    color_active.value = colorClass;
    localStorage.setItem(ACCENT_COLOR, colorClass);
    applyColor(colorClass);
};

/* Language switcher */
const { availableLocales, locale, setLocaleMessage } = useI18n();
const selectedLocale = ref("");

async function switchLanguage(selectedLocale: string) {
    if (!availableLocales.includes(selectedLocale)) {
        const messages = await import(`@/locales/${selectedLocale}.json`);
        setLocaleMessage(selectedLocale, messages);
    }
    locale.value = selectedLocale;
    localStorage.setItem("locale", selectedLocale);
}

onMounted(() => {
    media.addEventListener("change", (e) => {
        isSystemDark.value = e.matches;
    });

    color_active.value = getAccentColor();
    theme_active.value = getTheme();

    applyTheme(theme_active.value);
    applyColor(color_active.value);

    selectedLocale.value = localStorage.getItem("locale") || "en";
});
</script>

<template>
    <div class="content">
        <div class="content-item">
            <div class="content-item-title">
                <div>
                    <span>{{ $t("settings.appearance.title") }}</span>
                    <span>{{ $t("settings.appearance.sub_title") }}</span>
                </div>
            </div>
            <div class="appearance-section">
                <div>{{ $t("settings.appearance.theme.title") }}</div>
                <div class="theme-container">
                    <div
                        v-for="theme in themes"
                        :class="[
                            'theme-item',
                            theme_active === theme.class ? 'active' : '',
                        ]"
                        @click="toggleTheme(theme.class)"
                    >
                        <div class="theme-item-header">
                            <div class="theme-item-info">
                                <i :class="['bx', `bx-${theme.icon}`]"></i>
                                {{ theme.label }}
                            </div>
                            <i
                                :class="[
                                    'bx bx-check',
                                    theme_active !== theme.class ? 'd-none' : '',
                                ]"
                            ></i>
                        </div>
                        <div :class="['theme-illustration', `theme-illustration-${theme.key}`]">
                            <div class="theme-content-item theme-content-item-main-color"></div>
                            <div class="theme-content-item"></div>
                            <div class="theme-content-item"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="appearance-section">
                <div>{{ $t("settings.appearance.color.title") }}</div>
                <div class="color-container">
                    <div
                        :class="['color-item', color_active == color.class ? 'active' : '']"
                        v-for="color in accent_color"
                        @click="toggleColor(color.class)"
                    >
                        <div
                            :class="[
                                'color-item-sample',
                                color_active == color.class ? 'active' : '',
                            ]"
                        >
                            <div :style="{ backgroundColor: `${color.code}` }"></div>
                        </div>
                        <div class="color-item-info">{{ color.name }}</div>
                    </div>
                </div>
            </div>
            <div class="appearance-section">
                <div>{{ $t("settings.appearance.language.title") }}</div>
                <div class="language-select-container">
                    <a-select
                        @change="switchLanguage"
                        class="language-select"
                        v-model:value="selectedLocale"
                    >
                        <a-select-option
                            v-for="locale in SUPPORTED_LOCALES"
                            :key="`locale-${locale.code}`"
                            :value="locale.code"
                        >
                            <img class="language-img" :src="locale.imagePath" alt="img" />
                            {{ locale.label }}
                        </a-select-option>
                    </a-select>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
.appearance-section {
    margin-top: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--c-border);
    font-size: 16px;
    font-weight: 600;
}

.appearance-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.theme-container {
    display: flex;
    gap: 12px;
    padding: 12px 0px 0px;
}

/* thẻ chọn được: viền mảnh; đang chọn viền nhấn + nền nhấn nhạt */
.theme-item {
    flex: 1;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-md);
    background-color: var(--c-surface);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.theme-item:hover {
    border-color: var(--main-color);
}

.theme-item.active {
    border-color: var(--main-color);
    box-shadow: 0 0 0 1px var(--main-color);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
}

.theme-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 10px;
}

.theme-item-header i {
    font-size: 18px;
    margin-right: 10px;
}

.theme-item-header i:nth-child(2) {
    font-size: 24px;
    color: var(--c-primary-text);
    margin: 0px;
}

.theme-item-info {
    display: flex;
    align-items: center;
}

/* ảnh minh hoạ giao diện: màu cố định, không theo giao diện hiện tại */
.theme-illustration {
    background-color: #09090b;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--ui-r-sm);
    padding: 10px;
    padding-bottom: 20px;
}

.theme-content-item {
    height: 8px;
    width: 100px;
    border-radius: 999px;
    background-color: #3a3a3c;
    margin: 8px 0px;
}

.theme-content-item-main-color {
    width: 150px;
    background-color: var(--main-color);
}

.theme-content-item:nth-child(2) {
    width: 50px;
}

.theme-illustration-light {
    background-color: #fff !important;
}

.theme-illustration-system {
    background: linear-gradient(90deg, #09090b 0%, #fff 73.87%);
}

.color-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 12px;
    padding-top: 12px;
}

.color-item {
    padding: 10px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-md);
    background-color: var(--c-surface);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.color-item:hover {
    border-color: var(--main-color);
}

.color-item.active {
    border-color: var(--main-color);
    box-shadow: 0 0 0 1px var(--main-color);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
}

.color-item-sample {
    display: flex;
    width: 46px;
    height: 46px;
    padding: 2px;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    border: 2px solid transparent;
    transition: all 0.2s ease-in-out;
}
.color-item-sample.active {
    border: 2px solid var(--main-color);
}

.color-item-sample div {
    width: 40px;
    height: 40px;
    border-radius: 50%;
}

/* Language */
.language-select-container {
    width: 100%;
    display: flex;
    justify-content: start;
}

.language-select {
    width: 200px;
    height: 100%;
    background-color: var(--background-color);
    margin-top: 12px;
}

.language-img {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
}

.language-select .ant-select-selector {
    background-color: var(--background-color);
    color: var(--text-color);
    border-color: var(--border-color);
}

::v-deep(.ant-select-selector) {
    padding: 5px 10px !important;
    height: auto !important;
}
</style>
